import { useEffect, useState } from "react";
import {
  getMyAssignments, submitToAssignment,
  getAvailableCourses, selfEnroll, selfUnenroll,
} from "../api";

function Nav({ activeTab, setTab }) {
  const name = localStorage.getItem("name") || "Student";
  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="nav-brand-icon" style={{ fontSize: 13, fontWeight: 700 }}>ASE</div>
        Assignment Similarity Engine
      </div>
      <div className="nav-links">
        <a href="/student"  className="nav-link active">Dashboard</a>
        <a href="/feedback" className="nav-link">Feedback</a>
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

/* ── Submission Modal ─────────────────────────────────────────── */
function SubmitModal({ assignment, onClose, onSuccess }) {
  const [studentName, setStudentName] = useState(localStorage.getItem("name") || "");
  const [matricNo, setMatricNo]       = useState("");
  const [file, setFile]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const allowedFormats = assignment.allowed_formats.split(",").map(f => f.trim());
  const accept = allowedFormats.join(",");

  const handleSubmit = async () => {
    if (!studentName || !matricNo || !file) {
      setError("Please fill in all fields and select a file."); return;
    }
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowedFormats.includes(ext)) {
      setError(`File type "${ext}" not allowed. Accepted: ${allowedFormats.join(", ")}`); return;
    }
    setLoading(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("student_name", studentName);
    fd.append("matric_no", matricNo);
    try {
      await submitToAssignment(assignment.id, fd);
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.detail || "Submission failed. Please try again.");
    } finally { setLoading(false); }
  };

  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Submit Assignment</div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>{assignment.title}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius)",
          padding: "12px 16px", marginBottom: 20, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 13, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <span><strong>Course:</strong> {assignment.course_code} — {assignment.program}</span>
            {assignment.due_date && (
              <span style={{ color: isOverdue ? "var(--danger)" : "var(--text-2)" }}>
                <strong>Due:</strong>{" "}
                {isOverdue ? "OVERDUE — " : ""}{new Date(assignment.due_date).toLocaleString()}
              </span>
            )}
            <span><strong>Accepted:</strong> {allowedFormats.join(", ").toUpperCase()}</span>
          </div>
          {assignment.description && (
            <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-3)" }}>{assignment.description}</p>
          )}
        </div>

        {isOverdue && (
          <div className="alert alert-danger">
            The submission deadline for this assignment has passed.
          </div>
        )}

        <div className="form-group">
          <label className="lbl">Full name *</label>
          <input placeholder="As it appears on your student record"
            value={studentName} onChange={e => setStudentName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="lbl">Matric / student number *</label>
          <input placeholder="e.g. CSC/2021/045"
            value={matricNo} onChange={e => setMatricNo(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="lbl">Upload file *</label>
          <input type="file" accept={accept}
            onChange={e => setFile(e.target.files[0] || null)} />
          <p className="form-hint">Accepted formats: {allowedFormats.join(", ").toUpperCase()}</p>
          {file && (
            <p style={{ fontSize: 13, color: "var(--success)", marginTop: 4 }}>
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <div className="modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSubmit} disabled={loading || isOverdue}>
            {loading ? <><span className="spinner" /> Submitting…</> : "Submit Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────────────── */
export default function StudentDashboard() {
  const [tab, setTab]                 = useState("assignments");

  // My Assignments
  const [assignments, setAssignments] = useState(null);
  const [assignError, setAssignError] = useState("");
  const [activeAssign, setActiveAssign] = useState(null);
  const [successMsg, setSuccessMsg]   = useState("");

  // Browse Courses
  const [courses, setCourses]         = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [enrollMsg, setEnrollMsg]     = useState("");

  const loadAssignments = () => {
    getMyAssignments()
      .then(r => setAssignments(r.data))
      .catch(() => { setAssignError("Could not load assignments."); setAssignments([]); });
  };

  const loadCourses = () => {
    setCoursesLoading(true);
    getAvailableCourses()
      .then(r => setCourses(r.data))
      .catch(() => {})
      .finally(() => setCoursesLoading(false));
  };

  useEffect(() => { loadAssignments(); }, []);

  useEffect(() => {
    if (tab === "courses") loadCourses();
  }, [tab]);

  const handleSuccess = () => {
    setActiveAssign(null);
    setSuccessMsg("Assignment submitted successfully!");
    loadAssignments();
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  const handleEnroll = async (courseId) => {
    setEnrollMsg("");
    try {
      await selfEnroll(courseId);
      setEnrollMsg("Enrolled successfully! Switch to My Assignments to view the new assignment(s).");
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, is_enrolled: true } : c));
      loadAssignments();
    } catch (e) {
      setEnrollMsg(e.response?.data?.detail || "Enrollment failed. Please try again.");
    }
  };

  const handleUnenroll = async (courseId) => {
    if (!confirm("Leave this course? You will lose access to its assignments.")) return;
    setEnrollMsg("");
    try {
      await selfUnenroll(courseId);
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, is_enrolled: false } : c));
      loadAssignments();
    } catch (e) {
      setEnrollMsg(e.response?.data?.detail || "Could not leave course.");
    }
  };

  // Group assignments by course
  const byCourse = {};
  if (assignments) {
    for (const a of assignments) {
      const key = `${a.course_code} — ${a.program}`;
      if (!byCourse[key]) byCourse[key] = [];
      byCourse[key].push(a);
    }
  }

  const isOverdue = (a) => a.due_date && new Date(a.due_date) < new Date();
  const isDueSoon = (a) => {
    if (!a.due_date) return false;
    const diff = new Date(a.due_date) - new Date();
    return diff > 0 && diff < 86400000 * 2;
  };

  return (
    <>
      <Nav />
      <div className="page-wide">
        <div className="page-header">
          <h1>Student Dashboard</h1>
          <p>Submit assignments and browse available courses to enrol in.</p>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            { key: "assignments", label: "My Assignments" },
            { key: "courses",     label: "Browse Courses" },
          ].map(t => (
            <button key={t.key} className={`tab${tab === t.key ? " active" : ""}`}
              onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* ── MY ASSIGNMENTS ── */}
        {tab === "assignments" && (
          <>
            {successMsg && <div className="alert alert-success">{successMsg}</div>}
            {assignError && <div className="alert alert-danger">{assignError}</div>}

            {assignments === null && (
              <p style={{ textAlign: "center", color: "var(--text-3)", padding: 40 }}>Loading…</p>
            )}

            {assignments && Object.keys(byCourse).length === 0 && (
              <div className="empty-state">
                <h3>No assignments yet</h3>
                <p>
                  You have not enrolled in any courses with active assignments. Use the{" "}
                  <button className="btn-ghost" style={{ fontWeight: 600, color: "var(--accent)", padding: 0 }}
                    onClick={() => setTab("courses")}>Browse Courses</button>{" "}
                  tab to find and enrol in a course.
                </p>
              </div>
            )}

            {Object.entries(byCourse).map(([courseLabel, items]) => (
              <div key={courseLabel} style={{ marginBottom: 32 }}>
                <div className="section-header">
                  <span className="section-title">{courseLabel}</span>
                  <span className="badge">{items.length} assignment(s)</span>
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                  {items.map(a => {
                    const overdue = isOverdue(a);
                    const soon    = isDueSoon(a);
                    return (
                      <div key={a.id}
                        className={`assignment-card${a.submitted ? " submitted" : overdue ? " overdue" : ""}`}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "flex-start", gap: 14 }}>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, fontSize: 16 }}>{a.title}</span>
                              {a.submitted && <span className="status-active">Submitted</span>}
                              {overdue  && !a.submitted && <span className="status-overdue">Overdue</span>}
                              {soon     && !a.submitted && !overdue && (
                                <span className="risk-badge-medium">Due soon</span>
                              )}
                            </div>

                            {a.description && (
                              <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 8 }}>
                                {a.description}
                              </p>
                            )}

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13, color: "var(--text-3)" }}>
                              {a.due_date && (
                                <span style={{ color: overdue ? "var(--danger)" : soon ? "var(--warning)" : "var(--text-3)" }}>
                                  Due: {new Date(a.due_date).toLocaleString()}
                                </span>
                              )}
                              <span>
                                Accepted:{" "}
                                {a.allowed_formats.split(",").map(f => (
                                  <span key={f} className="badge" style={{ marginLeft: 4, fontSize: 11 }}>
                                    {f.trim().toUpperCase()}
                                  </span>
                                ))}
                              </span>
                              <span>Max marks: <strong>{a.max_marks ?? 100}</strong></span>
                            </div>

                            {/* Grade display */}
                            {a.submitted && a.graded && (
                              <div style={{ marginTop: 10, padding: "10px 14px",
                                background: "var(--surface-2)", borderRadius: "var(--radius)",
                                border: "1px solid var(--border)" }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)" }}>
                                  Grade: {a.marks} / {a.max_marks ?? 100}
                                </span>
                                {a.grade_feedback && (
                                  <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6, lineHeight: 1.5 }}>
                                    {a.grade_feedback}
                                  </p>
                                )}
                              </div>
                            )}
                            {a.submitted && !a.graded && (
                              <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-4)" }}>
                                Awaiting grading
                              </p>
                            )}
                          </div>

                          <div style={{ flexShrink: 0 }}>
                            {a.submitted ? (
                              <button className="btn-sm" disabled style={{ cursor: "default" }}>
                                Submitted
                              </button>
                            ) : overdue ? (
                              <button className="btn-sm" disabled>Deadline passed</button>
                            ) : (
                              <button className="primary btn-sm"
                                onClick={() => setActiveAssign(a)}>
                                Submit Now
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── BROWSE COURSES ── */}
        {tab === "courses" && (
          <>
            <div className="page-header" style={{ paddingTop: 0 }}>
              <p style={{ marginTop: 0 }}>
                Find courses taught on this platform and enrol to gain access to their assignments.
              </p>
            </div>

            {enrollMsg && (
              <div className={`alert ${enrollMsg.includes("successfully") ? "alert-success" : "alert-danger"}`}
                style={{ marginBottom: 16 }}>
                {enrollMsg}
              </div>
            )}

            {coursesLoading ? (
              <p style={{ textAlign: "center", color: "var(--text-3)", padding: 40 }}>Loading courses…</p>
            ) : courses.length === 0 ? (
              <div className="empty-state">
                <h3>No courses available</h3>
                <p>No courses have been registered by teachers yet. Check back later.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                {courses.map(c => (
                  <div key={c.id} className="card card-hover">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 17, color: "var(--primary)" }}>{c.course_code}</div>
                        <div style={{ color: "var(--text-2)", fontSize: 14, marginTop: 2 }}>{c.program}</div>
                        {c.course_name && <div style={{ color: "var(--text-3)", fontSize: 13 }}>{c.course_name}</div>}
                      </div>
                      {c.is_enrolled
                        ? <span className="status-active">Enrolled</span>
                        : <span className="status-inactive">Not enrolled</span>
                      }
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 14 }}>
                      Lecturer: {c.teacher_name}
                    </div>
                    {c.is_enrolled ? (
                      <button className="btn-sm btn-danger"
                        onClick={() => handleUnenroll(c.id)}>
                        Leave course
                      </button>
                    ) : (
                      <button className="primary btn-sm"
                        onClick={() => handleEnroll(c.id)}>
                        Enrol
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {activeAssign && (
        <SubmitModal
          assignment={activeAssign}
          onClose={() => setActiveAssign(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
