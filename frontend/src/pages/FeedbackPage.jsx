import { useEffect, useState } from "react";
import { getMyFeedback } from "../api";

const RISK = { High:"risk-high", Medium:"risk-medium", Low:"risk-low" };

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

export default function FeedbackPage() {
  const [items, setItems]   = useState(null);
  const [error, setError]   = useState("");

  useEffect(() => {
    getMyFeedback()
      .then(r => setItems(r.data))
      .catch(() => { setError("Could not load feedback."); setItems([]); });
  }, []);

  return (
    <>
      <Nav />
      <div className="page">
        <h1 style={{fontSize:22,fontWeight:500,marginBottom:6}}>My feedback</h1>
        <p style={{fontSize:13,color:"#888",marginBottom:24}}>
          Similarity findings your teacher has shared with you.
        </p>

        {error && <p style={{fontSize:13,color:"#993C1D"}}>{error}</p>}

        {items && items.length === 0 && !error && (
          <div className="card">
            <p style={{fontSize:14,color:"#555"}}>No feedback yet.</p>
            <p style={{fontSize:13,color:"#888",marginTop:6}}>
              Once your teacher runs a comparison and shares the result, it will appear here.
            </p>
          </div>
        )}

        {items && items.map(f => (
          <div key={f.id} className="card" style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"baseline",marginBottom:8,flexWrap:"wrap",gap:8}}>
              <span style={{fontSize:14,fontWeight:500}}>
                {f.course_code} · {f.program}
              </span>
              <span style={{fontSize:12,color:"#888"}}>{f.created_at?.slice(0,16)}</span>
            </div>

            <p style={{fontSize:13,marginBottom:6}}>
              Your work was similar to{" "}
              <strong>{f.similar_to_name}</strong>{" "}
              <span style={{color:"#888"}}>
                ({f.similar_to_matric} · {f.similar_to_program})
              </span>
            </p>

            <div style={{display:"flex",alignItems:"center",gap:14,marginTop:6}}>
              <span style={{fontSize:24,fontWeight:600}}>{f.percentage}%</span>
              <span className={RISK[f.level]} style={{fontSize:14}}>{f.level} similarity</span>
            </div>

            {f.message && (
              <p style={{fontSize:13,color:"#444",marginTop:12,paddingTop:12,
                borderTop:"1px solid #f0f0ee"}}>
                <span style={{color:"#888"}}>Note from teacher: </span>{f.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
