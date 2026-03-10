from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    company = Column(String(200))
    phone = Column(String(50), unique=True, index=True)
    email = Column(String(200))
    status = Column(String(50), default="new")  # new, contacted, hot, callback, customer, dormant, never
    source = Column(String(100), default="Manuell")
    notes = Column(Text, default="")
    follow_up_date = Column(Date, nullable=True)
    last_contacted = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    calls = relationship("Call", back_populates="lead", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="lead", cascade="all, delete-orphan")
    notes_list = relationship("Note", back_populates="lead", cascade="all, delete-orphan")


class Call(Base):
    __tablename__ = "calls"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"))
    twilio_sid = Column(String(100), unique=True, nullable=True)
    status = Column(String(50), default="initiated")
    direction = Column(String(20), default="outbound")
    call_source = Column(String(20), default="manual")  # manual, dialer, inbound
    dialer_session_id = Column(Integer, ForeignKey("dialer_sessions.id"), nullable=True)
    duration = Column(Integer, default=0)  # seconds
    recording_url = Column(String(500), nullable=True)
    recording_sid = Column(String(100), nullable=True)
    outcome = Column(String(50), nullable=True)  # answered, no-answer, busy, failed
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="calls")
    dialer_session = relationship("DialerSession", back_populates="calls")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    title = Column(String(300), nullable=False, default="Bokat möte")
    scheduled_at = Column(DateTime, nullable=False, index=True)
    timezone = Column(String(50), default="Europe/Stockholm")
    status = Column(String(50), default="scheduled")  # scheduled, completed, canceled, no_show
    notes = Column(Text, default="")
    outcome = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lead = relationship("Lead")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, default="")
    due_at = Column(DateTime, nullable=False, index=True)
    due_date = Column(Date, nullable=True)  # legacy support
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=True)
    type = Column(String(50), default="manual")  # manual, meeting_24h, meeting_1h, followup
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="reminders")
    meeting = relationship("Meeting")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="notes_list")


class DialerSession(Base):
    __tablename__ = "dialer_sessions"

    id = Column(Integer, primary_key=True, index=True)
    owner = Column(String(100), default="admin", index=True)
    status = Column(String(30), default="running", index=True)  # running, paused, completed, stopped
    current_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    queue_items = relationship("DialerQueueItem", back_populates="session", cascade="all, delete-orphan")
    calls = relationship("Call", back_populates="dialer_session")


class DialerQueueItem(Base):
    __tablename__ = "dialer_queue_items"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("dialer_sessions.id"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    position = Column(Integer, nullable=False)
    status = Column(String(30), default="queued")  # queued, called, failed, skipped
    error = Column(Text, nullable=True)
    called_at = Column(DateTime, nullable=True)

    session = relationship("DialerSession", back_populates="queue_items")
    lead = relationship("Lead")
