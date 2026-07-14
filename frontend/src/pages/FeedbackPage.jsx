import { useEffect, useState } from "react";
import { getMyFeedback } from "../api";

function Nav() {
  const name = localStorage.getItem("name") || "Student";
  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="nav-brand-icon" style={{ fontSize: 13, fontWeight: 700 }}>ASE</div>
        Assignment Similarity Engine
      </div>
      <div className="nav-links">
        <a href="/student"  className="nav-link">My Assignments</a>
        <a href="/feedback" className="nav-link active">Feedback</a>
      </div>
      <div className="nav-right">
        <div className="nav-user">
          <div className="nav-avatar">{name[0].toUpperCase()}</div>
          <span>{name}</span>
          <span className="role-badge role-student">Student</span>
        </div>
        <button className="nav-logout"
          onClick={() => { localStorage.clear(); window.location.href = "/login"; }}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

function ScoreRing({ score }) {
  const color = score >= 70 ? "var(--danger)" : score >= 40 ? "var(--warning)" : "var(--success)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      minWidth: 72, padding: "8px 0" }}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 163.4} 163.4`}
          transform="rotate(-90 32 32)" />
        <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{score}%</text>
      </svg>
      <span style={{ fontSize: 11, color: "var(--text-4)", marginTop: 2 }}>Similarity</span>
    </div>
  );
}

export default function FeedbackPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getMyFeedback()
      .then(r => setItems(r.data))
      .catch(() => { setError("Could not load feedback."); setItems([]); });
  }, []);

  const filtered = items
    ? filter === "all" ? items
      : items.filter(f => f.level.toLowerCase() === filter)
    : null;

  const counts = items ? {
    all: items.length,
    high: items.filter(f => f.level === "High").length,
    medium: items.filter(f => f.level === "Medium").length,
    low: items.filter(f => f.level === "Low").length,
  } : {};

  return (
    <>
      <Nav />
      <div className="page">
        <div className="page-header">
          <h1>Similarity Feedback</h1>
          <p>Similarity findings your teacher has shared with you from assignment checks.</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {items && items.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { key: "all",    label: `All (${counts.all})` },
              { key: "high",   label: `High (${counts.high})` },
              { key: "medium", label: `Medium (${counts.medium})` },
              { key: "low",    label: `Low (${counts.low})` },
            ].map(f => (
              <button key={f.key}
                className={`btn-sm${filter === f.key ? " primary" : ""}`}
                onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {filtered === null && (
          <p style={{ textAlign: "center", color: "var(--text-3)", padding: 40 }}>Loading…</p>
        )}

        {filtered && filtered.length === 0 && (
          <div className="empty-state">
            <h3>No feedback yet</h3>
            <p>
              Once your teacher runs a similarity check and shares the results, they will appear here.
            </p>
          </div>
        )}

        {filtered && filtered.map(f => {
          const riskClass = f.level === "High"   ? "risk-badge-high"
                          : f.level === "Medium" ? "risk-badge-medium"
                          :                        "risk-badge-low";
          return (
            <div key={f.id} className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <ScoreRing score={Math.round(f.percentage)} />

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>
                        {f.course_code} · {f.program}
                      </span>
                      <span className={riskClass} style={{ marginLeft: 8 }}>{f.level} Risk</span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-4)" }}>
                      {f.created_at?.slice(0, 16).replace("T", " at ")}
                    </span>
                  </div>

                  <p style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 6 }}>
                    Your submission was flagged as similar to{" "}
                    <strong>{f.similar_to_name}</strong>{" "}
                    <span style={{ color: "var(--text-3)" }}>
                      ({f.similar_to_matric} · {f.similar_to_program})
                    </span>
                  </p>

                  <div style={{ marginTop: 4 }}>
                    <div className="progress-bar">
                      <div className={`progress-fill progress-${f.level.toLowerCase()}`}
                        style={{ width: `${f.percentage}%` }} />
                    </div>
                  </div>

                  {f.message && (
                    <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: "var(--radius)",
                      background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: "var(--text-3)" }}>
                        Note from teacher:{" "}
                      </span>
                      <span style={{ color: "var(--text-2)" }}>{f.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
