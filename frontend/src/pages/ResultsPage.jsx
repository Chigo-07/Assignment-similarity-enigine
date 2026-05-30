import { useEffect, useState } from "react";
import {
  getMyCourses, registerCourse, getDocuments,
  compareDocument, downloadReport, sendFeedback,
} from "../api";

const RISK = { High:"risk-high", Medium:"risk-medium", Low:"risk-low" };

function Nav() {
  const name = localStorage.getItem("name");
  return (
    <nav className="nav">
      <span className="nav-title">Similarity Engine</span>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:13,color:"#555"}}>{name}</span>
        <span className="nav-role">Teacher</span>
        <button className="nav-logout"
          onClick={()=>{localStorage.clear();window.location.href="/login";}}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

export default function ResultsPage() {
  const [courses, setCourses]       = useState([]);
  const [newProgram, setNewProgram] = useState("");
  const [newCourse, setNewCourse]   = useState("");
  const [regMsg, setRegMsg]         = useState("");

  const [courseIdx, setCourseIdx]   = useState("");
  const [docs, setDocs]             = useState([]);
  const [selectedDoc, setSelectedDoc] = useState("");

  const [results, setResults]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  const [fbMessage, setFbMessage]   = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [fbStatus, setFbStatus]     = useState("");

  const loadCourses = () => getMyCourses().then(r => setCourses(r.data)).catch(()=>{});
  useEffect(() => { loadCourses(); }, []);

  const handleRegisterCourse = async () => {
    if (!newProgram || !newCourse) { setRegMsg("Enter both program and course code."); return; }
    try {
      await registerCourse(newProgram, newCourse);
      setRegMsg(`Registered ${newCourse.toUpperCase()}.`);
      setNewProgram(""); setNewCourse("");
      loadCourses();
    } catch (e) {
      setRegMsg(e.response?.data?.detail || "Could not register course.");
    }
  };

  const onCourseChange = (idx) => {
    setCourseIdx(idx); setSelectedDoc(""); setResults(null); setError("");
    if (idx === "") { setDocs([]); return; }
    const c = courses[idx];
    getDocuments(c.program, c.course_code).then(r => setDocs(r.data)).catch(()=>setDocs([]));
  };

  const runCompare = async () => {
    if (!selectedDoc) return;
    setLoading(true); setError(""); setResults(null); setFbStatus("");
    try {
      const r = await compareDocument(selectedDoc);
      setResults(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Comparison failed.");
    } finally { setLoading(false); }
  };

  const handleDownload = async () => {
    try {
      const res = await downloadReport(selectedDoc);
      const url = URL.createObjectURL(new Blob([res.data], { type:"application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `similarity_report_${selectedDoc}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download the report.");
    }
  };

  const handleSendFeedback = async () => {
    setFbStatus("");
    try {
      const r = await sendFeedback(selectedDoc, fbMessage, onlyFlagged);
      setFbStatus(`Feedback sent to the student (${r.data.sent} finding(s)).`);
    } catch (e) {
      setFbStatus(e.response?.data?.detail || "Could not send feedback.");
    }
  };

  return (
    <>
      <Nav />
      <div className="page-wide">
        <h1 style={{fontSize:22,fontWeight:500,marginBottom:6}}>Similarity console</h1>
        <p style={{fontSize:13,color:"#888",marginBottom:24}}>
          Register the courses you oversee, then compare a primary document against
          the rest of that course and send feedback to the student.
        </p>

        {/* Register course */}
        <div className="card" style={{marginBottom:16}}>
          <h2 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Register a course</h2>
          <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200}}>
              <label className="lbl">Program</label>
              <input placeholder="e.g. Computer Science" value={newProgram}
                onChange={e=>setNewProgram(e.target.value)} />
            </div>
            <div style={{flex:1,minWidth:160}}>
              <label className="lbl">Course code</label>
              <input placeholder="e.g. CSC401" value={newCourse}
                onChange={e=>setNewCourse(e.target.value)} />
            </div>
            <button className="primary" onClick={handleRegisterCourse}
              style={{whiteSpace:"nowrap"}}>Register</button>
          </div>
          {regMsg && <p style={{fontSize:12,color:"#555",marginTop:10}}>{regMsg}</p>}
          {courses.length > 0 && (
            <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:6}}>
              {courses.map(c => (
                <span key={c.id} className="badge">
                  {c.course_code} · {c.program}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pick course + document */}
        <div className="card" style={{marginBottom:16}}>
          <h2 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Compare documents</h2>
          <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:220}}>
              <label className="lbl">Course</label>
              <select value={courseIdx} onChange={e=>onCourseChange(e.target.value)}>
                <option value="">Choose a course...</option>
                {courses.map((c,i)=>(
                  <option key={c.id} value={i}>{c.course_code} — {c.program}</option>
                ))}
              </select>
            </div>
            <div style={{flex:2,minWidth:240}}>
              <label className="lbl">Primary document</label>
              <select value={selectedDoc} onChange={e=>setSelectedDoc(e.target.value)}
                disabled={courseIdx===""}>
                <option value="">
                  {courseIdx==="" ? "Select a course first" : "Choose a document..."}
                </option>
                {docs.map(d=>(
                  <option key={d.id} value={d.id}>
                    {d.filename} — {d.student_name} ({d.matric_no})
                  </option>
                ))}
              </select>
            </div>
            <button className="primary" onClick={runCompare}
              disabled={loading||!selectedDoc} style={{whiteSpace:"nowrap"}}>
              {loading ? "Comparing..." : "Run comparison"}
            </button>
          </div>
          {courseIdx!=="" && docs.length===0 &&
            <p style={{fontSize:12,color:"#993C1D",marginTop:10}}>
              No documents submitted to this course yet.
            </p>}
        </div>

        {error && <p style={{fontSize:13,color:"#993C1D",marginBottom:16}}>{error}</p>}

        {results && (
          <>
            <p style={{fontSize:13,color:"#888",marginBottom:14}}>
              Comparing <strong style={{color:"#1a1a1a"}}>{results.primary_document}</strong>{" "}
              ({results.student}) in <strong style={{color:"#1a1a1a"}}>{results.course_code}</strong>{" "}
              against <strong style={{color:"#1a1a1a"}}>{results.total_compared}</strong> other document(s).
            </p>

            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:"1px solid #e5e5e3",textAlign:"left"}}>
                    {["Rank","Document","Student","Matric","Program","TF-IDF","Trigram","Semantic","Final","Risk"]
                      .map(h=><th key={h} style={{padding:"8px 12px",fontWeight:500,color:"#555"}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid #f0f0ee",
                      background:i%2===0?"#fff":"#fafaf9"}}>
                      <td style={{padding:"10px 12px",color:"#888"}}>#{i+1}</td>
                      <td style={{padding:"10px 12px",fontWeight:500}}>{r.filename}</td>
                      <td style={{padding:"10px 12px"}}>{r.student_name}</td>
                      <td style={{padding:"10px 12px"}}>{r.matric_no}</td>
                      <td style={{padding:"10px 12px"}}>{r.program}</td>
                      <td style={{padding:"10px 12px"}}>{r.tfidf_score}%</td>
                      <td style={{padding:"10px 12px"}}>{r.trigram_score}%</td>
                      <td style={{padding:"10px 12px"}}>{r.sbert_score}%</td>
                      <td style={{padding:"10px 12px",fontWeight:500}}>{r.final_score}%</td>
                      <td style={{padding:"10px 12px"}}>
                        <span className={RISK[r.risk_level]}>{r.risk_level}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="card" style={{marginTop:20}}>
              <h2 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Send feedback to student</h2>
              <label className="lbl">Message (optional)</label>
              <textarea rows={3} value={fbMessage} onChange={e=>setFbMessage(e.target.value)}
                placeholder="e.g. Please review the flagged sections and meet me during office hours."
                style={{marginBottom:12,resize:"vertical"}} />
              <label style={{fontSize:13,color:"#555",display:"flex",alignItems:"center",
                gap:8,marginBottom:14}}>
                <input type="checkbox" checked={onlyFlagged}
                  onChange={e=>setOnlyFlagged(e.target.checked)}
                  style={{width:"auto",margin:0}} />
                Only send High / Medium risk findings
              </label>
              <div style={{display:"flex",gap:10}}>
                <button className="primary" onClick={handleSendFeedback}>Send feedback</button>
                <button onClick={handleDownload}>Download PDF report</button>
              </div>
              {fbStatus && <p style={{fontSize:13,color:"#27500A",marginTop:12}}>{fbStatus}</p>}
            </div>

            {/* Matched phrases */}
            {results.results.some(r=>r.matched_phrases?.length>0) && (
              <div style={{marginTop:24}}>
                <h2 style={{fontSize:16,fontWeight:500,marginBottom:12}}>Matched phrases</h2>
                {results.results.filter(r=>r.matched_phrases?.length>0).slice(0,3).map((r,i)=>(
                  <div key={i} className="card" style={{marginBottom:10}}>
                    <p style={{fontSize:13,fontWeight:500,marginBottom:8}}>
                      With {r.filename} <span style={{fontWeight:400,color:"#888"}}>({r.student_name})</span>
                    </p>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {r.matched_phrases.slice(0,12).map((p,j)=>(
                        <span key={j} style={{fontSize:12,padding:"3px 8px",
                          background:"#FAEEDA",color:"#633806",borderRadius:999}}>{p}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
