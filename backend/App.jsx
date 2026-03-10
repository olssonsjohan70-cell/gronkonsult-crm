import { useState, createContext, useContext } from "react"
import { Dashboard } from "./pages/Dashboard"
import { Leads } from "./pages/Leads"
import { LeadDetail } from "./pages/LeadDetail"
import { Dialer } from "./pages/Dialer"
import { Reminders } from "./pages/Reminders"
import { Reports } from "./pages/Reports"
import { Sidebar } from "./components/Sidebar"
import { NotificationBar } from "./components/NotificationBar"
import "./index.css"

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// No login – open directly
const NO_AUTH_TOKEN = "no-auth"

export default function App() {
  const [page, setPage] = useState("dashboard")
  const [selectedLeadId, setSelectedLeadId] = useState(null)
  const [notifications, setNotifications] = useState([])

  const navigate = (p, extra = null) => {
    setPage(p)
    if (extra?.leadId) setSelectedLeadId(extra.leadId)
  }

  const addNotification = (msg, type = "success") => {
    const id = Date.now()
    setNotifications(prev => [...prev, { id, msg, type }])
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000)
  }

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard navigate={navigate} />
      case "leads": return <Leads navigate={navigate} />
      case "lead-detail": return <LeadDetail leadId={selectedLeadId} navigate={navigate} />
      case "dialer": return <Dialer navigate={navigate} />
      case "reminders": return <Reminders navigate={navigate} />
      case "reports": return <Reports navigate={navigate} />
      default: return <Dashboard navigate={navigate} />
    }
  }

  return (
    <AuthContext.Provider value={{ token: NO_AUTH_TOKEN, addNotification }}>
      <div className="app-shell">
        <Sidebar currentPage={page} navigate={navigate} />
        <main className="main-content">
          <NotificationBar notifications={notifications} />
          {renderPage()}
        </main>
      </div>
    </AuthContext.Provider>
  )
}
