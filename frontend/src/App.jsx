import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage       from "./pages/LoginPage";
import RegisterPage    from "./pages/RegisterPage";
import AdminDashboard  from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import FeedbackPage    from "./pages/FeedbackPage";

function PrivateRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");
  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === "admin")   return <Navigate to="/admin" replace />;
    if (role === "teacher") return <Navigate to="/teacher" replace />;
    return <Navigate to="/student" replace />;
  }
  return children;
}

function DefaultRedirect() {
  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");
  if (!token) return <Navigate to="/login" replace />;
  if (role === "admin")   return <Navigate to="/admin" replace />;
  if (role === "teacher") return <Navigate to="/teacher" replace />;
  return <Navigate to="/student" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/admin" element={
          <PrivateRoute allowedRoles={["admin"]}><AdminDashboard /></PrivateRoute>
        } />

        <Route path="/teacher" element={
          <PrivateRoute allowedRoles={["teacher"]}><TeacherDashboard /></PrivateRoute>
        } />

        <Route path="/student" element={
          <PrivateRoute allowedRoles={["student"]}><StudentDashboard /></PrivateRoute>
        } />

        <Route path="/feedback" element={
          <PrivateRoute allowedRoles={["student"]}><FeedbackPage /></PrivateRoute>
        } />

        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
