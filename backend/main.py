from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import uvicorn
import io
import csv
from datetime import datetime, date
from typing import Optional
import json

from database import engine, Base, get_db
from models import Lead, Call, Reminder, Note
from schemas import (
    LeadCreate, LeadUpdate, LeadResponse,
    CallCreate, CallResponse,
    ReminderCreate, ReminderResponse,
    NoteCreate, NoteResponse,
    DashboardStats
)
from twilio_service import TwilioService
from auth import create_token, verify_token, hash_password, verify_password
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

twilio = TwilioService()

# Auth disabled – single user, opens directly
def get_current_user():
    return {"sub": "admin"}

# ─── LEADS ───────────────────────────────────────────────────────────────────

@app.get("/api/leads", response_model=list[LeadResponse])
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

@app.post("/api/leads"
def create_lead(lead: LeadCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_lead = Lead(**lead.dict())
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead

@app.get("/api/leads/{lead_id}", response_model=LeadResponse)
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
    for field, value in lead_update.dict(exclude_unset=True).items():
        setattr(lead, field, value)
    lead.updated_at = datetime.utcnow()
    db.commit()
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
    result = twilio.initiate_call(lead.phone, lead_id)
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

@app.post("/api/calls/webhook")
async def call_webhook(request_body: dict = None, db: Session = Depends(get_db)):
    """Twilio webhook – uppdaterar samtalsstatus"""
    from fastapi import Request
    return {"status": "ok"}

@app.post("/api/calls/status-callback")
async def status_callback(db: Session = Depends(get_db)):
    return {"status": "ok"}

@app.get("/api/calls/lead/{lead_id}", response_model=list[CallResponse])
def get_calls_for_lead(lead_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Call).filter(Call.lead_id == lead_id).order_by(Call.created_at.desc()).all()

@app.get("/api/calls/recent", response_model=list[CallResponse])
def get_recent_calls(limit: int = 20, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Call).order_by(Call.created_at.desc()).limit(limit).all()

# ─── AUTO DIALER ─────────────────────────────────────────────────────────────

dialer_state = {"active": False, "queue": [], "current_index": 0, "results": []}

@app.post("/api/dialer/start")
def start_dialer(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    lead_ids = data.get("lead_ids", [])
    if not lead_ids:
        status_filter = data.get("status", "new")
        leads = db.query(Lead).filter(Lead.status == status_filter).all()
        lead_ids = [l.id for l in leads]
    
    dialer_state["active"] = True
    dialer_state["queue"] = lead_ids
    dialer_state["current_index"] = 0
    dialer_state["results"] = []
    return {"started": True, "total": len(lead_ids)}

@app.post("/api/dialer/next")
def dialer_next(db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not dialer_state["active"]:
        return {"done": True}
    idx = dialer_state["current_index"]
    if idx >= len(dialer_state["queue"]):
        dialer_state["active"] = False
        return {"done": True, "results": dialer_state["results"]}
    
    lead_id = dialer_state["queue"][idx]
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    dialer_state["current_index"] += 1
    
    result = twilio.initiate_call(lead.phone, lead_id)
    if result["success"]:
        call = Call(lead_id=lead_id, twilio_sid=result["call_sid"], status="initiated", direction="outbound")
        db.add(call)
        lead.last_contacted = datetime.utcnow()
        db.commit()
    
    return {
        "done": False,
        "lead": {"id": lead.id, "name": lead.name, "phone": lead.phone},
        "call_sid": result.get("call_sid"),
        "remaining": len(dialer_state["queue"]) - dialer_state["current_index"]
    }

@app.post("/api/dialer/stop")
def stop_dialer(user=Depends(get_current_user)):
    dialer_state["active"] = False
    return {"stopped": True}

@app.get("/api/dialer/status")
def dialer_status(user=Depends(get_current_user)):
    return dialer_state

# ─── REMINDERS ───────────────────────────────────────────────────────────────

@app.get("/api/reminders/today", response_model=list[ReminderResponse])
def get_todays_reminders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    today = date.today()
    return db.query(Reminder).filter(
        and_(Reminder.due_date <= today, Reminder.completed == False)
    ).order_by(Reminder.due_date).all()

@app.get("/api/reminders", response_model=list[ReminderResponse])
def get_all_reminders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Reminder).filter(Reminder.completed == False).order_by(Reminder.due_date).all()

@app.post("/api/reminders", response_model=ReminderResponse)
def create_reminder(reminder: ReminderCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_reminder = Reminder(**reminder.dict())
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
        and_(Reminder.due_date < today, Reminder.completed == False)
    ).scalar()
    upcoming_reminders = db.query(Reminder).filter(
        and_(Reminder.due_date >= today, Reminder.completed == False)
    ).order_by(Reminder.due_date).limit(5).all()
    
    recent_leads = db.query(Lead).order_by(Lead.created_at.desc()).limit(5).all()
    
    return {
        "total_leads": total_leads,
        "leads_by_status": [{"status": s, "count": c} for s, c in leads_by_status],
        "calls_today": calls_today,
        "total_calls": total_calls,
        "overdue_reminders": overdue_reminders,
        "upcoming_reminders": [
            {
                "id": r.id, "title": r.title, "due_date": str(r.due_date),
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
