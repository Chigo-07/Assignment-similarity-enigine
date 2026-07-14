import { useEffect, useState, useCallback } from "react";
import {
  getMyCourses, registerCourse,
  getAssignments, createAssignment, updateAssignment, deleteAssignment,
  getDocuments, runSimilarity, downloadReport, sendFeedback,
  gradeSubmission, autoGradeAssignment, downloadDocument,
} from "../api";

/* ── Nav ──────────────────────────────────────────────────────────── */
function Nav() {
  const name = localStorage.getItem("name") || "Teacher";
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
          <span className="role-badge role-teacher">Teacher</span>
        </div>
        <button className="nav-logout"
          onClick={() => { localStorage.clear(); window.location.href = "/login"; }}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

/* ── Algorithm colour helpers ────────────────────────────────────── */
const ALGO_META = {
  tfidf:    { label: "TF-IDF (Lexical)",  fillClass: "fill-tfidf",    tabClass: "active-tfidf",    scoreKey: "tfidf_score"    },
  trigram:  { label: "Trigram (N-gram)",   fillClass: "fill-trigram",  tabClass: "active-trigram",  scoreKey: "trigram_score"  },
  sbert:    { label: "SBERT (Semantic)",   fillClass: "fill-sbert",    tabClass: "active-sbert",    scoreKey: "sbert_score"    },
  combined: { label: "Combined Score",     fillClass: "fill-combined", tabClass: "active-combined", scoreKey: "final_score"    },
};

function riskClass(score) {
  if (score >= 70) return "risk-badge-high";
  if (score >= 40) return "risk-badge-medium";
  return "risk-badge-low";
}
function riskLabel(score) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

/* ── Similarity Results Panel ────────────────────────────────────── */
function SimilarityResults({ batches, onClose }) {
  const [algoTab, setAlgoTab] = useState("combined");
  const [batchIdx, setBatchIdx] = useState(0);

  if (!batches || batches.length === 0) return null;
  const batch = batches[batchIdx];
  const scoreKey = ALGO_META[algoTab].scoreKey;
  const sorted = [...batch.results].sort((a, b) => b[scoreKey] - a[scoreKey]);

  const avg = (key) => batch.results.reduce((s, r) => s + r[key], 0) / (batch.results.length || 1);
  const avgScores = {
    tfidf: avg("tfidf_score"), trigram: avg("trigram_score"), sbert: avg("sbert_score"),
  };
  const bestAlgo = Object.entries(avgScores).reduce((a, b) => b[1] > a[1] ? b : a)[0];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      zIndex: 1000, padding: "24px 16px", overflowY: "auto" }}>
      <div style={{ background: "var(--surface)", borderRadius: "var(--radius-xl)",
        width: "100%", maxWidth: 960, boxShadow: "var(--shadow-lg)", padding: 28 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2>Similarity Results</h2>
            <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
              Primary: <strong>{batch.primary_document}</strong> — {batch.student} &nbsp;|&nbsp;
              Compared against <strong>{batch.total_compared}</strong> document(s)
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}
            style={{ fontSize: 22, padding: "4px 10px" }}>✕</button>
        </div>

        {batches.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {batches.map((b, i) => (
              <button key={i}
                className={`btn-sm${batchIdx === i ? " primary" : ""}`}
                onClick={() => { setBatchIdx(i); }}>
                {b.student} — {b.primary_document}
              </button>
            ))}
          </div>
        )}

        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <strong>Best individual algorithm for this dataset:</strong>{" "}
          {ALGO_META[bestAlgo].label} (avg score {avgScores[bestAlgo].toFixed(1)}%).
          Use the <strong>Combined Score</strong> tab for the most reliable overall result.
        </div>

        <div className="algo-tabs">
          {Object.entries(ALGO_META).map(([key, meta]) => (
            <button key={key}
              className={`algo-tab${algoTab === key ? ` ${meta.tabClass}` : ""}`}
              onClick={() => setAlgoTab(key)}>
              {meta.label}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Matric</th>
                <th>File</th>
                {algoTab === "combined" ? (
                  <>
                    <th>TF-IDF</th><th>Trigram</th><th>SBERT</th><th>Combined</th>
                  </>
                ) : (
                  <th>{ALGO_META[algoTab].label} Score</th>
                )}
                <th>Similarity %</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-4)", fontWeight: 600 }}>#{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{r.student_name}</td>
                  <td style={{ color: "var(--text-3)", fontSize: 13 }}>{r.matric_no}</td>
                  <td style={{ fontSize: 12, color: "var(--text-3)" }}>{r.filename}</td>

                  {algoTab === "combined" ? (
                    <>
                      <td>
                        <div className="algo-score-bar">
                          <div className="bar"><div className="fill fill-tfidf"
                            style={{ width: `${r.tfidf_score}%` }} /></div>
                          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 36 }}>{r.tfidf_score}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="algo-score-bar">
                          <div className="bar"><div className="fill fill-trigram"
                            style={{ width: `${r.trigram_score}%` }} /></div>
                          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 36 }}>{r.trigram_score}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="algo-score-bar">
                          <div className="bar"><div className="fill fill-sbert"
                            style={{ width: `${r.sbert_score}%` }} /></div>
                          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 36 }}>{r.sbert_score}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="algo-score-bar">
                          <div className="bar"><div className="fill fill-combined"
                            style={{ width: `${r.final_score}%` }} /></div>
                          <span style={{ fontSize: 14, fontWeight: 700, minWidth: 36 }}>{r.final_score}%</span>
                        </div>
                      </td>
                    </>
                  ) : (
                    <td>
                      <div className="algo-score-bar">
                        <div className="bar">
                          <div className={`fill ${ALGO_META[algoTab].fillClass}`}
                            style={{ width: `${r[scoreKey]}%` }} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, minWidth: 36 }}>{r[scoreKey]}%</span>
                      </div>
                    </td>
                  )}
                  {/* Dedicated Similarity % column — always shows the combined final score */}
                  <td style={{ textAlign: "center" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontWeight: 700,
                      fontSize: 14,
                      background: r.final_score >= 70 ? "#fef2f2"
                               : r.final_score >= 40 ? "#fffbeb" : "#f0fdf4",
                      color: r.final_score >= 70 ? "var(--danger)"
                           : r.final_score >= 40 ? "#b45309" : "var(--success)",
                      border: `1px solid ${r.final_score >= 70 ? "#fecaca"
                             : r.final_score >= 40 ? "#fde68a" : "#bbf7d0"}`,
                      minWidth: 56,
                    }}>
                      {r.final_score}%
                    </span>
                  </td>
                  <td><span className={riskClass(r.final_score)}>{riskLabel(r.final_score)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {batch.results.some(r => r.matched_phrases?.length > 0) && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 10 }}>Common Phrases Detected</h3>
            {batch.results.filter(r => r.matched_phrases?.length > 0).slice(0, 3).map((r, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 6 }}>
                  With <strong>{r.student_name}</strong> ({r.filename}):
                </p>
                {r.matched_phrases.slice(0, 15).map((p, j) => (
                  <span key={j} className="phrase-tag">{p}</span>
                ))}
              </div>
            ))}
          </div>
        )}

        {batches.length === 1 && (
          <FeedbackActions docId={batch._primaryDocId} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function FeedbackActions({ docId, onClose }) {
  const [msg, setMsg]           = useState("");
  const [flagged, setFlagged]   = useState(false);
  const [fbStatus, setFbStatus] = useState("");

  if (!docId) return null;

  const handleSend = async () => {
    try {
      const r = await sendFeedback(docId, msg, flagged);
      setFbStatus(`Feedback sent (${r.data.sent} finding(s)).`);
    } catch (e) {
      setFbStatus(e.response?.data?.detail || "Could not send feedback.");
    }
  };

  const handleDownload = async () => {
    try {
      const res = await downloadReport(docId);
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url;
      a.download = `report_${docId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { setFbStatus("Could not download report."); }
  };

  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
      <h3 style={{ marginBottom: 12 }}>Send Feedback to Student</h3>
      <textarea rows={3} value={msg} onChange={e => setMsg(e.target.value)}
        placeholder="Optional note for the student…"
        style={{ marginBottom: 10, resize: "vertical" }} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13,
        color: "var(--text-2)", marginBottom: 14 }}>
        <input type="checkbox" checked={flagged} onChange={e => setFlagged(e.target.checked)} />
        Send only High / Medium risk findings
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="primary" onClick={handleSend}>Send Feedback</button>
        <button onClick={handleDownload}>Download PDF Report</button>
      </div>
      {fbStatus && (
        <div className={`alert ${fbStatus.includes("sent") ? "alert-success" : "alert-danger"}`}
          style={{ marginTop: 12, marginBottom: 0 }}>{fbStatus}</div>
      )}
    </div>
  );
}

/* ── Grade Modal ─────────────────────────────────────────────────── */
function GradeModal({ doc, assignment, onClose, onGraded }) {
  const [marks, setMarks]       = useState(doc.marks != null ? String(doc.marks) : "");
  const [feedback, setFeedback] = useState(doc.grade_feedback || "");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");

  const maxMarks = assignment?.max_marks ?? 100;

  const handleGrade = async () => {
    const m = parseFloat(marks);
    if (isNaN(m) || m < 0 || m > maxMarks) {
      setErr(`Marks must be between 0 and ${maxMarks}.`); return;
    }
    setLoading(true); setErr("");
    try {
      await gradeSubmission(doc.id, m, feedback);
      onGraded(doc.id, m, feedback);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.detail || "Grading failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{doc.graded ? "Edit Grade" : "Grade Submission"}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius)",
          padding: "12px 16px", marginBottom: 16, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13 }}><strong>Student:</strong> {doc.student_name} ({doc.matric_no})</p>
          <p style={{ fontSize: 13, marginTop: 4 }}><strong>File:</strong> {doc.filename}</p>
          <p style={{ fontSize: 13, marginTop: 4 }}><strong>Maximum marks:</strong> {maxMarks}</p>
        </div>

        {assignment?.grading_criteria && (
          <div className="form-group">
            <label className="lbl">Grading criteria</label>
            <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius)",
              padding: "10px 14px", fontSize: 13, color: "var(--text-2)",
              border: "1px solid var(--border)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {assignment.grading_criteria}
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="lbl">Marks awarded * (out of {maxMarks})</label>
          <input type="number" min={0} max={maxMarks} step="0.5"
            placeholder={`Enter a value from 0 to ${maxMarks}`}
            value={marks} onChange={e => setMarks(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="lbl">Feedback to student</label>
          <textarea rows={4} placeholder="Optional comments on this submission…"
            value={feedback} onChange={e => setFeedback(e.target.value)}
            style={{ resize: "vertical" }} />
        </div>

        {err && <div className="alert alert-danger">{err}</div>}

        <div className="modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleGrade} disabled={loading}>
            {loading ? "Saving…" : "Save Grade"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Assignment Form Modal ────────────────────────────────────────── */
function AssignmentModal({ courses, existing, onSave, onClose }) {
  const [title, setTitle]           = useState(existing?.title || "");
  const [desc, setDesc]             = useState(existing?.description || "");
  const [courseId, setCourse]       = useState(existing?.course_id || "");
  const [dueDate, setDue]           = useState(existing?.due_date?.slice(0, 16) || "");
  const [formats, setFormats]       = useState(
    (existing?.allowed_formats || ".pdf,.docx,.txt")
      .split(",").map(f => f.trim().toLowerCase())
  );
  const [active, setActive]         = useState(existing?.is_active ?? true);
  const [maxMarks, setMaxMarks]     = useState(existing?.max_marks ?? 100);
  const [criteria, setCriteria]     = useState(existing?.grading_criteria || "");
  const [autoGrade, setAutoGrade]   = useState(existing?.auto_grade_enabled ?? false);
  const [err, setErr]               = useState("");
  const [loading, setLoading]       = useState(false);

  const allFormats = [".pdf", ".docx", ".txt"];

  const toggleFormat = (f) =>
    setFormats(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const handleSave = async () => {
    if (!title) { setErr("Title is required."); return; }
    if (!courseId) { setErr("Please select a course."); return; }
    if (formats.length === 0) { setErr("Select at least one allowed file format."); return; }
    const m = Number(maxMarks);
    if (!m || m < 1) { setErr("Maximum marks must be at least 1."); return; }
    setLoading(true); setErr("");
    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", desc);
    fd.append("course_id", courseId);
    fd.append("due_date", dueDate);
    fd.append("allowed_formats", formats.join(","));
    fd.append("is_active", active);
    fd.append("max_marks", m);
    fd.append("grading_criteria", criteria);
    fd.append("auto_grade_enabled", autoGrade);
    try {
      if (existing) {
        const r = await updateAssignment(existing.id, fd);
        onSave(r.data, true);
      } else {
        const r = await createAssignment(fd);
        onSave(r.data, false);
      }
    } catch (e) {
      setErr(e.response?.data?.detail || "Failed to save assignment.");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{existing ? "Edit Assignment" : "Create Assignment"}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label className="lbl">Assignment title *</label>
          <input placeholder="e.g. Final Year Project Report"
            value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="lbl">Description / instructions</label>
          <textarea rows={3} placeholder="Optional instructions for students…"
            value={desc} onChange={e => setDesc(e.target.value)} style={{ resize: "vertical" }} />
        </div>
        <div className="form-group">
          <label className="lbl">Course *</label>
          <select value={courseId} onChange={e => setCourse(e.target.value)}
            disabled={!!existing}>
            <option value="">Select a course…</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.course_code} — {c.program} {c.course_name ? `(${c.course_name})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="lbl">Due date & time</label>
            <input type="datetime-local" value={dueDate}
              onChange={e => setDue(e.target.value)} />
            <p className="form-hint">Leave blank for no deadline.</p>
          </div>
          <div className="form-group">
            <label className="lbl">Maximum marks *</label>
            <input type="number" min={1} max={1000} value={maxMarks}
              onChange={e => setMaxMarks(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="lbl">Allowed file formats *</label>
          <div style={{ display: "flex", gap: 10 }}>
            {allFormats.map(f => (
              <label key={f} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: "var(--radius)",
                border: `2px solid ${formats.includes(f) ? "var(--accent)" : "var(--border-2)"}`,
                cursor: "pointer", fontSize: 14, fontWeight: 500,
                background: formats.includes(f) ? "#eff6ff" : "var(--surface)",
                color: formats.includes(f) ? "var(--accent)" : "var(--text-2)",
                transition: "all .15s",
              }}>
                <input type="checkbox" checked={formats.includes(f)}
                  onChange={() => toggleFormat(f)} style={{ width: "auto" }} />
                {f.toUpperCase()}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="lbl">Grading criteria / rubric</label>
          <textarea rows={4} placeholder="Describe how submissions will be graded (e.g. 30% content, 20% structure…)"
            value={criteria} onChange={e => setCriteria(e.target.value)}
            style={{ resize: "vertical" }} />
          <p className="form-hint">This will be shown to you when grading individual submissions.</p>
        </div>
        <div className="form-group">
          <label style={{ display: "flex", alignItems: "center", gap: 8,
            fontSize: 14, cursor: "pointer", color: "var(--text-2)" }}>
            <input type="checkbox" checked={autoGrade}
              onChange={e => setAutoGrade(e.target.checked)} style={{ width: "auto" }} />
            <span>
              Enable AI auto-grading{" "}
              <span style={{ fontSize: 12, color: "var(--text-4)", fontWeight: 400 }}>
                — system will suggest grades based on criteria alignment
              </span>
            </span>
          </label>
        </div>
        <div className="form-group">
          <label style={{ display: "flex", alignItems: "center", gap: 8,
            fontSize: 14, cursor: "pointer", color: "var(--text-2)" }}>
            <input type="checkbox" checked={active}
              onChange={e => setActive(e.target.checked)} style={{ width: "auto" }} />
            Assignment is active (accepting submissions)
          </label>
        </div>

        {err && <div className="alert alert-danger">{err}</div>}

        <div className="modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave} disabled={loading}>
            {loading ? "Saving…" : (existing ? "Update" : "Create Assignment")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────────────────── */
export default function TeacherDashboard() {
  const [tab, setTab] = useState("courses");

  // Courses
  const [courses, setCourses]     = useState([]);
  const [newProgram, setNewProg]  = useState("");
  const [newCode, setNewCode]     = useState("");
  const [newName, setNewName]     = useState("");
  const [courseMsg, setCourseMsg] = useState("");

  // Assignments
  const [assignments, setAssignments] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAssign, setEditingAssign]     = useState(null);
  const [assignMsg, setAssignMsg] = useState("");

  // Submissions
  const [filterCourse, setFilterCourse]   = useState("");
  const [filterAssign, setFilterAssign]   = useState(0);
  const [docs, setDocs]                   = useState([]);
  const [docsLoading, setDocsLoading]     = useState(false);

  // Grading
  const [gradeDoc, setGradeDoc]         = useState(null);
  const [autoGrading, setAutoGrading]   = useState(false);
  const [autoGradeMsg, setAutoGradeMsg] = useState("");

  // Downloading a submission file
  const [downloadingId, setDownloadingId] = useState(null);

  // Similarity
  const [simMode, setSimMode]         = useState("one_all");
  const [primaryIds, setPrimaryIds]   = useState([]);
  const [targetIds, setTargetIds]     = useState([]);
  const [simLoading, setSimLoading]   = useState(false);
  const [simError, setSimError]       = useState("");
  const [simResults, setSimResults]   = useState(null);

  const loadCourses = useCallback(() =>
    getMyCourses().then(r => setCourses(r.data)).catch(() => {}), []);
  const loadAssignments = useCallback(() =>
    getAssignments().then(r => setAssignments(r.data)).catch(() => {}), []);

  useEffect(() => { loadCourses(); loadAssignments(); }, [loadCourses, loadAssignments]);

  const handleRegisterCourse = async () => {
    if (!newProgram || !newCode) { setCourseMsg("Enter program and course code."); return; }
    setCourseMsg("");
    try {
      const r = await registerCourse(newProgram, newCode, newName);
      setCourseMsg(`Registered ${r.data.course_code}.`);
      setNewProg(""); setNewCode(""); setNewName("");
      loadCourses();
    } catch (e) { setCourseMsg(e.response?.data?.detail || "Failed."); }
  };

  const handleSaveAssignment = (data, isUpdate) => {
    if (isUpdate) {
      setAssignments(prev => prev.map(a => a.id === data.id ? data : a));
      setAssignMsg("Assignment updated.");
    } else {
      setAssignments(prev => [data, ...prev]);
      setAssignMsg("Assignment created.");
    }
    setShowAssignModal(false); setEditingAssign(null);
  };

  const handleDeleteAssignment = async (id) => {
    if (!confirm("Delete this assignment?")) return;
    try {
      await deleteAssignment(id);
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (e) { alert(e.response?.data?.detail || "Failed"); }
  };

  const loadDocs = async () => {
    setDocsLoading(true);
    const c = courses.find(c => c.id === Number(filterCourse));
    try {
      const r = await getDocuments(c?.program || "", c?.course_code || "", filterAssign);
      setDocs(r.data);
    } catch { setDocs([]); } finally { setDocsLoading(false); }
  };

  useEffect(() => {
    if (tab === "submissions") loadDocs();
  }, [tab, filterCourse, filterAssign]);

  const handleGraded = (docId, marks, feedback) => {
    setDocs(prev => prev.map(d =>
      d.id === docId ? { ...d, marks, grade_feedback: feedback, graded: true } : d
    ));
  };

  const handleDownload = async (doc) => {
    setDownloadingId(doc.id);
    try {
      const res = await downloadDocument(doc.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not download this file. It may have been deleted from the server.");
    } finally { setDownloadingId(null); }
  };

  const handleAutoGrade = async (assignmentId) => {
    if (!assignmentId) { setAutoGradeMsg("Select an assignment first."); return; }
    setAutoGrading(true); setAutoGradeMsg("");
    try {
      const r = await autoGradeAssignment(assignmentId);
      setAutoGradeMsg(`Auto-graded ${r.data.graded} submission(s). You can review and edit any grade.`);
      await loadDocs();
    } catch (e) {
      setAutoGradeMsg(e.response?.data?.detail || "Auto-grading failed. Ensure grading criteria is set.");
    } finally { setAutoGrading(false); }
  };

  const toggleId = (id, list, setList) =>
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const runSim = async () => {
    if (primaryIds.length === 0) { setSimError("Select at least one primary document."); return; }
    if (["one_one", "one_selected", "many_selected"].includes(simMode) && targetIds.length === 0) {
      setSimError("Select at least one target document for this mode."); return;
    }
    setSimLoading(true); setSimError(""); setSimResults(null);
    try {
      const r = await runSimilarity(simMode, primaryIds,
        ["one_one", "one_selected", "many_selected"].includes(simMode) ? targetIds : null);
      const batches = r.data.map((b, i) => ({ ...b, _primaryDocId: primaryIds[i] || primaryIds[0] }));
      setSimResults(batches);
    } catch (e) {
      setSimError(e.response?.data?.detail || "Similarity comparison failed.");
    } finally { setSimLoading(false); }
  };

  const simModes = [
    { key: "one_one",       label: "One → One",      desc: "Compare 1 submission against 1 specific submission." },
    { key: "one_all",       label: "One → All",       desc: "Compare 1 submission against all others in the course." },
    { key: "one_selected",  label: "One → Selected",  desc: "Compare 1 submission against hand-picked submissions." },
    { key: "many_selected", label: "Many → Selected", desc: "Compare multiple submissions each against selected targets." },
    { key: "many_all",      label: "Many → All",      desc: "Compare multiple submissions each against all others." },
  ];

  const needsTarget  = ["one_one", "one_selected", "many_selected"].includes(simMode);
  const singlePrimary = ["one_one", "one_all", "one_selected"].includes(simMode);

  return (
    <>
      <Nav />
      <div className="page-wide">
        <div className="page-header">
          <h1>Teacher Dashboard</h1>
          <p>Manage your courses, assignments, and run similarity analysis on student submissions.</p>
        </div>

        <div className="tabs">
          {[
            { key: "courses",     label: "Courses"     },
            { key: "assignments", label: "Assignments"  },
            { key: "submissions", label: "Submissions"  },
            { key: "similarity",  label: "Similarity"   },
          ].map(t => (
            <button key={t.key} className={`tab${tab === t.key ? " active" : ""}`}
              onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* ── COURSES ── */}
        {tab === "courses" && (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ marginBottom: 16 }}>Register a New Course</h2>
              <div className="form-row">
                <div className="form-group">
                  <label className="lbl">Program *</label>
                  <input placeholder="e.g. Computer Science" value={newProgram}
                    onChange={e => setNewProg(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="lbl">Course code *</label>
                  <input placeholder="e.g. CSC401" value={newCode}
                    onChange={e => setNewCode(e.target.value.toUpperCase())} />
                </div>
                <div className="form-group">
                  <label className="lbl">Course name (optional)</label>
                  <input placeholder="e.g. Data Structures" value={newName}
                    onChange={e => setNewName(e.target.value)} />
                </div>
              </div>
              <button className="primary" onClick={handleRegisterCourse}>Register Course</button>
              {courseMsg && (
                <div className={`alert ${courseMsg.includes("Reg") ? "alert-success" : "alert-danger"}`}
                  style={{ marginTop: 12, marginBottom: 0 }}>{courseMsg}</div>
              )}
            </div>

            {courses.length === 0 ? (
              <div className="empty-state">
                <h3>No courses yet</h3>
                <p>Register your first course above to get started.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {courses.map(c => (
                  <div key={c.id} className="card card-hover">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 18, color: "var(--primary)" }}>{c.course_code}</div>
                        <div style={{ color: "var(--text-2)", fontSize: 14, marginTop: 2 }}>{c.program}</div>
                        {c.course_name && <div style={{ color: "var(--text-3)", fontSize: 13 }}>{c.course_name}</div>}
                      </div>
                      <span className="badge">#{c.id}</span>
                    </div>
                    <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-3)" }}>
                      {assignments.filter(a => a.course_id === c.id).length} assignment(s)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ASSIGNMENTS ── */}
        {tab === "assignments" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div />
              <button className="primary" onClick={() => { setEditingAssign(null); setShowAssignModal(true); }}>
                + New Assignment
              </button>
            </div>
            {assignMsg && (
              <div className="alert alert-success" style={{ marginBottom: 16 }}>{assignMsg}</div>
            )}

            {assignments.length === 0 ? (
              <div className="empty-state">
                <h3>No assignments yet</h3>
                <p>Create your first assignment so students can submit their work.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {assignments.map(a => {
                  const isOverdue = a.due_date && new Date(a.due_date) < new Date();
                  return (
                    <div key={a.id} className="card card-sm"
                      style={{ display: "flex", alignItems: "flex-start",
                        justifyContent: "space-between", gap: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{a.title}</span>
                          <span className={a.is_active ? "status-active" : "status-inactive"}>
                            {a.is_active ? "Active" : "Inactive"}
                          </span>
                          {isOverdue && <span className="status-overdue">Overdue</span>}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                          {a.course_code} — {a.program}
                          {a.due_date && (
                            <> &nbsp;·&nbsp; Due: <strong style={{ color: isOverdue ? "var(--danger)" : "var(--text-2)" }}>
                              {new Date(a.due_date).toLocaleString()}
                            </strong></>
                          )}
                          &nbsp;·&nbsp; Max: <strong>{a.max_marks ?? 100} marks</strong>
                        </div>
                        {a.description && (
                          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                            {a.description}
                          </div>
                        )}
                        <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                          {a.allowed_formats.split(",").map(f => (
                            <span key={f} className="badge">{f.trim().toUpperCase()}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button className="btn-sm primary"
                          onClick={() => {
                            setFilterAssign(a.id);
                            setFilterCourse(String(a.course_id));
                            setTab("submissions");
                          }}>
                          Submissions
                        </button>
                        <button className="btn-sm"
                          onClick={() => { setEditingAssign(a); setShowAssignModal(true); }}>
                          Edit
                        </button>
                        <button className="btn-sm btn-danger"
                          onClick={() => handleDeleteAssignment(a.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── SUBMISSIONS ── */}
        {tab === "submissions" && (
          <>
            <div className="card card-sm" style={{ marginBottom: 16 }}>
              <div className="form-row" style={{ alignItems: "flex-end" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="lbl">Filter by course</label>
                  <select value={filterCourse}
                    onChange={e => { setFilterCourse(e.target.value); setFilterAssign(0); setAutoGradeMsg(""); }}>
                    <option value="">All courses</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.course_code} — {c.program}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="lbl">Filter by assignment</label>
                  <select value={filterAssign} onChange={e => { setFilterAssign(Number(e.target.value)); setAutoGradeMsg(""); }}>
                    <option value={0}>All assignments</option>
                    {assignments
                      .filter(a => !filterCourse || a.course_id === Number(filterCourse))
                      .map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select>
                </div>
                {/* Auto-grade button — visible when a specific assignment is selected */}
                {filterAssign > 0 && (() => {
                  const selAssign = assignments.find(a => a.id === filterAssign);
                  return selAssign?.grading_criteria ? (
                    <div style={{ flexShrink: 0 }}>
                      <button
                        className="primary"
                        onClick={() => handleAutoGrade(filterAssign)}
                        disabled={autoGrading}
                        title="AI scores each submission based on how well it aligns with the grading criteria"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {autoGrading ? <><span className="spinner" /> Grading…</> : "AI Auto-grade All"}
                      </button>
                    </div>
                  ) : null;
                })()}
              </div>
              {autoGradeMsg && (
                <div className={`alert ${autoGradeMsg.includes("Auto-graded") ? "alert-success" : "alert-danger"}`}
                  style={{ marginTop: 12, marginBottom: 0 }}>
                  {autoGradeMsg}
                </div>
              )}
            </div>

            {docsLoading ? (
              <p style={{ color: "var(--text-3)", textAlign: "center", padding: 32 }}>Loading…</p>
            ) : docs.length === 0 ? (
              <div className="empty-state">
                <h3>No submissions found</h3>
                <p>No documents match the current filter.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Student</th><th>Matric</th>
                      <th>File</th><th>Course</th><th>Submitted</th>
                      <th>Marks</th><th style={{ minWidth: 150 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d, i) => {
                      const assign = assignments.find(a => a.id === d.assignment_id);
                      const maxMk  = assign?.max_marks ?? 100;
                      return (
                        <tr key={d.id}>
                          <td style={{ color: "var(--text-4)" }}>{i + 1}</td>
                          <td style={{ fontWeight: 500 }}>{d.student_name}</td>
                          <td style={{ color: "var(--text-3)", fontSize: 13 }}>{d.matric_no}</td>
                          <td style={{ fontSize: 13 }}>{d.filename}</td>
                          <td><span className="badge">{d.course_code}</span></td>
                          <td style={{ fontSize: 12, color: "var(--text-4)" }}>{d.uploaded_at?.slice(0, 16)}</td>
                          <td>
                            {d.graded
                              ? <span style={{ fontWeight: 600, color: "var(--primary)" }}>
                                  {d.marks} / {maxMk}
                                </span>
                              : <span style={{ color: "var(--text-4)", fontSize: 12 }}>Not graded</span>
                            }
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                className="btn-xs"
                                onClick={() => handleDownload(d)}
                                disabled={downloadingId === d.id}
                                title="Download the submitted file"
                              >
                                {downloadingId === d.id ? "…" : "Download"}
                              </button>
                              <button className="btn-xs primary"
                                onClick={() => setGradeDoc(d)}>
                                {d.graded ? "Edit Grade" : "Grade"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── SIMILARITY ── */}
        {tab === "similarity" && (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ marginBottom: 14 }}>Step 1 — Select the Course & Assignment</h2>
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="lbl">Course</label>
                  <select value={filterCourse}
                    onChange={e => { setFilterCourse(e.target.value); setFilterAssign(0); setPrimaryIds([]); setTargetIds([]); }}>
                    <option value="">All courses</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.course_code} — {c.program}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="lbl">Assignment (optional filter)</label>
                  <select value={filterAssign} onChange={e => setFilterAssign(Number(e.target.value))}>
                    <option value={0}>All assignments</option>
                    {assignments
                      .filter(a => !filterCourse || a.course_id === Number(filterCourse))
                      .map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button className="primary" onClick={loadDocs} disabled={docsLoading}>
                    {docsLoading ? "Loading…" : "Load Submissions"}
                  </button>
                </div>
              </div>
            </div>

            {docs.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <h2 style={{ marginBottom: 14 }}>Step 2 — Choose Similarity Mode</h2>
                <div className="mode-grid">
                  {simModes.map(m => (
                    <div key={m.key}
                      className={`mode-option${simMode === m.key ? " selected" : ""}`}
                      onClick={() => { setSimMode(m.key); setPrimaryIds([]); setTargetIds([]); }}>
                      <div className="mode-title">{m.label}</div>
                      <div className="mode-desc">{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {docs.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <h2 style={{ marginBottom: 14 }}>Step 3 — Select Documents</h2>

                <div style={{ display: "grid", gridTemplateColumns: needsTarget ? "1fr 1fr" : "1fr", gap: 20 }}>
                  <div>
                    <label className="lbl" style={{ marginBottom: 8 }}>
                      Primary document(s) {singlePrimary ? "(select 1)" : "(select 1 or more)"}
                    </label>
                    <div className="check-list" style={{ maxHeight: 280, overflowY: "auto" }}>
                      {docs.map(d => (
                        <div key={d.id}
                          className={`check-item${primaryIds.includes(d.id) ? " selected" : ""}`}
                          onClick={() => {
                            if (singlePrimary) {
                              setPrimaryIds(primaryIds.includes(d.id) ? [] : [d.id]);
                            } else {
                              toggleId(d.id, primaryIds, setPrimaryIds);
                            }
                          }}>
                          <input type={singlePrimary ? "radio" : "checkbox"} readOnly
                            checked={primaryIds.includes(d.id)} style={{ width: "auto" }} />
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{d.student_name}</div>
                            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                              {d.matric_no} · {d.filename}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {needsTarget && (
                    <div>
                      <label className="lbl" style={{ marginBottom: 8 }}>
                        Target document(s) (select {simMode === "one_one" ? "1" : "1 or more"})
                      </label>
                      <div className="check-list" style={{ maxHeight: 280, overflowY: "auto" }}>
                        {docs.filter(d => !primaryIds.includes(d.id)).map(d => (
                          <div key={d.id}
                            className={`check-item${targetIds.includes(d.id) ? " selected" : ""}`}
                            onClick={() => {
                              if (simMode === "one_one") {
                                setTargetIds(targetIds.includes(d.id) ? [] : [d.id]);
                              } else {
                                toggleId(d.id, targetIds, setTargetIds);
                              }
                            }}>
                            <input type={simMode === "one_one" ? "radio" : "checkbox"} readOnly
                              checked={targetIds.includes(d.id)} style={{ width: "auto" }} />
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{d.student_name}</div>
                              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                                {d.matric_no} · {d.filename}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
                  <button className="primary btn-accent" onClick={runSim} disabled={simLoading}
                    style={{ padding: "11px 28px", fontSize: 15 }}>
                    {simLoading ? <><span className="spinner" /> Running analysis…</> : "Run Similarity Analysis"}
                  </button>
                  <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                    {primaryIds.length} primary · {targetIds.length} target selected
                  </span>
                </div>
                {simError && <div className="alert alert-danger" style={{ marginTop: 12, marginBottom: 0 }}>{simError}</div>}
              </div>
            )}

            {docs.length === 0 && !docsLoading && (
              <div className="empty-state">
                <h3>No submissions loaded</h3>
                <p>Select a course or assignment above and click "Load Submissions".</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAssignModal && (
        <AssignmentModal
          courses={courses}
          existing={editingAssign}
          onSave={handleSaveAssignment}
          onClose={() => { setShowAssignModal(false); setEditingAssign(null); }}
        />
      )}

      {gradeDoc && (
        <GradeModal
          doc={gradeDoc}
          assignment={assignments.find(a => a.id === gradeDoc.assignment_id)}
          onClose={() => setGradeDoc(null)}
          onGraded={handleGraded}
        />
      )}

      {simResults && (
        <SimilarityResults
          batches={simResults}
          onClose={() => setSimResults(null)}
        />
      )}
    </>
  );
}
