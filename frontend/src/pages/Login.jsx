import { useState } from "react"
import { api } from "../utils/api"

export function Login({ onLogin }) {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await api.login(password)
      onLogin(res.token)
    } catch (err) {
      setError("Fel lösenord. Försök igen.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
    }}>
      <div style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "40px",
        width: "100%",
        maxWidth: "380px",
        boxShadow: "var(--shadow)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--green)" }}>Grön Konsult</h1>
          <p style={{ color: "var(--text3)", marginTop: 6, fontSize: 13 }}>CRM System – Privat & Säkert</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Lösenord</label>
            <input
              type="password"
              className="input"
              placeholder="Ange ditt lösenord..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(255,92,92,0.1)",
              border: "1px solid rgba(255,92,92,0.3)",
              borderRadius: "var(--radius)",
              padding: "10px 14px",
              color: "var(--red)",
              fontSize: 13
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
            disabled={loading || !password}
          >
            {loading ? <span className="loading-ring" style={{ width: 16, height: 16 }} /> : "Logga in"}
          </button>
        </form>
      </div>
    </div>
  )
}
