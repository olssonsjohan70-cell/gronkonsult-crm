const BASE = import.meta.env.VITE_API_BASE_URL || ""

function getErrorMessage(payload, fallback = "Serverfel") {
  if (!payload) return fallback

  if (typeof payload === "string") return payload

  if (Array.isArray(payload)) {
    const msgs = payload
      .map((item) => {
        if (typeof item === "string") return item
        if (item?.msg && item?.loc) return `${item.loc.join(".")}: ${item.msg}`
        if (item?.msg) return item.msg
        return null
      })
      .filter(Boolean)

    return msgs.length ? msgs.join(" · ") : fallback
  }

  if (typeof payload === "object") {
    if (typeof payload.detail === "string") return payload.detail
    if (payload.detail) return getErrorMessage(payload.detail, fallback)
    if (typeof payload.message === "string") return payload.message
  }

  return fallback
}

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
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const text = await res.text()
    let parsed = null

    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = text
      }
    }

    if (!res.ok) {
      throw new Error(getErrorMessage(parsed))
    }

    return parsed
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Servern svarar inte (timeout)")
    }
    if (err instanceof TypeError && /fetch/i.test(err.message || "")) {
      throw new Error("Kunde inte nå servern. Kontrollera anslutning och API-URL.")
    }
    if (err instanceof Error) {
      throw err
    }
    throw new Error("Ett okänt fel uppstod")
  } finally {
    clearTimeout(timeout)
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

  updateLead: (id, data) => {
    const payload = { ...data }
    if (payload.follow_up_date === "") payload.follow_up_date = null

    return request(`/api/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    })
  },

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

  // Meetings
  getMeetings: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/api/meetings${q ? "?" + q : ""}`)
  },

  createMeeting: (data) =>
    request("/api/meetings", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateMeeting: (id, data) =>
    request(`/api/meetings/${id}`, {
      method: "PUT",
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
