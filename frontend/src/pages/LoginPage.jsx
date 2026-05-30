import { useState } from "react";
import { login } from "../api";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in both fields."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await login(email, password);
      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("role",  res.data.role);
      localStorage.setItem("name",  res.data.name);
      window.location.href = res.data.role === "teacher" ? "/results" : "/upload";
    } catch (e) {
      if (e.response?.status === 401) {
        setError("Incorrect email or password.");
      } else if (e.response) {
        setError(e.response.data?.detail || "Login failed. Please try again.");
      } else {
        setError("Cannot reach the server. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",
      justifyContent:"center",background:"#f9f9f8"}}>
      <div className="card" style={{width:"100%",maxWidth:380}}>
        <h1 style={{fontSize:20,fontWeight:500,marginBottom:6}}>Similarity Engine</h1>
        <p style={{fontSize:13,color:"#888",marginBottom:24}}>
          Sign in to continue.{" "}
          <a href="/register" style={{color:"#1a1a1a"}}>Create account</a>
        </p>

        <label className="lbl">Email</label>
        <input type="email" placeholder="you@school.com" value={email}
          onChange={e => setEmail(e.target.value)} style={{marginBottom:12}} />

        <label className="lbl">Password</label>
        <input type="password" placeholder="••••••••" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          style={{marginBottom:20}} />

        <button className="primary" onClick={handleLogin} disabled={loading}
          style={{width:"100%"}}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {error && <p style={{fontSize:13,color:"#993C1D",marginTop:12}}>{error}</p>}
      </div>
    </div>
  );
}
