import { useState, useEffect, useRef } from "react"
import { api } from "../utils/api"
import { StatusBadge, LoadingSpinner, Modal, STATUS_CONFIG } from "../components/NotificationBar"
import { useAuth } from "../App"

const STATUSES = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))

function LeadForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    name: "", company: "", phone: "", email: "",
    status: "new", source: "Manuell", notes: "", follow_up_date: ""
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Namn *</label>
          <input className="input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Johan Andersson" />
        </div>
        <div className="form-group">
          <label className="form-label">Företag</label>
          <input className="input" value={form.company} onChange={e => set("company", e.target.value)} placeholder="AB Företaget" />
        </div>
        <div className="form-group">
          <label className="form-label">Telefon *</label>
          <input className="input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+46701234567" />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="input" value={form.email} onChange={e => set("email", e.target.value)} placeholder="johan@foretaget.se" />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Källa</label>
          <input className="input" value={form.source} onChange={e => set("source", e.target.value)} placeholder="LinkedIn, Mässa..." />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Uppföljningsdatum</label>
        <input type="date" className="input" value={form.follow_up_date || ""} onChange={e => set("follow_up_date", e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Anteckningar</label>
        <textarea className="input" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Anteckna vad som diskuterades..." rows={3} />
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Avbryt</button>
        <button
          className="btn btn-primary"
          onClick={() => onSave(form)}
          disabled={!form.name || !form.phone}
        >
          {initial ? "Spara ändringar" : "Lägg till lead"}
        </button>
      </div>
    </div>
  )
}

export function Leads({ navigate }) {
  const { addNotification } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const load = async () => {
    setLoading(true)
    const params = {}
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    const data = await api.getLeads(params)
    setLeads(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [search, statusFilter])

  const handleCreate = async (form) => {
    try {
      await api.createLead(form)
      addNotification("Lead skapad! 🌱", "success")
      setShowModal(false)
      load()
    } catch (err) {
      addNotification(err.message, "error")
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    try {
      const res = await api.importCSV(file)
      addNotification(`Importerade ${res.created} leads. Hoppade över ${res.skipped}.`, "success")
      load()
    } catch (err) {
      addNotification("Import misslyckades", "error")
    } finally {
      setImporting(false)
      fileRef.current.value = ""
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">{leads.length} kontakter</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm" onClick={api.exportCSV}>
            ↓ Exportera CSV
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fileRef.current.click()}
            disabled={importing}
          >
            {importing ? <span className="loading-ring" style={{ width: 14, height: 14 }} /> : "↑ Importera CSV"}
          </button>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleImport} />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Ny Lead</button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="search-bar">
        <div className="search-input-wrap" style={{ flex: 1 }}>
          <span className="icon">◎</span>
          <input
            className="input"
            placeholder="Sök på namn, företag, telefon..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select
          className="input"
          style={{ width: 180 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">Alla statusar</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? <LoadingSpinner /> : (
        leads.length === 0 ? (
          <div className="empty-state">
            <span className="icon">◉</span>
            <p>Inga leads hittades. Lägg till ditt första!</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Företag</th>
                  <th>Telefon</th>
                  <th>Status</th>
                  <th>Uppföljning</th>
                  <th>Skapad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} onClick={() => navigate("lead-detail", { leadId: lead.id })}>
                    <td style={{ fontWeight: 600 }}>{lead.name}</td>
                    <td className="text-muted">{lead.company || "–"}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{lead.phone}</td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td className="text-sm text-muted">
                      {lead.follow_up_date ? (
                        <span style={{ color: new Date(lead.follow_up_date) < new Date() ? "var(--red)" : "var(--text2)" }}>
                          {new Date(lead.follow_up_date).toLocaleDateString("sv-SE")}
                        </span>
                      ) : "–"}
                    </td>
                    <td className="text-sm text-muted">
                      {new Date(lead.created_at).toLocaleDateString("sv-SE")}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-call btn-sm"
                        onClick={async (e) => {
                          e.stopPropagation()
                          try {
                            await api.initiateCall(lead.id)
                            addNotification(`Ringer ${lead.name}... 📞`, "success")
                          } catch (err) {
                            addNotification(err.message, "error")
                          }
                        }}
                      >
                        📞 Ring
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {showModal && (
        <Modal title="Lägg till ny lead" onClose={() => setShowModal(false)}>
          <LeadForm onSave={handleCreate} onClose={() => setShowModal(false)} />
        </Modal>
      )}
    </div>
  )
}
