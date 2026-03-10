const BASE = "https://gronkonsult-crm-production.up.railway.app"

async function request(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: controller.signal
    })

    clearTimeout(timeout)

    const text = await res.text()

    if (!res.ok) {
      let msg = "Serverfel"
      try {
        const json = JSON.parse(text)
        msg = json.detail || msg
      } catch {}
      throw new Error(msg)
    }

    if (!text) return null

    try {
      return JSON.parse(text)
    } catch {
      return text
    }

  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Servern svarar inte (timeout)")
    }
    throw err
  }
}

export const api = {

  // Auth
  login: (password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password })
    }),

  // Leads
  getLeads: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/api/leads${q ? "?" + q : ""}`)
  },

  getLead: (id) =>
    request(`/api/leads/${id}`),

  createLead: (data) =>
    request("/api/leads", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateLead: (id, data) =>
    request(`/api/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  deleteLead: (id) =>
    request(`/api/leads/${id}`, {
      method: "DELETE"
    }),

  // CSV
  exportCSV: async () => {
    const res = await fetch(`${BASE}/api/leads/export/csv`)
    if (!res.ok) throw new Error("CSV export misslyckades")

    const blob = await res.blob()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "leads.csv"
    a.click()
  },

  importCSV: async (file) => {
    const form = new FormData()
    form.append("file", file)

    const res = await fetch(`${BASE}/api/leads/import/csv`, {
      method: "POST",
      body: form
    })

    if (!res.ok) throw new Error("CSV import misslyckades")

    return res.json()
  },

  // Notes
  getNotes: (leadId) =>
    request(`/api/leads/${leadId}/notes`),

  createNote: (leadId, content) =>
    request(`/api/leads/${leadId}/notes`, {
      method: "POST",
      body: JSON.stringify({ content })
    }),

  // Calls
  initiateCall: (leadId) =>
    request(`/api/calls/initiate/${leadId}`, {
      method: "POST"
    }),

  getCallsForLead: (leadId) =>
    request(`/api/calls/lead/${leadId}`),

  getRecentCalls: () =>
    request("/api/calls/recent"),

  // Dialer
  startDialer: (data) =>
    request("/api/dialer/start", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  dialerNext: () =>
    request("/api/dialer/next", { method: "POST" }),

  stopDialer: () =>
    request("/api/dialer/stop", { method: "POST" }),

  dialerStatus: () =>
    request("/api/dialer/status"),

  // Reminders
  getTodayReminders: () =>
    request("/api/reminders/today"),

  getAllReminders: () =>
    request("/api/reminders"),

  createReminder: (data) =>
    request("/api/reminders", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  completeReminder: (id) =>
    request(`/api/reminders/${id}/complete`, {
      method: "PUT"
    }),

  // Dashboard
  getDashboard: () =>
    request("/api/dashboard"),
}
