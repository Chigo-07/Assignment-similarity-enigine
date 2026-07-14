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

// ── auth ──────────────────────────────────────────────────────
export const login = (email, password) =>
  api.post("/auth/login", new URLSearchParams({ username: email, password }));

export const register = (name, email, password, role, teacherCode = "") =>
  api.post("/auth/register", new URLSearchParams({
    name, email, password, role, teacher_code: teacherCode,
  }));

export const getMe = () => api.get("/auth/me");

// ── admin — stats & users ─────────────────────────────────────
export const getAdminStats     = ()         => api.get("/admin/stats");
export const getAdminUsers     = ()         => api.get("/admin/users");
export const toggleUserActive  = (id)       => api.patch(`/admin/users/${id}/toggle`);

// ── admin — teacher access codes ─────────────────────────────
export const getTeacherCodes   = ()         => api.get("/admin/teacher-codes");
export const createTeacherCode = (label, customCode = "") =>
  api.post("/admin/teacher-codes", new URLSearchParams({ label, custom_code: customCode }));
export const deleteTeacherCode = (id)       => api.delete(`/admin/teacher-codes/${id}`);

// ── admin — courses & enrollments ────────────────────────────
export const getAdminCourses      = ()         => api.get("/admin/courses");
export const getAdminEnrollments  = ()         => api.get("/admin/enrollments");
export const enrollStudent        = (studentId, courseId) =>
  api.post("/admin/enrollments", new URLSearchParams({ student_id: studentId, course_id: courseId }));
export const removeEnrollment     = (id)       => api.delete(`/admin/enrollments/${id}`);

// ── teachers & courses ────────────────────────────────────────
export const getTeachers       = ()           => api.get("/teachers");
export const getTeacherCourses = (teacherId)  => api.get(`/teachers/${teacherId}/courses`);
export const registerCourse    = (program, courseCode, courseName = "") =>
  api.post("/courses", new URLSearchParams({ program, course_code: courseCode, course_name: courseName }));
export const getMyCourses      = ()           => api.get("/courses");

// ── assignments ───────────────────────────────────────────────
export const createAssignment = (data) => api.post("/assignments", data);  // FormData
export const getAssignments   = ()     => api.get("/assignments");
export const updateAssignment = (id, data) => api.put(`/assignments/${id}`, data);
export const deleteAssignment = (id)   => api.delete(`/assignments/${id}`);

// ── student — enrolled assignments & self-enrollment ────────
export const getMyAssignments    = ()         => api.get("/my-assignments");
export const getAvailableCourses = ()         => api.get("/courses/all");
export const selfEnroll          = (courseId) =>
  api.post("/student/enroll", new URLSearchParams({ course_id: courseId }));
export const selfUnenroll        = (courseId) => api.delete(`/student/enroll/${courseId}`);

// ── documents ─────────────────────────────────────────────────
export const submitToAssignment = (assignmentId, formData) =>
  api.post(`/assignments/${assignmentId}/submit`, formData);

export const uploadDocument = (formData) => api.post("/documents/upload", formData);

export const getDocuments = (program = "", courseCode = "", assignmentId = 0) =>
  api.get("/documents", { params: { program, course_code: courseCode, assignment_id: assignmentId } });

// ── similarity ────────────────────────────────────────────────
export const runSimilarity = (mode, primaryIds, targetIds = null) =>
  api.post("/similarity/run", { mode, primary_ids: primaryIds, target_ids: targetIds });

export const compareDocument = (id) => api.post(`/compare/${id}`);

// ── grading ───────────────────────────────────────────────────
export const downloadDocument = (docId) =>
  api.get(`/documents/${docId}/download`, { responseType: "blob" });

export const gradeSubmission = (docId, marks, gradeFeedback) =>
  api.post(`/documents/${docId}/grade`,
    new URLSearchParams({ marks, grade_feedback: gradeFeedback }));

export const autoGradeAssignment = (assignmentId) =>
  api.post(`/assignments/${assignmentId}/auto-grade`);

// ── reports & feedback ────────────────────────────────────────
export const downloadReport = (id) =>
  api.post(`/reports/${id}`, null, { responseType: "blob" });

export const sendFeedback = (id, message = "", onlyFlagged = false) =>
  api.post(`/feedback/${id}`, new URLSearchParams({ message, only_flagged: onlyFlagged }));

export const getMyFeedback = () => api.get("/feedback/me");
