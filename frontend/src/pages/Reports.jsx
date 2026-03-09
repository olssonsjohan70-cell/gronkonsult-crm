import { useState, useEffect } from "react"
import { api } from "../utils/api"
import { LoadingSpinner } from "../components/NotificationBar"

export function Reports({ navigate }) {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDashboard().then(setDashboard).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  const statusConfig = {
    new:       { label: "Ny lead",      color: "#4d9eff" },
    contacted: { label: "Kontaktad",    color: "#9b6dff" },
    hot:       { label: "Het",          color: "#ff5c5c" },
    callback:  { label: "Återkommer",   color: "#ff9f40" },
    customer:  { label: "Kund",         color: "#3ddc84" },
    dormant:   { label: "Vilande",      color: "#5a6080" },
    never:     { label: "Ring aldrig",  color: "#3a3d55" },
  }

  const totalLeads = dashboard?.total_leads || 0
  const customers = dashboard?.leads_by_status?.find(s => s.status === "customer")?.count || 0
  const hot = dashboard?.leads_by_status?.find(s => s.status === "hot")?.count || 0
  const conversionRate = totalLeads > 0 ? ((customers / totalLeads) * 100).toFixed(1) : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapporter</h1>
          <p className="page-subtitle">Översikt av din försäljningspipeline</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Totalt leads</div>
          <div className="stat-value">{totalLeads}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Kunder</div>
          <div className="stat-value text-green">{customers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Konverteringsgrad</div>
          <div className="stat-value" style={{ color: conversionRate > 10 ? "var(--green)" : "var(--orange)" }}>
            {conversionRate}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Totalt samtal</div>
          <div className="stat-value">{dashboard?.total_calls || 0}</div>
        </div>
      </div>

      <div className="two-col">
        {/* Pipeline funnel */}
        <div className="card">
          <div className="card-title">Pipeline-fördelning</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dashboard?.leads_by_status?.map(({ status, count }) => {
              const cfg = statusConfig[status] || { label: status, color: "var(--text3)" }
              const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0
              return (
                <div key={status}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{cfg.label}</span>
                    <span className="mono" style={{ fontSize: 13, color: cfg.color }}>{count}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--bg3)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: cfg.color,
                      borderRadius: 4,
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-title">Pipeline-hälsa</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Insight
                icon="🔥"
                label="Heta leads att stänga"
                value={hot}
                color="var(--red)"
                note={hot > 0 ? "Prioritera dessa nu!" : "Inga heta leads just nu"}
              />
              <Insight
                icon="💬"
                label="Väntar på återkoppling"
                value={dashboard?.leads_by_status?.find(s => s.status === "callback")?.count || 0}
                color="var(--orange)"
                note="Ring upp dessa"
              />
              <Insight
                icon="✅"
                label="Konverterade kunder"
                value={customers}
                color="var(--green)"
                note={`${conversionRate}% konverteringsgrad`}
              />
              <Insight
                icon="❄️"
                label="Vilande leads"
                value={dashboard?.leads_by_status?.find(s => s.status === "dormant")?.count || 0}
                color="var(--text3)"
                note="Potentiell framtida pipeline"
              />
            </div>
          </div>

          <div className="card">
            <div className="card-title">Samtalsaktivitet</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Insight
                icon="📞"
                label="Samtal totalt"
                value={dashboard?.total_calls || 0}
                color="var(--blue)"
              />
              <Insight
                icon="📅"
                label="Samtal idag"
                value={dashboard?.calls_today || 0}
                color="var(--purple)"
              />
              <Insight
                icon="⚠"
                label="Förfallna påminnelser"
                value={dashboard?.overdue_reminders || 0}
                color={dashboard?.overdue_reminders > 0 ? "var(--red)" : "var(--green)"}
                note={dashboard?.overdue_reminders > 0 ? "Agera nu!" : "Allt i ordning"}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action suggestions */}
      {(hot > 0 || dashboard?.overdue_reminders > 0) && (
        <div style={{
          marginTop: 20,
          background: "var(--green-glow)",
          border: "1px solid var(--green)",
          borderRadius: "var(--radius-lg)",
          padding: "20px 24px",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: "var(--green)" }}>
            ⚡ Rekommenderade åtgärder
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hot > 0 && (
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 13.5 }}>Du har {hot} heta lead{hot > 1 ? "s" : ""} – ring dem nu</span>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("leads")}>Visa leads →</button>
              </div>
            )}
            {dashboard?.overdue_reminders > 0 && (
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 13.5 }}>{dashboard.overdue_reminders} påminnelse{dashboard.overdue_reminders > 1 ? "r" : ""} har passerat deadline</span>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("reminders")}>Hantera →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Insight({ icon, label, value, color, note }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-8">
        <span style={{ fontSize: 16 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
          {note && <div className="text-muted text-sm">{note}</div>}
        </div>
      </div>
      <span className="mono bold" style={{ fontSize: 20, color }}>{value}</span>
    </div>
  )
}
