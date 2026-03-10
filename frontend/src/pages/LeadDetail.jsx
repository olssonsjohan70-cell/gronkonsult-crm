import { useState, useEffect } from "react"
import { api } from "../utils/api"
import { StatusBadge, LoadingSpinner, Modal, STATUS_CONFIG, formatDate, formatDuration } from "../components/NotificationBar"
import { useAuth } from "../App"

const STATUSES = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))

export function LeadDetail({ leadId, navigate }) {
  const { addNotification } = useAuth()
  const [lead, setLead] = useState(null)
  const [calls, setCalls] = useState([])
  const [notes, setNotes] = useState([])
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [newNote, setNewNote] = useState("")
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderForm, setReminderForm] = useState({ title: "", due_at: "", description: "" })
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ title: "Bokat möte", scheduled_at: "", notes: "" })
  const [calling, setCalling] = useState(false)

  const load = async () => {
    setLoading(true)
    const [l, c, n, m] = await Promise.all([
      api.getLead(leadId),
      api.getCallsForLead(leadId),
      api.getNotes(leadId),
      api.getMeetings({ lead_id: leadId }),
    ])
    setLead(l)
    setEditForm(l)
    setCalls(c)
    setNotes(n)
    setMeetings(m)
    setLoading(false)
  }

  useEffect(() => { load() }, [leadId])

  const handleSave = async () => {
    try {
      await api.updateLead(leadId, editForm)
      addNotification("Sparat! ✓", "success")
      setEditing(false)
      load()
    } catch (err) {
      addNotification(err.message, "error")
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Ta bort ${lead.name}? Det går inte att ångra.`)) return
    try {
      await api.deleteLead(leadId)
      addNotification("Lead borttagen", "info")
      navigate("leads")
    } catch (err) {
      addNotification(err.message, "error")
    }
  }

  const handleCall = async () => {
    setCalling(true)
    try {
      await api.initiateCall(leadId)
      addNotification(`Ringer ${lead.name}... 📞`, "success")
      setTimeout(() => { load(); setCalling(false) }, 2000)
    } catch (err) {
      addNotification(err.message, "error")
      setCalling(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    try {
      await api.createNote(leadId, newNote.trim())
      setNewNote("")
      load()
    } catch (err) {
      addNotification(err.message, "error")
    }
  }

  const handleAddReminder = async () => {
    if (!reminderForm.title || !reminderForm.due_at) return
    try {
      await api.createReminder({ ...reminderForm, lead_id: leadId })
      addNotification("Påminnelse satt! ◷", "success")
      setShowReminderModal(false)
      setReminderForm({ title: "", due_at: "", description: "" })
    } catch (err) {
      addNotification(err.message, "error")
    }
  }

  const handleBookMeeting = async () => {
    if (!meetingForm.scheduled_at) return
    try {
      await api.createMeeting({ ...meetingForm, lead_id: leadId })
      addNotification("Möte bokat och påminnelser skapade ✓", "success")
      setShowMeetingModal(false)
      setMeetingForm({ title: "Bokat möte", scheduled_at: "", notes: "" })
      load()
    } catch (err) {
      addNotification(err.message, "error")
    }
  }

  if (loading) return <LoadingSpinner />
  if (!lead) return <div className="text-muted">Lead hittades inte</div>

  const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-8">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("leads")}>← Tillbaka</button>
          <div>
            <h1 className="page-title">{lead.name}</h1>
            {lead.company && <p className="page-subtitle">{lead.company}</p>}
          </div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowReminderModal(true)}>◷ Påminnelse</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowMeetingModal(true)}>📅 Boka möte</button>
          {editing ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setEditForm(lead) }}>Avbryt</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>Spara</button>
            </>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>✎ Redigera</button>
          )}
          <button className="btn btn-call" onClick={handleCall} disabled={calling}>
            {calling ? <span className="loading-ring" style={{ width: 14, height: 14 }} /> : "📞"} Ring nu
          </button>
        </div>
      </div>

      <div className="two-col">
        {/* Left – Lead info */}
        <div>
          <div className="card">
            <div className="card-title">Kontaktinfo</div>

            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Namn</label>
                  <input className="input" value={editForm.name || ""} onChange={e => set("name", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Företag</label>
                  <input className="input" value={editForm.company || ""} onChange={e => set("company", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input className="input" value={editForm.phone || ""} onChange={e => set("phone", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="input" value={editForm.email || ""} onChange={e => set("email", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="input" value={editForm.status || "new"} onChange={e => set("status", e.target.value)}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Uppföljningsdatum</label>
                  <input type="date" className="input" value={editForm.follow_up_date || ""} onChange={e => set("follow_up_date", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Anteckningar</label>
                  <textarea className="input" value={editForm.notes || ""} onChange={e => set("notes", e.target.value)} rows={4} />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <InfoRow label="Status" value={<StatusBadge status={lead.status} />} />
                <InfoRow label="Telefon" value={<a href={`tel:${lead.phone}`} style={{ color: "var(--green)", textDecoration: "none", fontFamily: "DM Mono, monospace" }}>{lead.phone}</a>} />
                {lead.email && <InfoRow label="Email" value={<a href={`mailto:${lead.email}`} style={{ color: "var(--blue)", textDecoration: "none" }}>{lead.email}</a>} />}
                {lead.company && <InfoRow label="Företag" value={lead.company} />}
                <InfoRow label="Källa" value={lead.source || "–"} />
                <InfoRow label="Skapad" value={formatDate(lead.created_at)} />
                {lead.last_contacted && <InfoRow label="Senast kontaktad" value={formatDate(lead.last_contacted)} />}
                {lead.follow_up_date && (
                  <InfoRow label="Uppföljning" value={
                    <span style={{ color: new Date(lead.follow_up_date) < new Date() ? "var(--red)" : "var(--orange)" }}>
                      {formatDate(lead.follow_up_date)}
                    </span>
                  } />
                )}
                {lead.notes && (
                  <div style={{ marginTop: 4 }}>
                    <div className="form-label" style={{ marginBottom: 6 }}>Anteckningar</div>
                    <div style={{
                      background: "var(--bg3)",
                      borderRadius: "var(--radius)",
                      padding: "12px 14px",
                      fontSize: 13.5,
                      color: "var(--text2)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap"
                    }}>
                      {lead.notes}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="divider" />
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>Ta bort lead</button>
          </div>
        </div>

        {/* Right – Activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Notes */}
          <div className="card">
            <div className="card-title">Löpande anteckningar</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                className="input"
                placeholder="Skriv en anteckning..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddNote()}
              />
              <button className="btn btn-primary btn-sm" onClick={handleAddNote} disabled={!newNote.trim()}>+</button>
            </div>
            {notes.length === 0 ? (
              <p className="text-muted text-sm">Inga anteckningar ännu</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {notes.map(note => (
                  <div key={note.id} style={{
                    background: "var(--bg3)",
                    borderRadius: "var(--radius)",
                    padding: "10px 14px",
                  }}>
                    <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>{note.content}</p>
                    <p className="text-muted text-sm" style={{ marginTop: 4 }}>{formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Call history */}
          <div className="card">
            <div className="card-title">Samtalshistorik ({calls.length})</div>
            {calls.length === 0 ? (
              <p className="text-muted text-sm">Inga samtal loggade ännu</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {calls.map(call => (
                  <div key={call.id} style={{
                    background: "var(--bg3)",
                    borderRadius: "var(--radius)",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {call.direction === "outbound" ? "↗ Utgående" : "↙ Ingående"}
                        {call.outcome && <span className="text-muted" style={{ fontWeight: 400, marginLeft: 6 }}>· {call.outcome}</span>}
                      </div>
                      <div className="text-muted text-sm">{formatDate(call.created_at)} · {formatDuration(call.duration)}</div>
                    </div>
                    <div className="flex items-center gap-8">
                      {call.recording_url && (
                        <a
                          href={call.recording_url}
                          target="_blank"
                          className="btn btn-secondary btn-sm"
                          style={{ textDecoration: "none" }}
                        >
                          ▶ Inspelning
                        </a>
                      )}
                      <span className={`badge ${call.status === "completed" ? "badge-customer" : "badge-callback"}`} style={{ fontSize: 10 }}>
                        {call.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Möten ({meetings.length})</div>
            {meetings.length === 0 ? (
              <p className="text-muted text-sm">Inga möten bokade ännu</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {meetings.map(meeting => (
                  <div key={meeting.id} style={{ background: "var(--bg3)", borderRadius: "var(--radius)", padding: "10px 14px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{meeting.title}</div>
                    <div className="text-muted text-sm">{formatDate(meeting.scheduled_at)} · {meeting.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reminder Modal */}
      {showReminderModal && (
        <Modal title="Sätt påminnelse" onClose={() => setShowReminderModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Titel</label>
              <input
                className="input"
                placeholder="t.ex. Följ upp erbjudande"
                value={reminderForm.title}
                onChange={e => setReminderForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Datum</label>
              <input
                type="datetime-local"
                className="input"
                value={reminderForm.due_at}
                onChange={e => setReminderForm(f => ({ ...f, due_at: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Detaljer (valfritt)</label>
              <textarea
                className="input"
                value={reminderForm.description}
                onChange={e => setReminderForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowReminderModal(false)}>Avbryt</button>
            <button
              className="btn btn-primary"
              onClick={handleAddReminder}
              disabled={!reminderForm.title || !reminderForm.due_at}
            >
              Spara påminnelse
            </button>
          </div>
        </Modal>
      )}

      {showMeetingModal && (
        <Modal title="Boka möte" onClose={() => setShowMeetingModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Titel</label>
              <input className="input" value={meetingForm.title} onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Mötestid</label>
              <input type="datetime-local" className="input" value={meetingForm.scheduled_at} onChange={e => setMeetingForm(f => ({ ...f, scheduled_at: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Notering</label>
              <textarea className="input" rows={2} value={meetingForm.notes} onChange={e => setMeetingForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowMeetingModal(false)}>Avbryt</button>
            <button className="btn btn-primary" onClick={handleBookMeeting} disabled={!meetingForm.scheduled_at}>Boka</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="form-label" style={{ fontSize: 11 }}>{label}</span>
      <span style={{ fontSize: 13.5, textAlign: "right" }}>{value}</span>
    </div>
  )
}
