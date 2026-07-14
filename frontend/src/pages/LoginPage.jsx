import { useState } from "react";
import { login } from "../api";

/* ── Inline SVG icons ──────────────────────────────────── */
const LogoIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect width="48" height="48" rx="12" fill="#1e3a5f" />
    <path d="M14 24L20 14L26 24L32 14" stroke="white" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 34L20 24L26 34L32 24" stroke="#3b82f6" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = ({ open }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/* ── Right panel feature cards ─────────────────────────── */
function FeatureCard({ icon, title, subtitle, style }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.1)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: 14,
      padding: "14px 18px",
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      ...style,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: "rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div>
        <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{title}</p>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.5 }}>{subtitle}</p>
      </div>
    </div>
  );
}

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="white" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AnalysisIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="white" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="white" strokeWidth="2" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

/* ── Main Component ─────────────────────────────────────── */
export default function LoginPage() {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in both fields."); return; }
    setLoading(true); setError("");
    try {
      const res = await login(email, password);
      const { access_token, role, name, id } = res.data;
      localStorage.setItem("token",  access_token);
      localStorage.setItem("role",   role);
      localStorage.setItem("name",   name);
      localStorage.setItem("userId", id);
      const dest = role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";
      window.location.href = dest;
    } catch (e) {
      if (e.response?.status === 401) {
        setError("Incorrect email or password.");
      } else if (e.response?.status === 403) {
        setError(e.response.data?.detail || "Account deactivated. Contact the administrator.");
      } else if (e.response) {
        setError(e.response.data?.detail || "Login failed. Please try again.");
      } else {
        setError("Cannot reach the server. Please ensure the backend is running.");
      }
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* ── LEFT — Form panel ── */}
      <div style={{
        width: "45%",
        minWidth: 360,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 56px",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          {/* Logo */}
          <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
            <LogoIcon />
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: 28, fontWeight: 700, color: "#0f172a",
            textAlign: "center", marginBottom: 8,
          }}>
            Welcome back
          </h1>
          <p style={{
            fontSize: 14, color: "#64748b", textAlign: "center",
            marginBottom: 36, lineHeight: 1.6,
          }}>
            Log in to manage assessments, run similarity checks, and give instant feedback.
          </p>

          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: "block", fontSize: 13.5, fontWeight: 600,
              color: "#334155", marginBottom: 6,
            }}>
              Email <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: "100%", padding: "11px 14px",
                border: "1.5px solid #e2e8f0", borderRadius: 10,
                fontSize: 14, outline: "none", color: "#0f172a",
                transition: "border-color .15s",
              }}
              onFocus={e => e.target.style.borderColor = "#3b82f6"}
              onBlur={e  => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block", fontSize: 13.5, fontWeight: 600,
              color: "#334155", marginBottom: 6,
            }}>
              Password <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                style={{
                  width: "100%", padding: "11px 44px 11px 14px",
                  border: "1.5px solid #e2e8f0", borderRadius: 10,
                  fontSize: 14, outline: "none", color: "#0f172a",
                  transition: "border-color .15s",
                }}
                onFocus={e => e.target.style.borderColor = "#3b82f6"}
                onBlur={e  => e.target.style.borderColor = "#e2e8f0"}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)", background: "none",
                  border: "none", cursor: "pointer", color: "#94a3b8",
                  padding: 4, display: "flex", alignItems: "center",
                }}
              >
                <EyeIcon open={showPass} />
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 16,
              background: "#fef2f2", color: "#dc2626",
              border: "1px solid #fecaca", fontSize: 13.5,
            }}>
              {error}
            </div>
          )}

          {/* Sign in button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%", padding: "12px",
              background: loading ? "#94a3b8" : "linear-gradient(135deg, #1e3a5f 0%, #2a5298 100%)",
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: ".2px", transition: "opacity .15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading && (
              <span style={{
                width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)",
                borderTopColor: "#fff", borderRadius: "50%",
                animation: "spin .6s linear infinite", display: "inline-block",
              }} />
            )}
            {loading ? "Signing in…" : "Sign in"}
          </button>

          {/* Register link */}
          <p style={{ textAlign: "center", fontSize: 13.5, color: "#64748b", marginTop: 20 }}>
            Don't have an account?{" "}
            <a href="/register" style={{ color: "#1e3a5f", fontWeight: 600, textDecoration: "none" }}>
              Create one
            </a>
          </p>
        </div>
      </div>

      {/* ── RIGHT — Dark feature panel ── */}
      <div style={{
        flex: 1,
        background: "linear-gradient(145deg, #0f172a 0%, #1e3a5f 55%, #1e3260 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 56,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 320, height: 320, borderRadius: "50%",
          background: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.12)",
        }} />
        <div style={{
          position: "absolute", bottom: -120, left: -60,
          width: 400, height: 400, borderRadius: "50%",
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.10)",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 420, width: "100%" }}>
          {/* Brand headline */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{
              fontSize: 32, fontWeight: 800, color: "#fff",
              lineHeight: 1.2, marginBottom: 12,
            }}>
              Assignment<br />Similarity Engine
            </h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 1.6 }}>
              Check assignment similarity. Grade smarter. Maintain academic integrity at scale.
            </p>
          </div>

          {/* Feature cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FeatureCard
              icon={<CheckIcon />}
              title="Assignment Management"
              subtitle="Create assignments with deadlines, file restrictions, and grading rubrics."
            />
            <FeatureCard
              icon={<AnalysisIcon />}
              title="Multi-Algorithm Similarity"
              subtitle="TF-IDF, Trigram, and SBERT semantic analysis running in parallel with tabbed results."
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="Role-Based Access Control"
              subtitle="Separate secure portals for administrators, lecturers, and students."
              style={{ marginLeft: 24 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
