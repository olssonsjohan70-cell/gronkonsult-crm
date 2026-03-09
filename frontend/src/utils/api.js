const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Okänt fel" }))
    throw new Error(err.detail || "Serverfel")
  }
  return res.json()
}

export const api = {
  // Auth
  login: (password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),

  // Leads
  getLeads: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/api/leads${q ? "?" + q : ""}`)
  },
  getLead: (id) => request(`/api/leads/${id}`),
  createLead: (data) => request("/api/leads", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id, data) => request(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteLead: (id) => request(`/api/leads/${id}`, { method: "DELETE" }),

  // CSV
  exportCSV: () => {
    fetch(`${BASE}/api/leads/export/csv`)
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = "leads.csv"
        a.click()
      })
  },
  importCSV: (file) => {
    const form = new FormData()
    form.append("file", file)
    return fetch(`${BASE}/api/leads/import/csv`, {
      method: "POST",
      body: form,
    }).then(r => r.json())
  },

  // Notes
  getNotes: (leadId) => request(`/api/leads/${leadId}/notes`),
  createNote: (leadId, content) => request(`/api/leads/${leadId}/notes`, {
    method: "POST", body: JSON.stringify({ content })
  }),

  // Calls
  initiateCall: (leadId) => request(`/api/calls/initiate/${leadId}`, { method: "POST" }),
  getCallsForLead: (leadId) => request(`/api/calls/lead/${leadId}`),
  getRecentCalls: () => request("/api/calls/recent"),

  // Dialer
  startDialer: (data) => request("/api/dialer/start", { method: "POST", body: JSON.stringify(data) }),
  dialerNext: () => request("/api/dialer/next", { method: "POST" }),
  stopDialer: () => request("/api/dialer/stop", { method: "POST" }),
  dialerStatus: () => request("/api/dialer/status"),

  // Reminders
  getTodayReminders: () => request("/api/reminders/today"),
  getAllReminders: () => request("/api/reminders"),
  createReminder: (data) => request("/api/reminders", { method: "POST", body: JSON.stringify(data) }),
  completeReminder: (id) => request(`/api/reminders/${id}/complete`, { method: "PUT" }),

  // Dashboard
  getDashboard: () => request("/api/dashboard"),
}
