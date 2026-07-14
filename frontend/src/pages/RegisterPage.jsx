import { useState } from "react";
import { register } from "../api";

const LogoIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect width="48" height="48" rx="12" fill="#1e3a5f" />
    <path d="M14 24L20 14L26 24L32 14" stroke="white" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 34L20 24L26 34L32 24" stroke="#3b82f6" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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

const StudentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

const BoardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const KeyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="M21 2l-9.6 9.6M15.5 7.5l3 3" />
  </svg>
);

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  color: "#0f172a",
  transition: "border-color .15s",
  background: "#fff",
};

const labelStyle = {
  display: "block",
  fontSize: 13.5,
  fontWeight: 600,
  color: "#334155",
  marginBottom: 6,
};

export default function RegisterPage() {
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [role, setRole]               = useState("student");
  const [teacherCode, setTeacherCode] = useState("");
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");
  const [loading, setLoading]         = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirm) {
      setError("Please fill in all fields."); return;
    }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (role === "teacher" && !teacherCode) {
      setError("Please enter the teacher access code provided by the administrator."); return;
    }
    setLoading(true); setError("");
    try {
      await register(name, email, password, role, teacherCode);
      setSuccess("Account created successfully! You can now sign in.");
      setName(""); setEmail(""); setPassword(""); setConfirm(""); setTeacherCode("");
    } catch (e) {
      setError(e.response?.data?.detail || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  const inp = (props) => ({
    ...inputStyle,
    ...props,
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── LEFT — Form ── */}
      <div style={{
        width: "55%",
        minWidth: 400,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 56px",
        overflowY: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ marginBottom: 22, display: "flex", justifyContent: "center" }}>
            <LogoIcon />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a",
            textAlign: "center", marginBottom: 6 }}>
            Create your account
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: "#1e3a5f", fontWeight: 600, textDecoration: "none" }}>Sign in</a>
          </p>

          {/* Full name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Full name <span style={{ color: "#dc2626" }}>*</span></label>
            <input placeholder="e.g. Chidi Eze" value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#3b82f6"}
              onBlur={e  => e.target.style.borderColor = "#e2e8f0"} />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email address <span style={{ color: "#dc2626" }}>*</span></label>
            <input type="email" placeholder="you@university.edu" value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#3b82f6"}
              onBlur={e  => e.target.style.borderColor = "#e2e8f0"} />
          </div>

          {/* Role selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>I am registering as <span style={{ color: "#dc2626" }}>*</span></label>
            <div style={{ display: "flex", gap: 10 }}>
              {["student", "teacher"].map(r => (
                <label key={r} style={{
                  flex: 1, padding: "10px 14px",
                  border: `2px solid ${role === r ? "#3b82f6" : "#e2e8f0"}`,
                  borderRadius: 10, cursor: "pointer",
                  background: role === r ? "#eff6ff" : "#fff",
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "all .15s",
                }}>
                  <input type="radio" name="role" value={r} checked={role === r}
                    onChange={() => setRole(r)} style={{ width: "auto" }} />
                  <span style={{ fontSize: 14, fontWeight: 500, textTransform: "capitalize",
                    color: role === r ? "#3b82f6" : "#64748b" }}>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Teacher access code */}
          {role === "teacher" && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Teacher access code <span style={{ color: "#dc2626" }}>*</span></label>
              <input placeholder="Enter the code provided by the administrator"
                value={teacherCode} onChange={e => setTeacherCode(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "#3b82f6"}
                onBlur={e  => e.target.style.borderColor = "#e2e8f0"} />
              <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 5 }}>
                Contact the system administrator to obtain this code.
              </p>
            </div>
          )}

          {/* Passwords */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Password <span style={{ color: "#dc2626" }}>*</span></label>
              <input type="password" placeholder="Min. 8 characters" value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "#3b82f6"}
                onBlur={e  => e.target.style.borderColor = "#e2e8f0"} />
            </div>
            <div>
              <label style={labelStyle}>Confirm password <span style={{ color: "#dc2626" }}>*</span></label>
              <input type="password" placeholder="Repeat password" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "#3b82f6"}
                onBlur={e  => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14,
              background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 13.5 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14,
              background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontSize: 13.5 }}>
              {success}{" "}
              <a href="/login" style={{ color: "#15803d", fontWeight: 700 }}>Sign in now</a>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleRegister}
            disabled={loading}
            style={{
              width: "100%", padding: "12px",
              background: loading ? "#94a3b8" : "linear-gradient(135deg, #1e3a5f 0%, #2a5298 100%)",
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading && (
              <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)",
                borderTopColor: "#fff", borderRadius: "50%",
                animation: "spin .6s linear infinite", display: "inline-block" }} />
            )}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </div>
      </div>

      {/* ── RIGHT — Dark panel ── */}
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
        <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320,
          borderRadius: "50%", background: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.12)" }} />
        <div style={{ position: "absolute", bottom: -120, left: -60, width: 400, height: 400,
          borderRadius: "50%", background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.10)" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 380, width: "100%" }}>
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 10 }}>
              Join the platform
            </h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 1.6 }}>
              Students, teachers, and administrators each have a dedicated workspace built for their role.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FeatureCard
              icon={<StudentIcon />}
              title="For Students"
              subtitle="Access enrolled courses and submit assignments before the deadline."
            />
            <FeatureCard
              icon={<BoardIcon />}
              title="For Teachers"
              subtitle="Create assignments, review submissions, and run similarity analysis."
              style={{ marginLeft: 20 }}
            />
            <FeatureCard
              icon={<KeyIcon />}
              title="Teacher Registration"
              subtitle="Teachers require a single-use access code issued by the administrator."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
