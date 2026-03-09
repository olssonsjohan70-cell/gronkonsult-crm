from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Boolean, ForeignKey, Float
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
    duration = Column(Integer, default=0)  # seconds
    recording_url = Column(String(500), nullable=True)
    recording_sid = Column(String(100), nullable=True)
    outcome = Column(String(50), nullable=True)  # answered, no-answer, busy, failed
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="calls")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, default="")
    due_date = Column(Date, nullable=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="reminders")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="notes_list")
