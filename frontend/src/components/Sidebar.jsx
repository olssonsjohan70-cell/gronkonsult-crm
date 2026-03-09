export function Sidebar({ currentPage, navigate }) {
  const items = [
    { id: "dashboard", icon: "◈", label: "Dashboard" },
    { id: "leads", icon: "◉", label: "Leads" },
    { id: "dialer", icon: "◎", label: "Auto Dialer" },
    { id: "reminders", icon: "◷", label: "Påminnelser" },
    { id: "reports", icon: "◫", label: "Rapporter" },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>🌿 Grön Konsult</h1>
        <span>CRM System v1.0</span>
      </div>

      <nav>
        {items.map(item => (
          <div
            key={item.id}
            className={`nav-item ${currentPage === item.id || (currentPage === "lead-detail" && item.id === "leads") ? "active" : ""}`}
            onClick={() => navigate(item.id)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="text-muted text-sm" style={{ padding: "0 8px" }}>🌿 Grön Konsult CRM</div>
      </div>
    </aside>
  )
}
