from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import uvicorn
import io
import csv
from datetime import datetime, date, timedelta
from typing import Optional
import json

from database import engine, Base, get_db
from models import Lead, Call, Reminder, Note, Meeting, DialerSession, DialerQueueItem
from schemas import (
    LeadCreate, LeadUpdate, LeadResponse,
    CallCreate, CallResponse,
    ReminderCreate, ReminderResponse,
    NoteCreate, NoteResponse,
    DashboardStats,
    MeetingCreate,
    MeetingUpdate,
    MeetingResponse,
    DialerStartRequest,
)
from twilio_service import TwilioService
from auth import create_token, verify_token, hash_password, verify_password
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from sqlalchemy.exc import IntegrityError
import os
from dotenv import load_dotenv

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Grön Konsult CRM", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173,https://gronkonsult-crm-production.up.railway.app"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

twilio = TwilioService()

# Auth disabled – single user, opens directly
def get_current_user():
    return {"sub": "admin"}

# ─── LEADS ───────────────────────────────────────────────────────────────────

@app.get("/api/leads")
def get_leads(
    search: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    query = db.query(Lead)
    if search:
        query = query.filter(
            or_(
                Lead.name.ilike(f"%{search}%"),
                Lead.company.ilike(f"%{search}%"),
                Lead.phone.ilike(f"%{search}%"),
                Lead.email.ilike(f"%{search}%"),
            )
        )
    if status:
        query = query.filter(Lead.status == status)
    return query.order_by(Lead.created_at.desc()).offset(skip).limit(limit).all()

@app.post("/api/leads")
def create_lead(lead: LeadCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_lead = Lead(**lead.dict())
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead

@app.get("/api/leads/{lead_id}")
def get_lead(lead_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead hittades inte")
    return lead

@app.put("/api/leads/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: int, lead_update: LeadUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead hittades inte")

    update_data = lead_update.dict(exclude_unset=True)

    for field, value in update_data.items():
        setattr(lead, field, value)
    lead.updated_at = datetime.utcnow()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Telefonnumret används redan av ett annat lead")
    db.refresh(lead)
    return lead

@app.delete("/api/leads/{lead_id}")
def delete_lead(lead_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead hittades inte")
    db.delete(lead)
    db.commit()
    return {"ok": True}

# ─── CSV ─────────────────────────────────────────────────────────────────────

@app.get("/api/leads/export/csv")
def export_csv(db: Session = Depends(get_db), user=Depends(get_current_user)):
    leads = db.query(Lead).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Namn", "Företag", "Telefon", "Email", "Status", "Källa", "Anteckningar", "Uppföljning", "Skapad"])
    for lead in leads:
        writer.writerow([
            lead.name, lead.company, lead.phone, lead.email,
            lead.status, lead.source, lead.notes,
            lead.follow_up_date, lead.created_at.strftime("%Y-%m-%d")
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"}
    )

@app.post("/api/leads/import/csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    content = await file.read()
    decoded = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    
    created = 0
    skipped = 0
    for row in reader:
        phone = row.get("Telefon", row.get("phone", "")).strip()
        if not phone:
            skipped += 1
            continue
        existing = db.query(Lead).filter(Lead.phone == phone).first()
        if existing:
            skipped += 1
            continue
        lead = Lead(
            name=row.get("Namn", row.get("name", "")).strip(),
            company=row.get("Företag", row.get("company", "")).strip(),
            phone=phone,
            email=row.get("Email", row.get("email", "")).strip(),
            source=row.get("Källa", row.get("source", "CSV Import")).strip(),
            notes=row.get("Anteckningar", row.get("notes", "")).strip(),
            status="new"
        )
        db.add(lead)
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped}

# ─── NOTES ───────────────────────────────────────────────────────────────────

@app.get("/api/leads/{lead_id}/notes", response_model=list[NoteResponse])
def get_notes(lead_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Note).filter(Note.lead_id == lead_id).order_by(Note.created_at.desc()).all()

@app.post("/api/leads/{lead_id}/notes", response_model=NoteResponse)
def create_note(lead_id: int, note: NoteCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_note = Note(lead_id=lead_id, **note.dict())
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

# ─── CALLS ───────────────────────────────────────────────────────────────────

@app.post("/api/calls/initiate/{lead_id}")
def initiate_call(lead_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead hittades inte")
    result = twilio.initiate_call(lead.phone, lead.id)
    if result["success"]:
        call = Call(
            lead_id=lead_id,
            twilio_sid=result["call_sid"],
            status="initiated",
            direction="outbound"
        )
        db.add(call)
        lead.last_contacted = datetime.utcnow()
        db.commit()
        return {"success": True, "call_sid": result["call_sid"]}
    raise HTTPException(status_code=500, detail=result.get("error", "Samtal misslyckades"))

@app.post("/api/calls/status-callback")
async def status_callback(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    call_sid = form.get("CallSid")
    call_status = form.get("CallStatus", "unknown")
    duration = form.get("CallDuration")

    if not call_sid:
        return {"status": "ignored"}

    call = db.query(Call).filter(Call.twilio_sid == call_sid).first()
    if not call:
        return {"status": "missing_call"}

    call.status = call_status
    if duration:
        try:
            call.duration = int(duration)
        except ValueError:
            pass

    if call_status in ["busy", "no-answer", "failed"]:
        call.outcome = call_status
    elif call_status == "completed":
        call.outcome = call.outcome or "answered"

    db.commit()
    return {"status": "ok"}


@app.post("/api/calls/recording-callback")
async def recording_callback(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    call_sid = form.get("CallSid")
    recording_sid = form.get("RecordingSid")
    recording_url = form.get("RecordingUrl")

    if not call_sid:
        return {"status": "ignored"}

    call = db.query(Call).filter(Call.twilio_sid == call_sid).first()
    if not call:
        return {"status": "missing_call"}

    call.recording_sid = recording_sid
    if recording_url:
        call.recording_url = f"{recording_url}.mp3"
    db.commit()
    return {"status": "ok"}


@app.post("/api/calls/dial-complete/{lead_id}")
async def dial_complete(lead_id: int, request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    dial_status = form.get("DialCallStatus")
    call_sid = form.get("CallSid")
    call = db.query(Call).filter(Call.twilio_sid == call_sid).first() if call_sid else None
    if call and dial_status:
        call.outcome = dial_status
        db.commit()
    return {"status": "ok", "lead_id": lead_id}

@app.get("/api/calls/lead/{lead_id}", response_model=list[CallResponse])
def get_calls_for_lead(lead_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Call).filter(Call.lead_id == lead_id).order_by(Call.created_at.desc()).all()

@app.get("/api/calls/recent", response_model=list[CallResponse])
def get_recent_calls(limit: int = 20, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Call).order_by(Call.created_at.desc()).limit(limit).all()

# ─── MEETINGS ────────────────────────────────────────────────────────────────

@app.get("/api/meetings", response_model=list[MeetingResponse])
def get_meetings(
    lead_id: Optional[int] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    query = db.query(Meeting)
    if lead_id:
        query = query.filter(Meeting.lead_id == lead_id)
    if from_date:
        query = query.filter(Meeting.scheduled_at >= from_date)
    if to_date:
        query = query.filter(Meeting.scheduled_at <= to_date)
    return query.order_by(Meeting.scheduled_at.asc()).all()


@app.post("/api/meetings", response_model=MeetingResponse)
def create_meeting(meeting: MeetingCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == meeting.lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead hittades inte")

    db_meeting = Meeting(**meeting.dict())
    db.add(db_meeting)
    lead.status = "meeting_booked"

    reminder_24h = Reminder(
        lead_id=meeting.lead_id,
        meeting=db_meeting,
        title=f"Möte imorgon: {meeting.title}",
        due_at=meeting.scheduled_at - timedelta(hours=24),
        type="meeting_24h",
    )
    reminder_1h = Reminder(
        lead_id=meeting.lead_id,
        meeting=db_meeting,
        title=f"Möte snart: {meeting.title}",
        due_at=meeting.scheduled_at - timedelta(hours=1),
        type="meeting_1h",
    )
    db.add(reminder_24h)
    db.add(reminder_1h)

    db.commit()
    db.refresh(db_meeting)
    return db_meeting


@app.put("/api/meetings/{meeting_id}", response_model=MeetingResponse)
def update_meeting(meeting_id: int, meeting_update: MeetingUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Möte hittades inte")

    for field, value in meeting_update.dict(exclude_unset=True).items():
        setattr(meeting, field, value)

    db.commit()
    db.refresh(meeting)
    return meeting


# ─── AUTO DIALER ─────────────────────────────────────────────────────────────

@app.post("/api/dialer/start")
def start_dialer(data: DialerStartRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    lead_ids = data.lead_ids or []
    if not lead_ids:
        status_filter = data.status or "new"
        leads = db.query(Lead).filter(Lead.status == status_filter).all()
        lead_ids = [l.id for l in leads]

    if not lead_ids:
        raise HTTPException(status_code=400, detail="Ingen lead att ringa")

    active = db.query(DialerSession).filter(
        DialerSession.owner == user["sub"],
        DialerSession.status == "running"
    ).first()
    if active:
        active.status = "stopped"

    session = DialerSession(owner=user["sub"], status="running", current_index=0)
    db.add(session)
    db.flush()

    for idx, lead_id in enumerate(lead_ids):
        db.add(DialerQueueItem(session_id=session.id, lead_id=lead_id, position=idx, status="queued"))

    db.commit()
    return {"started": True, "total": len(lead_ids), "session_id": session.id}

@app.post("/api/dialer/next")
def dialer_next(db: Session = Depends(get_db), user=Depends(get_current_user)):
    session = db.query(DialerSession).filter(
        DialerSession.owner == user["sub"],
        DialerSession.status == "running"
    ).order_by(DialerSession.created_at.desc()).first()
    if not session:
        return {"done": True}

    item = db.query(DialerQueueItem).filter(
        DialerQueueItem.session_id == session.id,
        DialerQueueItem.status == "queued"
    ).order_by(DialerQueueItem.position.asc()).first()

    if not item:
        session.status = "completed"
        db.commit()
        return {"done": True}

    lead = db.query(Lead).filter(Lead.id == item.lead_id).first()
    if not lead:
        item.status = "skipped"
        item.error = "Lead hittades inte"
        db.commit()
        return {"done": False, "error": "Lead hittades inte", "remaining": db.query(DialerQueueItem).filter(DialerQueueItem.session_id == session.id, DialerQueueItem.status == "queued").count()}

    result = twilio.initiate_call(lead.phone, lead.id)
    item.called_at = datetime.utcnow()
    if result["success"]:
        call = Call(
            lead_id=lead.id,
            twilio_sid=result["call_sid"],
            status="initiated",
            direction="outbound",
            call_source="dialer",
            dialer_session_id=session.id,
        )
        db.add(call)
        lead.last_contacted = datetime.utcnow()
        item.status = "called"
    else:
        item.status = "failed"
        item.error = result.get("error")

    session.current_index += 1
    db.commit()

    remaining = db.query(DialerQueueItem).filter(
        DialerQueueItem.session_id == session.id,
        DialerQueueItem.status == "queued"
    ).count()

    return {
        "done": False,
        "success": result["success"],
        "lead": {"id": lead.id, "name": lead.name, "phone": lead.phone},
        "call_sid": result.get("call_sid"),
        "remaining": remaining,
        "error": result.get("error"),
    }

@app.post("/api/dialer/stop")
def stop_dialer(db: Session = Depends(get_db), user=Depends(get_current_user)):
    session = db.query(DialerSession).filter(
        DialerSession.owner == user["sub"],
        DialerSession.status == "running"
    ).order_by(DialerSession.created_at.desc()).first()
    if session:
        session.status = "stopped"
        db.commit()
    return {"stopped": True}

@app.get("/api/dialer/status")
def dialer_status(db: Session = Depends(get_db), user=Depends(get_current_user)):
    session = db.query(DialerSession).filter(
        DialerSession.owner == user["sub"]
    ).order_by(DialerSession.created_at.desc()).first()
    if not session:
        return {"active": False, "session_id": None, "total": 0, "done": 0}

    total = db.query(DialerQueueItem).filter(DialerQueueItem.session_id == session.id).count()
    done = db.query(DialerQueueItem).filter(
        DialerQueueItem.session_id == session.id,
        DialerQueueItem.status.in_(["called", "failed", "skipped"])
    ).count()
    return {
        "active": session.status == "running",
        "session_id": session.id,
        "status": session.status,
        "total": total,
        "done": done,
    }

# ─── REMINDERS ───────────────────────────────────────────────────────────────

@app.get("/api/reminders/today", response_model=list[ReminderResponse])
def get_todays_reminders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    today_start = datetime.combine(date.today(), datetime.min.time())
    tomorrow_start = today_start + timedelta(days=1)
    return db.query(Reminder).filter(
        and_(Reminder.due_at < tomorrow_start, Reminder.completed == False)
    ).order_by(Reminder.due_at).all()

@app.get("/api/reminders", response_model=list[ReminderResponse])
def get_all_reminders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Reminder).filter(Reminder.completed == False).order_by(Reminder.due_at).all()

@app.post("/api/reminders", response_model=ReminderResponse)
def create_reminder(reminder: ReminderCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if reminder.lead_id is not None:
        lead = db.query(Lead).filter(Lead.id == reminder.lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead för påminnelsen hittades inte")

    db_reminder = Reminder(**reminder.dict())
    db_reminder.due_date = db_reminder.due_at.date()
    db.add(db_reminder)
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@app.put("/api/reminders/{reminder_id}/complete")
def complete_reminder(reminder_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Påminnelse hittades inte")
    reminder.completed = True
    reminder.completed_at = datetime.utcnow()
    db.commit()
    return {"ok": True}

# ─── REPORTS / DASHBOARD ─────────────────────────────────────────────────────

@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db), user=Depends(get_current_user)):
    today = date.today()
    total_leads = db.query(func.count(Lead.id)).scalar()
    leads_by_status = db.query(Lead.status, func.count(Lead.id)).group_by(Lead.status).all()
    calls_today = db.query(func.count(Call.id)).filter(
        func.date(Call.created_at) == today
    ).scalar()
    total_calls = db.query(func.count(Call.id)).scalar()
    overdue_reminders = db.query(func.count(Reminder.id)).filter(
        and_(Reminder.due_at < datetime.combine(today, datetime.min.time()), Reminder.completed == False)
    ).scalar()
    upcoming_reminders = db.query(Reminder).filter(
        and_(Reminder.due_at >= datetime.combine(today, datetime.min.time()), Reminder.completed == False)
    ).order_by(Reminder.due_at).limit(5).all()
    
    recent_leads = db.query(Lead).order_by(Lead.created_at.desc()).limit(5).all()
    
    return {
        "total_leads": total_leads,
        "leads_by_status": [{"status": s, "count": c} for s, c in leads_by_status],
        "calls_today": calls_today,
        "total_calls": total_calls,
        "overdue_reminders": overdue_reminders,
        "upcoming_reminders": [
            {
                "id": r.id, "title": r.title, "due_at": r.due_at.isoformat(),
                "lead_id": r.lead_id
            } for r in upcoming_reminders
        ],
        "recent_leads": [
            {"id": l.id, "name": l.name, "company": l.company, "status": l.status}
            for l in recent_leads
        ]
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
    # redeploy
