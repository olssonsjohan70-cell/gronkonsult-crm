import { useState, useEffect } from "react"
import { api } from "../utils/api"
import { StatusBadge, LoadingSpinner } from "../components/NotificationBar"
import { useAuth } from "../App"

export function Dialer({ navigate }) {
  const { addNotification } = useAuth()
  const [leads, setLeads] = useState([])
  const [selected, setSelected] = useState([])
  const [statusFilter, setStatusFilter] = useState("new")
  const [loading, setLoading] = useState(false)
  const [dialerRunning, setDialerRunning] = useState(false)
  const [currentCall, setCurrentCall] = useState(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [callResults, setCallResults] = useState([])
  const [pauseSeconds, setPauseSeconds] = useState(5)
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [timer, setTimer] = useState(null)

  const loadLeads = async () => {
    setLoading(true)
    const data = await api.getLeads({ status: statusFilter })
    setLeads(data)
    setSelected(data.map(l => l.id))
    setLoading(false)
  }

  useEffect(() => { loadLeads() }, [statusFilter])

  const toggleLead = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  const startDialer = async () => {
    if (selected.length === 0) {
      addNotification("Välj minst en lead att ringa", "error")
      return
    }
    try {
      await api.startDialer({ lead_ids: selected })
      setDialerRunning(true)
      setCallResults([])
      setProgress({ done: 0, total: selected.length })
      addNotification(`Startar auto dialer – ${selected.length} samtal`, "success")
      dialNext()
    } catch (err) {
      addNotification(err.message, "error")
    }
  }

  const dialNext = async () => {
    try {
      const res = await api.dialerNext()
      if (res.done) {
        setDialerRunning(false)
        setCurrentCall(null)
        addNotification(`Dialer klar! Ringde ${callResults.length + (currentCall ? 1 : 0)} samtal`, "success")
        return
      }
      setCurrentCall(res.lead)
      setProgress(p => ({ ...p, done: p.done + 1 }))
      setCallResults(r => [...r, { ...res.lead, time: new Date().toLocaleTimeString("sv-SE") }])

      if (autoAdvance) {
        const t = setTimeout(dialNext, pauseSeconds * 1000)
        setTimer(t)
      }
    } catch (err) {
      addNotification(err.message, "error")
      setDialerRunning(false)
    }
  }

  const stopDialer = async () => {
    if (timer) clearTimeout(timer)
    await api.stopDialer()
    setDialerRunning(false)
    setCurrentCall(null)
    addNotification("Dialer stoppad", "info")
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Auto Dialer</h1>
          <p className="page-subtitle">Sekventiell uppringning från lead-lista</p>
        </div>
      </div>

      <div className="two-col">
        {/* Left – Config */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-title">Konfiguration</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Filtrera leads på status</label>
                <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} disabled={dialerRunning}>
                  <option value="new">🌱 Nya leads</option>
                  <option value="callback">💬 Återkommer</option>
                  <option value="contacted">📞 Kontaktade</option>
                  <option value="hot">🔥 Heta</option>
                  <option value="dormant">❄️ Vilande</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Paus mellan samtal (sekunder)</label>
                <input
                  type="number"
                  className="input"
                  value={pauseSeconds}
                  onChange={e => setPauseSeconds(Number(e.target.value))}
                  min={3} max={60}
                  disabled={dialerRunning}
                />
              </div>

              <div className="flex items-center gap-8" style={{ cursor: "pointer" }} onClick={() => !dialerRunning && setAutoAdvance(a => !a)}>
                <div style={{
                  width: 36, height: 20,
                  borderRadius: 10,
                  background: autoAdvance ? "var(--green)" : "var(--border2)",
                  position: "relative",
                  transition: "background 0.2s",
                }}>
                  <div style={{
                    position: "absolute",
                    top: 3, left: autoAdvance ? 18 : 3,
                    width: 14, height: 14,
                    borderRadius: "50%",
                    background: "white",
                    transition: "left 0.2s",
                  }} />
                </div>
                <span style={{ fontSize: 13.5 }}>Auto-avancera automatiskt</span>
              </div>

              <div style={{
                background: "var(--bg3)",
                borderRadius: "var(--radius)",
                padding: "12px 14px",
                fontSize: 12.5,
                color: "var(--text3)",
                lineHeight: 1.6,
              }}>
                {autoAdvance
                  ? `Systemet ringer automatiskt nästa lead efter ${pauseSeconds}s`
                  : "Du trycker manuellt på 'Nästa samtal' när du är klar"}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="card">
            <div className="card-title">Kontroll</div>

            {dialerRunning ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {currentCall && (
                  <div style={{
                    background: "var(--green-glow)",
                    border: "1px solid var(--green)",
                    borderRadius: "var(--radius)",
                    padding: "14px 16px",
                  }}>
                    <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
                      <span className="dot dot-green" style={{ animation: "spin 1.5s linear infinite" }} />
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--green)" }}>
                        Ringer nu
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{currentCall.name}</div>
                    <div className="mono text-muted" style={{ fontSize: 12 }}>{currentCall.phone}</div>
                  </div>
                )}

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-sm text-muted" style={{ marginBottom: 6 }}>
                    <span>{progress.done} / {progress.total} samtal</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: "var(--green)",
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>

                <div className="flex gap-8">
                  {!autoAdvance && (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={dialNext}>
                      Nästa samtal →
                    </button>
                  )}
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={stopDialer}>
                    ■ Stoppa
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "12px" }}
                onClick={startDialer}
                disabled={selected.length === 0 || loading}
              >
                ▶ Starta dialer ({selected.length} leads)
              </button>
            )}
          </div>

          {/* Results */}
          {callResults.length > 0 && (
            <div className="card">
              <div className="card-title">Sessionsresultat</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {callResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between" style={{
                    fontSize: 13, padding: "6px 0",
                    borderBottom: "1px solid var(--border)",
                  }}>
                    <span>{r.name}</span>
                    <span className="text-muted text-sm mono">{r.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right – Lead list */}
        <div className="card">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ margin: 0 }}>Leads i kö ({selected.length}/{leads.length})</div>
            <div className="flex gap-8">
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(leads.map(l => l.id))}>Alla</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected([])}>Ingen</button>
            </div>
          </div>

          {loading ? <LoadingSpinner /> : leads.length === 0 ? (
            <div className="empty-state">
              <span className="icon">◉</span>
              <p>Inga leads med vald status</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 500, overflowY: "auto" }}>
              {leads.map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center gap-8"
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius)",
                    background: selected.includes(lead.id) ? "var(--bg3)" : "transparent",
                    border: `1px solid ${selected.includes(lead.id) ? "var(--border2)" : "transparent"}`,
                    cursor: dialerRunning ? "not-allowed" : "pointer",
                    opacity: dialerRunning ? 0.7 : 1,
                    transition: "all 0.15s",
                  }}
                  onClick={() => !dialerRunning && toggleLead(lead.id)}
                >
                  <div style={{
                    width: 16, height: 16,
                    borderRadius: 4,
                    border: `2px solid ${selected.includes(lead.id) ? "var(--green)" : "var(--border2)"}`,
                    background: selected.includes(lead.id) ? "var(--green)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#000",
                    flexShrink: 0,
                  }}>
                    {selected.includes(lead.id) && "✓"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.name}</div>
                    {lead.company && <div className="text-muted text-sm">{lead.company}</div>}
                  </div>
                  <div className="mono text-muted" style={{ fontSize: 11 }}>{lead.phone}</div>
                  <div style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); navigate("lead-detail", { leadId: lead.id }) }}>
                    <StatusBadge status={lead.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
