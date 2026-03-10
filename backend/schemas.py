from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date


# ─── LEAD ─────────────────────────────────────────────────────────────────────

class LeadCreate(BaseModel):
    name: str
    company: Optional[str] = ""
    phone: str
    email: Optional[str] = ""
    status: Optional[str] = "new"
    source: Optional[str] = "Manuell"
    notes: Optional[str] = ""
    follow_up_date: Optional[date] = None

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    follow_up_date: Optional[date] = None

class LeadResponse(BaseModel):
    id: int
    name: str
    company: Optional[str]
    phone: str
    email: Optional[str]
    status: str
    source: Optional[str]
    notes: Optional[str]
    follow_up_date: Optional[date]
    last_contacted: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── CALL ─────────────────────────────────────────────────────────────────────

class CallCreate(BaseModel):
    lead_id: int
    outcome: Optional[str] = None

class CallResponse(BaseModel):
    id: int
    lead_id: int
    twilio_sid: Optional[str]
    status: str
    direction: str
    duration: int
    recording_url: Optional[str]
    outcome: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── REMINDER ─────────────────────────────────────────────────────────────────

class ReminderCreate(BaseModel):
    lead_id: Optional[int] = None
    title: str
    description: Optional[str] = ""
    due_date: date

class ReminderResponse(BaseModel):
    id: int
    lead_id: Optional[int]
    title: str
    description: Optional[str]
    due_date: date
    completed: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── NOTE ─────────────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    content: str

class NoteResponse(BaseModel):
    id: int
    lead_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── DASHBOARD ────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_leads: int
    calls_today: int
    total_calls: int
    overdue_reminders: int
