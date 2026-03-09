import { useState, useEffect } from "react"
import { api } from "../utils/api"
import { LoadingSpinner, Modal, formatDate } from "../components/NotificationBar"
import { useAuth } from "../App"

export function Reminders({ navigate }) {
  const { addNotification } = useAuth()
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: "", due_date: "", description: "", lead_id: "" })
  const [filter, setFilter] = useState("upcoming")

  const load = async () => {
    setLoading(true)
    const data = await api.getAllReminders()
    setReminders(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    if (!form.title || !form.due_date) return
    try {
      await api.createReminder({
        ...form,
        lead_id: form.lead_id ? Number(form.lead_id) : null
      })
      addNotification("Påminnelse skapad! ◷", "success")
      setShowModal(false)
      setForm({ title: "", due_date: "", description: "", lead_id: "" })
      load()
    } catch (err) {
      addNotification(err.message, "error")
    }
  }

  const handleComplete = async (id) => {
    try {
      await api.completeReminder(id)
      addNotification("Påminnelse avklarad ✓", "success")
      load()
    } catch (err) {
      addNotification(err.message, "error")
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filtered = reminders.filter(r => {
    const d = new Date(r.due_date)
    if (filter === "overdue") return d < today
    if (filter === "today") return d.toDateString() === today.toDateString()
    if (filter === "upcoming") return d >= today
    return true
  })

  const counts = {
    overdue: reminders.filter(r => new Date(r.due_date) < today).length,
    today: reminders.filter(r => new Date(r.due_date).toDateString() === today.toDateString()).length,
    upcoming: reminders.filter(r => new Date(r.due_date) >= today).length,
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Påminnelser</h1>
          <p className="page-subtitle">{counts.today} idag · {counts.overdue} förfallna</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Ny påminnelse</button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-8 mb-16">
        {[
          { key: "overdue", label: `Förfallna (${counts.overdue})`, color: "var(--red)" },
          { key: "today", label: `Idag (${counts.today})`, color: "var(--orange)" },
          { key: "upcoming", label: `Kommande (${counts.upcoming})`, color: "var(--green)" },
        ].map(tab => (
          <button
            key={tab.key}
            className={`btn btn-sm ${filter === tab.key ? "btn-primary" : "btn-secondary"}`}
            style={filter === tab.key ? { background: tab.color, color: "#000" } : {}}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="icon">◷</span>
          <p>Inga påminnelser i den här kategorin</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map(r => {
            const d = new Date(r.due_date)
            const isOverdue = d < today
            const isToday = d.toDateString() === today.toDateString()

            return (
              <div key={r.id} style={{
                background: "var(--bg2)",
                border: `1px solid ${isOverdue ? "rgba(255,92,92,0.3)" : isToday ? "rgba(255,159,64,0.3)" : "var(--border)"}`,
                borderRadius: "var(--radius-lg)",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}>
                <button
                  style={{
                    width: 22, height: 22,
                    borderRadius: "50%",
                    border: `2px solid ${isOverdue ? "var(--red)" : "var(--border2)"}`,
                    background: "transparent",
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "transparent",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.target.style.background = "var(--green)"; e.target.style.borderColor = "var(--green)"; e.target.style.color = "#000" }}
                  onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.borderColor = isOverdue ? "var(--red)" : "var(--border2)"; e.target.style.color = "transparent" }}
                  onClick={() => handleComplete(r.id)}
                  title="Markera som klar"
                >
                  ✓
                </button>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                  {r.description && <div className="text-muted text-sm" style={{ marginTop: 2 }}>{r.description}</div>}
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isOverdue ? "var(--red)" : isToday ? "var(--orange)" : "var(--text2)"
                  }}>
                    {isToday ? "⚡ Idag" : isOverdue ? `⚠ ${formatDate(r.due_date)}` : formatDate(r.due_date)}
                  </div>
                  {r.lead_id && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 4, fontSize: 11 }}
                      onClick={() => navigate("lead-detail", { leadId: r.lead_id })}
                    >
                      Visa lead
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Ny påminnelse" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Titel *</label>
              <input className="input" placeholder="t.ex. Ring upp efter semester" value={form.title} onChange={e => set("title", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Datum *</label>
              <input type="date" className="input" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Lead-ID (valfritt)</label>
              <input className="input" placeholder="Lead-ID om kopplad till ett lead" value={form.lead_id} onChange={e => set("lead_id", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Detaljer</label>
              <textarea className="input" value={form.description} onChange={e => set("description", e.target.value)} rows={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Avbryt</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!form.title || !form.due_date}>
              Skapa påminnelse
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
