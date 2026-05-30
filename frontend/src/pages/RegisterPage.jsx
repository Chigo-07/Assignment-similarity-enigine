import { useState } from "react";
import { register } from "../api";

export default function RegisterPage() {
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [role, setRole]             = useState("student");
  const [teacherCode, setTeacherCode] = useState("");
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [loading, setLoading]       = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirm) {
      setError("Please fill in all fields."); return;
    }
    if (password !== confirm) {
      setError("Passwords do not match."); return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }
    if (role === "teacher" && !teacherCode) {
      setError("Please enter the teacher access code."); return;
    }
    setLoading(true); setError("");
    try {
      await register(name, email, password, role, teacherCode);
      setSuccess("Account created! You can now sign in.");
      setName(""); setEmail(""); setPassword("");
      setConfirm(""); setTeacherCode("");
    } catch (e) {
      setError(e.response?.data?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",
      justifyContent:"center",background:"#f9f9f8"}}>
      <div className="card" style={{width:"100%",maxWidth:400}}>
        <h1 style={{fontSize:20,fontWeight:500,marginBottom:4}}>Create account</h1>
        <p style={{fontSize:13,color:"#888",marginBottom:24}}>
          Already have an account?{" "}
          <a href="/login" style={{color:"#1a1a1a"}}>Sign in</a>
        </p>

        <label style={{fontSize:13,color:"#555",display:"block",marginBottom:4}}>
          Full name
        </label>
        <input
          placeholder="e.g. Chidi Eze"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{marginBottom:12}}
        />

        <label style={{fontSize:13,color:"#555",display:"block",marginBottom:4}}>
          Email address
        </label>
        <input
          type="email"
          placeholder="you@university.edu"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{marginBottom:12}}
        />

        <label style={{fontSize:13,color:"#555",display:"block",marginBottom:4}}>
          Role
        </label>
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          style={{marginBottom:12}}
        >
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
        </select>

        {role === "teacher" && (
          <>
            <label style={{fontSize:13,color:"#555",display:"block",marginBottom:4}}>
              Teacher access code
            </label>
            <input
              placeholder="Enter code provided by admin"
              value={teacherCode}
              onChange={e => setTeacherCode(e.target.value)}
              style={{marginBottom:12}}
            />
          </>
        )}

        <label style={{fontSize:13,color:"#555",display:"block",marginBottom:4}}>
          Password
        </label>
        <input
          type="password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{marginBottom:12}}
        />

        <label style={{fontSize:13,color:"#555",display:"block",marginBottom:4}}>
          Confirm password
        </label>
        <input
          type="password"
          placeholder="Repeat password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleRegister()}
          style={{marginBottom:20}}
        />

        <button
          className="primary"
          onClick={handleRegister}
          disabled={loading}
          style={{width:"100%"}}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        {error && (
          <p style={{fontSize:13,color:"#993C1D",marginTop:12}}>{error}</p>
        )}

        {success && (
          <div style={{marginTop:12,padding:"10px 14px",borderRadius:8,
            background:"#EAF3DE",color:"#27500A",fontSize:13}}>
            {success}{" "}
            <a href="/login" style={{color:"#27500A",fontWeight:500}}>
              Sign in now →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}