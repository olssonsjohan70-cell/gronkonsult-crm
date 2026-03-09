import { useState, useEffect } from "react"
import { api } from "../utils/api"
import { StatusBadge, LoadingSpinner, formatDate } from "../components/NotificationBar"

export function Dashboard({ navigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDashboard().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  const statusLabels = {
    new: "Nya", contacted: "Kontaktade", hot: "Heta",
    callback: "Återkommer", customer: "Kunder", dormant: "Vilande", never: "Aldrig"
  }

  const statusColors = {
    new: "var(--blue)", contacted: "var(--purple)", hot: "var(--red)",
    callback: "var(--orange)", customer: "var(--green)", dormant: "var(--text3)", never: "var(--text3)"
  }

  const overdueColor = data?.overdue_reminders > 0 ? "var(--red)" : "var(--green)"

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("leads")}>
          + Ny Lead
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Totalt leads</div>
          <div className="stat-value">{data?.total_leads ?? 0}</div>
          <span className="stat-icon">◉</span>
        </div>
        <div className="stat-card" style={{ "--accent-color": "var(--green)" }}>
          <div className="stat-label">Samtal idag</div>
          <div className="stat-value text-green">{data?.calls_today ?? 0}</div>
          <span className="stat-icon">◎</span>
        </div>
        <div className="stat-card" style={{ "--accent-color": "var(--blue)" }}>
          <div className="stat-label">Totalt samtal</div>
          <div className="stat-value">{data?.total_calls ?? 0}</div>
          <span className="stat-icon">◈</span>
        </div>
        <div className="stat-card" style={{ "--accent-color": overdueColor }}>
          <div className="stat-label">Förfallna påminnelser</div>
          <div className="stat-value" style={{ color: overdueColor }}>{data?.overdue_reminders ?? 0}</div>
          <span className="stat-icon">◷</span>
        </div>
      </div>

      <div className="two-col">
        {/* Lead Status */}
        <div className="card">
          <div className="card-title">Leads per status</div>
          {data?.leads_by_status?.length === 0 ? (
            <p className="text-muted text-sm">Inga leads ännu</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data?.leads_by_status?.map(({ status, count }) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    <div className="dot" style={{ background: statusColors[status] || "var(--text3)" }} />
                    <span style={{ fontSize: 13 }}>{statusLabels[status] || status}</span>
                  </div>
                  <span className="mono bold" style={{ color: statusColors[status] || "var(--text3)" }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming reminders */}
        <div className="card">
          <div className="card-title">Kommande påminnelser</div>
          {data?.upcoming_reminders?.length === 0 ? (
            <p className="text-muted text-sm">Inga kommande påminnelser</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data?.upcoming_reminders?.map(r => (
                <div key={r.id} className="flex items-center justify-between" style={{
                  background: "var(--bg3)",
                  borderRadius: "var(--radius)",
                  padding: "10px 14px",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                    <div className="text-muted text-sm">{formatDate(r.due_date)}</div>
                  </div>
                  {r.lead_id && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate("lead-detail", { leadId: r.lead_id })}
                    >
                      Visa
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent leads */}
      <div className="card mt-24">
        <div className="flex items-center justify-between mb-16">
          <div className="card-title" style={{ margin: 0 }}>Senaste leads</div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("leads")}>Visa alla →</button>
        </div>
        {data?.recent_leads?.length === 0 ? (
          <div className="empty-state">
            <span className="icon">◉</span>
            <p>Inga leads ännu. Lägg till ditt första!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data?.recent_leads?.map(lead => (
              <div
                key={lead.id}
                className="flex items-center justify-between"
                style={{
                  background: "var(--bg3)",
                  borderRadius: "var(--radius)",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
                onClick={() => navigate("lead-detail", { leadId: lead.id })}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{lead.name}</span>
                  {lead.company && <span className="text-muted" style={{ marginLeft: 8, fontSize: 13 }}>{lead.company}</span>}
                </div>
                <StatusBadge status={lead.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
