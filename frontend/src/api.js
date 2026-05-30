import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── auth ──────────────────────────────────────────────
export const login = (email, password) =>
  api.post("/auth/login", new URLSearchParams({ username: email, password }));

export const register = (name, email, password, role, teacherCode = "") =>
  api.post("/auth/register", new URLSearchParams({
    name, email, password, role, teacher_code: teacherCode,
  }));

// ── teachers & courses ────────────────────────────────
export const getTeachers       = ()           => api.get("/teachers");
export const getTeacherCourses = (teacherId)   => api.get(`/teachers/${teacherId}/courses`);
export const registerCourse    = (program, courseCode) =>
  api.post("/courses", new URLSearchParams({ program, course_code: courseCode }));
export const getMyCourses      = ()           => api.get("/courses");

// ── documents ─────────────────────────────────────────
export const uploadDocument = (formData) => api.post("/documents/upload", formData);
export const getDocuments   = (program = "", courseCode = "") =>
  api.get("/documents", { params: { program, course_code: courseCode } });

// ── compare / report / feedback ───────────────────────
export const compareDocument = (id) => api.post(`/compare/${id}`);

export const downloadReport = (id) =>
  api.post(`/reports/${id}`, null, { responseType: "blob" });

export const sendFeedback = (id, message = "", onlyFlagged = false) =>
  api.post(`/feedback/${id}`, new URLSearchParams({
    message, only_flagged: onlyFlagged,
  }));

export const getMyFeedback = () => api.get("/feedback/me");
