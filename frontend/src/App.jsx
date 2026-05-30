import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage    from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UploadPage   from "./pages/UploadPage";
import FeedbackPage from "./pages/FeedbackPage";
import ResultsPage  from "./pages/ResultsPage";

function PrivateRoute({ children, teacherOnly = false }) {
  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");
  if (!token) return <Navigate to="/login" />;
  if (teacherOnly && role !== "teacher") return <Navigate to="/upload" />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/upload"   element={<PrivateRoute><UploadPage /></PrivateRoute>} />
        <Route path="/feedback" element={<PrivateRoute><FeedbackPage /></PrivateRoute>} />
        <Route path="/results"  element={<PrivateRoute teacherOnly><ResultsPage /></PrivateRoute>} />
        <Route path="*"         element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
