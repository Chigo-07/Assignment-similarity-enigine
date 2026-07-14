import { useEffect, useState } from "react";
import {
  getAdminStats, getAdminUsers, toggleUserActive,
  getTeacherCodes, createTeacherCode, deleteTeacherCode,
  getAdminCourses, getAdminEnrollments, enrollStudent, removeEnrollment,
} from "../api";

function Nav() {
  const name = localStorage.getItem("name") || "Admin";
  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="nav-brand-icon" style={{ fontSize: 13, fontWeight: 700 }}>ASE</div>
        Assignment Similarity Engine
      </div>
      <div className="nav-right">
        <div className="nav-user">
          <div className="nav-avatar">{name[0].toUpperCase()}</div>
          <span>{name}</span>
          <span className="role-badge role-admin">Admin</span>
        </div>
        <button className="nav-logout"
          onClick={() => { localStorage.clear(); window.location.href = "/login"; }}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");

  // Stats
  const [stats, setStats] = useState(null);

  // Users
  const [users, setUsers]       = useState([]);
  const [userFilter, setUserFilter] = useState("all");

  // Codes
  const [codes, setCodes]         = useState([]);
  const [codeLabel, setCodeLabel] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [codeMsg, setCodeMsg]     = useState("");

  // Enrollments
  const [courses, setCourses]         = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollCourseId, setEnrollCourseId]   = useState("");
  const [enrollMsg, setEnrollMsg]     = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [s, u, c, en, co] = await Promise.all([
        getAdminStats(), getAdminUsers(), getTeacherCodes(),
        getAdminEnrollments(), getAdminCourses(),
      ]);
      setStats(s.data); setUsers(u.data); setCodes(c.data);
      setEnrollments(en.data); setCourses(co.data);
    } catch { /* handled per-section */ }
  };

  const handleToggleUser = async (id) => {
    try {
      await toggleUserActive(id);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !u.is_active } : u));
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to toggle user");
    }
  };

  const handleCreateCode = async () => {
    setCodeMsg("");
    try {
      const r = await createTeacherCode(codeLabel, customCode);
      setCodes(prev => [r.data, ...prev]);
      setCodeLabel(""); setCustomCode("");
      setCodeMsg(`Code created: ${r.data.code}`);
    } catch (e) {
      setCodeMsg(e.response?.data?.detail || "Failed to create code");
    }
  };

  const handleDeleteCode = async (id) => {
    if (!confirm("Delete this access code?")) return;
    try {
      await deleteTeacherCode(id);
      setCodes(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to delete");
    }
  };

  const handleEnroll = async () => {
    if (!enrollStudentId || !enrollCourseId) {
      setEnrollMsg("Select both a student and a course."); return;
    }
    setEnrollMsg("");
    try {
      const r = await enrollStudent(enrollStudentId, enrollCourseId);
      setEnrollments(prev => [...prev, r.data]);
      setEnrollMsg(`Enrolled ${r.data.student_name} in ${r.data.course_code}`);
      setEnrollStudentId(""); setEnrollCourseId("");
    } catch (e) {
      setEnrollMsg(e.response?.data?.detail || "Enrollment failed");
    }
  };

  const handleRemoveEnrollment = async (id) => {
    if (!confirm("Remove this enrollment?")) return;
    try {
      await removeEnrollment(id);
      setEnrollments(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to remove");
    }
  };

  const students = users.filter(u => u.role === "student");
  const filteredUsers = userFilter === "all" ? users : users.filter(u => u.role === userFilter);

  return (
    <>
      <Nav />
      <div className="page-wide">
        <div className="page-header">
          <h1>Administrator Dashboard</h1>
          <p>Manage users, teacher access codes, and student course enrollments.</p>
        </div>

        {/* Tab bar */}
        <div className="tabs">
          {[
            { key: "overview",    label: "Overview"      },
            { key: "users",       label: "Users"          },
            { key: "codes",       label: "Access Codes"   },
            { key: "enrollments", label: "Enrollments"    },
          ].map(t => (
            <button key={t.key} className={`tab${tab === t.key ? " active" : ""}`}
              onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && stats && (
          <>
            <div className="stats-grid">
              {[
                { label: "Total Users",    value: stats.total_users        },
                { label: "Teachers",       value: stats.total_teachers      },
                { label: "Students",       value: stats.total_students      },
                { label: "Courses",        value: stats.total_courses       },
                { label: "Assignments",    value: stats.total_assignments   },
                { label: "Submissions",    value: stats.total_submissions   },
                { label: "Enrollments",    value: stats.total_enrollments   },
              ].map(s => (
                <div className="stat-card" key={s.label}>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 12 }}>Quick Guide</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { step: "1", title: "Create access codes", desc: "Generate teacher codes so lecturers can register on the platform." },
                  { step: "2", title: "Teachers register", desc: "Teachers sign up using the codes you provide — each code is single-use." },
                  { step: "3", title: "Teachers add courses & assignments", desc: "Lecturers create their courses and post assignments with deadlines." },
                  { step: "4", title: "Enroll students", desc: "Use the Enrollments tab to grant students access to specific courses." },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--primary)",
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{s.step}</div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>{s.title}</p>
                      <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["all", "admin", "teacher", "student"].map(r => (
                <button key={r} className={`btn-sm${userFilter === r ? " primary" : ""}`}
                  style={{ textTransform: "capitalize" }}
                  onClick={() => setUserFilter(r)}>{r}</button>
              ))}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Email</th><th>Role</th>
                    <th>Status</th><th>Joined</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => (
                    <tr key={u.id}>
                      <td style={{ color: "var(--text-4)" }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td style={{ color: "var(--text-3)" }}>{u.email}</td>
                      <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                      <td>
                        <span className={u.is_active ? "status-active" : "status-inactive"}>
                          {u.is_active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-4)", fontSize: 12 }}>
                        {u.created_at?.slice(0, 10)}
                      </td>
                      <td>
                        {u.role !== "admin" && (
                          <button className={`btn-xs ${u.is_active ? "btn-danger" : "primary"}`}
                            onClick={() => handleToggleUser(u.id)}>
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── ACCESS CODES ── */}
        {tab === "codes" && (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ marginBottom: 16 }}>Generate Teacher Access Code</h2>
              <div className="form-row">
                <div className="form-group">
                  <label className="lbl">Label / Note (optional)</label>
                  <input placeholder="e.g. For Prof. Eze — CSC department"
                    value={codeLabel} onChange={e => setCodeLabel(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="lbl">Custom code (leave blank to auto-generate)</label>
                  <input placeholder="e.g. STAFF2025"
                    value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} />
                </div>
              </div>
              <button className="primary" onClick={handleCreateCode}>Generate Code</button>
              {codeMsg && (
                <div className={`alert ${codeMsg.includes("created") ? "alert-success" : "alert-danger"}`}
                  style={{ marginTop: 12, marginBottom: 0 }}>
                  {codeMsg}
                </div>
              )}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th><th>Label</th><th>Status</th>
                    <th>Used By</th><th>Created</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-4)", padding: 32 }}>
                      No codes yet. Generate one above.
                    </td></tr>
                  )}
                  {codes.map(c => (
                    <tr key={c.id}>
                      <td>
                        <code style={{ background: "#f8fafc", padding: "3px 8px",
                          borderRadius: 6, fontFamily: "monospace", fontSize: 13,
                          border: "1px solid var(--border)", letterSpacing: 1 }}>
                          {c.code}
                        </code>
                      </td>
                      <td style={{ color: "var(--text-3)" }}>{c.label || "—"}</td>
                      <td>
                        <span className={c.is_used ? "status-inactive" : "status-active"}>
                          {c.is_used ? "Used" : "Available"}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-3)" }}>{c.used_by_name || "—"}</td>
                      <td style={{ color: "var(--text-4)", fontSize: 12 }}>{c.created_at?.slice(0, 16)}</td>
                      <td>
                        {!c.is_used && (
                          <button className="btn-xs btn-danger"
                            onClick={() => handleDeleteCode(c.id)}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── ENROLLMENTS ── */}
        {tab === "enrollments" && (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ marginBottom: 16 }}>Enroll a Student in a Course</h2>
              <div className="form-row">
                <div className="form-group">
                  <label className="lbl">Student</label>
                  <select value={enrollStudentId}
                    onChange={e => setEnrollStudentId(e.target.value)}>
                    <option value="">Choose a student…</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="lbl">Course</label>
                  <select value={enrollCourseId}
                    onChange={e => setEnrollCourseId(e.target.value)}>
                    <option value="">Choose a course…</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.course_code} — {c.program} (Teacher: {c.teacher_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button className="primary" onClick={handleEnroll}>Enroll Student</button>
              {enrollMsg && (
                <div className={`alert ${enrollMsg.includes("Enrolled") ? "alert-success" : "alert-danger"}`}
                  style={{ marginTop: 12, marginBottom: 0 }}>
                  {enrollMsg}
                </div>
              )}
            </div>

            <div className="section-header">
              <span className="section-title">Current Enrollments ({enrollments.length})</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Student</th><th>Email</th>
                    <th>Course</th><th>Program</th><th>Enrolled</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-4)", padding: 32 }}>
                      No enrollments yet.
                    </td></tr>
                  )}
                  {enrollments.map((e, i) => (
                    <tr key={e.id}>
                      <td style={{ color: "var(--text-4)" }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{e.student_name}</td>
                      <td style={{ color: "var(--text-3)", fontSize: 13 }}>{e.student_email}</td>
                      <td>
                        <span className="badge">{e.course_code}</span>
                      </td>
                      <td style={{ color: "var(--text-3)" }}>{e.program}</td>
                      <td style={{ color: "var(--text-4)", fontSize: 12 }}>{e.enrolled_at?.slice(0, 10)}</td>
                      <td>
                        <button className="btn-xs btn-danger"
                          onClick={() => handleRemoveEnrollment(e.id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
