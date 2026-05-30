import { useState, useEffect } from "react";
import { uploadDocument, getTeachers, getTeacherCourses } from "../api";

function Nav() {
  const name = localStorage.getItem("name");
  return (
    <nav className="nav">
      <span className="nav-title">Similarity Engine</span>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <a href="/upload" className="nav-link">Upload</a>
        <a href="/feedback" className="nav-link">My feedback</a>
        <span style={{fontSize:13,color:"#555"}}>{name}</span>
        <span className="nav-role">Student</span>
        <button className="nav-logout"
          onClick={()=>{localStorage.clear();window.location.href="/login";}}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

export default function UploadPage() {
  const [teachers, setTeachers]   = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [courses, setCourses]     = useState([]);
  const [courseIdx, setCourseIdx] = useState("");
  const [studentName, setName]    = useState("");
  const [matricNo, setMatric]     = useState("");
  const [files, setFiles]         = useState([]);
  const [status, setStatus]       = useState("");
  const [loading, setLoading]     = useState(false);

  useEffect(() => { getTeachers().then(r => setTeachers(r.data)).catch(()=>{}); }, []);

  useEffect(() => {
    setCourses([]); setCourseIdx("");
    if (teacherId) {
      getTeacherCourses(teacherId).then(r => setCourses(r.data)).catch(()=>{});
    }
  }, [teacherId]);

  const handleUpload = async () => {
    if (!teacherId || courseIdx === "" || !studentName || !matricNo || !files.length) {
      setStatus("Please choose a teacher, a course, fill your details and select file(s).");
      return;
    }
    const course = courses[courseIdx];
    setLoading(true); setStatus("");
    let uploaded = 0;
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("student_name", studentName);
      fd.append("matric_no", matricNo);
      fd.append("program", course.program);
      fd.append("course_code", course.course_code);
      fd.append("teacher_id", teacherId);
      try {
        await uploadDocument(fd);
        uploaded++;
      } catch (e) {
        setStatus(`Error uploading ${file.name}: ${e.response?.data?.detail || e.message}`);
        setLoading(false); return;
      }
    }
    setStatus(`${uploaded} file(s) submitted to ${course.course_code} successfully.`);
    setFiles([]); setLoading(false);
  };

  return (
    <>
      <Nav />
      <div className="page">
        <h1 style={{fontSize:22,fontWeight:500,marginBottom:6}}>Submit document</h1>
        <p style={{fontSize:13,color:"#888",marginBottom:24}}>
          Choose your teacher and course, then upload your work. Accepted formats: PDF, DOCX, TXT.
        </p>

        <div className="card" style={{marginBottom:16}}>
          <label className="lbl">Teacher</label>
          <select value={teacherId} onChange={e=>setTeacherId(e.target.value)}
            style={{marginBottom:14}}>
            <option value="">Choose a teacher...</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <label className="lbl">Program &amp; course code</label>
          <select value={courseIdx} onChange={e=>setCourseIdx(e.target.value)}
            disabled={!teacherId} style={{marginBottom:14}}>
            <option value="">
              {teacherId ? "Choose a course..." : "Select a teacher first"}
            </option>
            {courses.map((c, i) => (
              <option key={c.id} value={i}>{c.course_code} — {c.program}</option>
            ))}
          </select>
          {teacherId && courses.length === 0 &&
            <p style={{fontSize:12,color:"#993C1D",marginBottom:14}}>
              This teacher has not registered any courses yet.
            </p>}

          <label className="lbl">Full name</label>
          <input placeholder="e.g. Chidi Eze" value={studentName}
            onChange={e=>setName(e.target.value)} style={{marginBottom:14}} />

          <label className="lbl">Matric number</label>
          <input placeholder="e.g. CSC/2021/045" value={matricNo}
            onChange={e=>setMatric(e.target.value)} style={{marginBottom:14}} />

          <label className="lbl">Select file(s)</label>
          <input type="file" multiple accept=".pdf,.docx,.txt"
            onChange={e=>setFiles([...e.target.files])} style={{marginBottom:6}} />
          {files.length > 0 &&
            <p style={{fontSize:12,color:"#888",marginBottom:14}}>{files.length} file(s) selected</p>}

          <button className="primary" onClick={handleUpload} disabled={loading}>
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>

        {status && (
          <p style={{fontSize:13,padding:"10px 14px",borderRadius:8,
            background: status.toLowerCase().includes("error") ? "#FAECE7" : "#EAF3DE",
            color: status.toLowerCase().includes("error") ? "#712B13" : "#27500A"}}>
            {status}
          </p>
        )}
      </div>
    </>
  );
}
