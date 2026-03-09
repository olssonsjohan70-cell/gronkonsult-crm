export function NotificationBar({ notifications }) {
  return (
    <div className="notification-bar">
      {notifications.map(n => (
        <div key={n.id} className={`notification ${n.type}`}>
          {n.msg}
        </div>
      ))}
    </div>
  )
}

export const STATUS_CONFIG = {
  new:       { label: "🌱 Ny lead",      cls: "badge-new" },
  contacted: { label: "📞 Kontaktad",    cls: "badge-contacted" },
  hot:       { label: "🔥 Het",          cls: "badge-hot" },
  callback:  { label: "💬 Återkommer",   cls: "badge-callback" },
  customer:  { label: "✅ Kund",         cls: "badge-customer" },
  dormant:   { label: "❄️ Vilande",      cls: "badge-dormant" },
  never:     { label: "🚫 Aldrig",       cls: "badge-never" },
}

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}

export function LoadingSpinner() {
  return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="loading-ring" /></div>
}

export function Modal({ title, children, onClose, footer }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex items-center justify-between mb-16">
          <h2 className="modal-title" style={{ margin: 0 }}>{title}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function formatDate(dt) {
  if (!dt) return "–"
  return new Date(dt).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })
}

export function formatDuration(seconds) {
  if (!seconds) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}
