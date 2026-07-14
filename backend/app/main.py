from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.database import (
    get_db, seed_default_admin,
    User, TeacherAccessCode, TeacherCourse,
    Assignment, StudentEnrollment, Document, Feedback,
)
from app.auth import (
    hash_password, verify_password, create_token,
    get_current_user, require_admin, require_teacher, require_student,
)
from app.parser import extract_text
from app.preprocessor import clean_text
from app.similarity import compare_documents
from app.reporter import generate_report
import shutil, uuid, os, secrets

app = FastAPI(title="Assignment Similarity Engine API")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
allowed_origins = ["http://localhost:5173"]
if FRONTEND_URL:
    allowed_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("reports", exist_ok=True)


@app.on_event("startup")
def on_startup():
    seed_default_admin()


# ── HEALTH ───────────────────────────────────────────────
@app.get("/")
def health_check():
    return {"status": "running", "app": "Assignment Similarity Engine"}


# ── AUTH ─────────────────────────────────────────────────
@app.post("/auth/register")
def register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form(default="student"),
    teacher_code: str = Form(default=""),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Email already registered")
    if role not in ("student", "teacher"):
        raise HTTPException(400, "Invalid role — choose student or teacher")
    if role == "teacher":
        code_row = db.query(TeacherAccessCode).filter(
            TeacherAccessCode.code == teacher_code,
            TeacherAccessCode.is_used == False,
        ).first()
        if not code_row:
            raise HTTPException(403, "Invalid or already-used teacher access code")
    user = User(name=name, email=email,
                hashed_password=hash_password(password), role=role)
    db.add(user)
    db.flush()
    if role == "teacher":
        code_row.is_used = True
        code_row.used_by = user.id
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(403, "Account is deactivated. Contact the administrator.")
    token = create_token(user.id, user.email, user.role)
    return {"access_token": token, "token_type": "bearer",
            "id": user.id, "role": user.role, "name": user.name}


@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name,
            "email": current_user.email, "role": current_user.role}


# ── ADMIN ────────────────────────────────────────────────

@app.get("/admin/stats")
def admin_stats(db: Session = Depends(get_db), admin=Depends(require_admin)):
    return {
        "total_users":       db.query(User).count(),
        "total_teachers":    db.query(User).filter(User.role == "teacher").count(),
        "total_students":    db.query(User).filter(User.role == "student").count(),
        "total_courses":     db.query(TeacherCourse).count(),
        "total_assignments": db.query(Assignment).count(),
        "total_submissions": db.query(Document).count(),
        "total_enrollments": db.query(StudentEnrollment).count(),
    }


@app.get("/admin/users")
def admin_list_users(db: Session = Depends(get_db), admin=Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role,
             "is_active": u.is_active, "created_at": str(u.created_at)} for u in users]


@app.patch("/admin/users/{user_id}/toggle")
def admin_toggle_user(user_id: int, db: Session = Depends(get_db),
                      admin=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "admin":
        raise HTTPException(400, "Cannot deactivate admin account")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@app.post("/admin/teacher-codes")
def admin_create_code(
    label: str = Form(default=""),
    custom_code: str = Form(default=""),
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    code = custom_code.strip().upper() if custom_code.strip() else secrets.token_hex(5).upper()
    if db.query(TeacherAccessCode).filter(TeacherAccessCode.code == code).first():
        raise HTTPException(400, "Code already exists")
    row = TeacherAccessCode(code=code, label=label, created_by=admin.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "code": row.code, "label": row.label,
            "is_used": row.is_used, "created_at": str(row.created_at)}


@app.get("/admin/teacher-codes")
def admin_list_codes(db: Session = Depends(get_db), admin=Depends(require_admin)):
    rows = db.query(TeacherAccessCode).order_by(TeacherAccessCode.created_at.desc()).all()
    result = []
    for r in rows:
        used_by_name = ""
        if r.used_by:
            u = db.query(User).filter(User.id == r.used_by).first()
            used_by_name = u.name if u else ""
        result.append({"id": r.id, "code": r.code, "label": r.label,
                        "is_used": r.is_used, "used_by_name": used_by_name,
                        "created_at": str(r.created_at)})
    return result


@app.delete("/admin/teacher-codes/{code_id}")
def admin_delete_code(code_id: int, db: Session = Depends(get_db),
                      admin=Depends(require_admin)):
    row = db.query(TeacherAccessCode).filter(TeacherAccessCode.id == code_id).first()
    if not row:
        raise HTTPException(404, "Code not found")
    if row.is_used:
        raise HTTPException(400, "Cannot delete a code that has already been used")
    db.delete(row)
    db.commit()
    return {"deleted": True}


@app.get("/admin/courses")
def admin_list_courses(db: Session = Depends(get_db), admin=Depends(require_admin)):
    rows = db.query(TeacherCourse).all()
    result = []
    for c in rows:
        t = db.query(User).filter(User.id == c.teacher_id).first()
        result.append({"id": c.id, "program": c.program, "course_code": c.course_code,
                        "course_name": c.course_name,
                        "teacher_name": t.name if t else "",
                        "teacher_id": c.teacher_id})
    return result


@app.get("/admin/enrollments")
def admin_list_enrollments(db: Session = Depends(get_db), admin=Depends(require_admin)):
    rows = db.query(StudentEnrollment).all()
    result = []
    for e in rows:
        student = db.query(User).filter(User.id == e.student_id).first()
        course  = db.query(TeacherCourse).filter(TeacherCourse.id == e.course_id).first()
        result.append({
            "id": e.id,
            "student_id": e.student_id,
            "student_name": student.name if student else "",
            "student_email": student.email if student else "",
            "course_id": e.course_id,
            "course_code": course.course_code if course else "",
            "program": course.program if course else "",
            "enrolled_at": str(e.enrolled_at),
        })
    return result


@app.post("/admin/enrollments")
def admin_enroll_student(
    student_id: int = Form(...),
    course_id: int = Form(...),
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(404, "Student not found")
    course = db.query(TeacherCourse).filter(TeacherCourse.id == course_id).first()
    if not course:
        raise HTTPException(404, "Course not found")
    existing = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_id == student_id,
        StudentEnrollment.course_id == course_id,
    ).first()
    if existing:
        raise HTTPException(400, "Student is already enrolled in this course")
    enr = StudentEnrollment(student_id=student_id, course_id=course_id,
                             enrolled_by=admin.id)
    db.add(enr)
    db.commit()
    db.refresh(enr)
    return {"id": enr.id, "student_id": student_id, "course_id": course_id,
            "student_name": student.name, "course_code": course.course_code}


@app.delete("/admin/enrollments/{enrollment_id}")
def admin_remove_enrollment(enrollment_id: int, db: Session = Depends(get_db),
                             admin=Depends(require_admin)):
    enr = db.query(StudentEnrollment).filter(StudentEnrollment.id == enrollment_id).first()
    if not enr:
        raise HTTPException(404, "Enrollment not found")
    db.delete(enr)
    db.commit()
    return {"deleted": True}


# ── TEACHERS & COURSES ───────────────────────────────────
@app.get("/teachers")
def list_teachers(db: Session = Depends(get_db),
                  current_user=Depends(get_current_user)):
    teachers = db.query(User).filter(User.role == "teacher", User.is_active == True).all()
    return [{"id": t.id, "name": t.name} for t in teachers]


@app.post("/courses")
def register_course(
    program: str = Form(...),
    course_code: str = Form(...),
    course_name: str = Form(default=""),
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    program = program.strip()
    course_code = course_code.strip().upper()
    existing = db.query(TeacherCourse).filter(
        TeacherCourse.teacher_id == teacher.id,
        TeacherCourse.program == program,
        TeacherCourse.course_code == course_code).first()
    if existing:
        raise HTTPException(400, "You have already registered this course")
    tc = TeacherCourse(teacher_id=teacher.id, program=program,
                       course_code=course_code, course_name=course_name.strip())
    db.add(tc)
    db.commit()
    db.refresh(tc)
    return {"id": tc.id, "program": tc.program,
            "course_code": tc.course_code, "course_name": tc.course_name}


@app.get("/courses")
def my_courses(db: Session = Depends(get_db), teacher=Depends(require_teacher)):
    rows = db.query(TeacherCourse).filter(TeacherCourse.teacher_id == teacher.id).all()
    return [{"id": c.id, "program": c.program,
             "course_code": c.course_code, "course_name": c.course_name}
            for c in rows]


@app.get("/teachers/{teacher_id}/courses")
def courses_of_teacher(teacher_id: int, db: Session = Depends(get_db),
                       current_user=Depends(get_current_user)):
    rows = db.query(TeacherCourse).filter(TeacherCourse.teacher_id == teacher_id).all()
    return [{"id": c.id, "program": c.program,
             "course_code": c.course_code, "course_name": c.course_name}
            for c in rows]


@app.get("/courses/all")
def all_courses(db: Session = Depends(get_db),
                current_user=Depends(get_current_user)):
    """All available courses — used by students to browse and self-enroll."""
    rows = db.query(TeacherCourse).all()
    enrolled_ids: set = set()
    if current_user.role == "student":
        enrolled_ids = {
            e.course_id for e in db.query(StudentEnrollment).filter(
                StudentEnrollment.student_id == current_user.id).all()
        }
    result = []
    for c in rows:
        t = db.query(User).filter(User.id == c.teacher_id).first()
        result.append({
            "id": c.id, "program": c.program,
            "course_code": c.course_code, "course_name": c.course_name,
            "teacher_name": t.name if t else "",
            "is_enrolled": c.id in enrolled_ids,
        })
    return result


@app.post("/student/enroll")
def student_self_enroll(
    course_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_student),
):
    """Student enrolls themselves in a course."""
    course = db.query(TeacherCourse).filter(TeacherCourse.id == course_id).first()
    if not course:
        raise HTTPException(404, "Course not found")
    existing = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_id == current_user.id,
        StudentEnrollment.course_id == course_id,
    ).first()
    if existing:
        raise HTTPException(400, "You are already enrolled in this course")
    enr = StudentEnrollment(student_id=current_user.id, course_id=course_id)
    db.add(enr)
    db.commit()
    return {"message": f"Enrolled in {course.course_code}", "course_id": course_id}


@app.delete("/student/enroll/{course_id}")
def student_self_unenroll(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_student),
):
    """Student removes themselves from a course."""
    enr = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_id == current_user.id,
        StudentEnrollment.course_id == course_id,
    ).first()
    if not enr:
        raise HTTPException(404, "You are not enrolled in this course")
    db.delete(enr)
    db.commit()
    return {"deleted": True}


@app.get("/documents/{doc_id}/download")
def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    """Return the original uploaded file so the teacher can read the submission."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.teacher_id != teacher.id:
        raise HTTPException(403, "Access denied")
    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "File no longer exists on disk")
    return FileResponse(
        path=doc.file_path,
        filename=doc.filename,
        media_type="application/octet-stream",
    )


@app.post("/documents/{doc_id}/grade")
def grade_submission(
    doc_id: int,
    marks: float = Form(...),
    grade_feedback: str = Form(default=""),
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    """Teacher grades a student submission."""
    doc = _load_doc(db, doc_id, teacher)
    max_m = 100
    if doc.assignment_id:
        asgn = db.query(Assignment).filter(Assignment.id == doc.assignment_id).first()
        if asgn and asgn.max_marks:
            max_m = asgn.max_marks
    if marks < 0 or marks > max_m:
        raise HTTPException(400, f"Marks must be between 0 and {max_m}")
    doc.marks = marks
    doc.grade_feedback = grade_feedback.strip()
    doc.graded_by = teacher.id
    doc.graded_at = datetime.utcnow()
    db.commit()
    return {"id": doc.id, "marks": doc.marks, "max_marks": max_m,
            "grade_feedback": doc.grade_feedback}


# ── ASSIGNMENTS ──────────────────────────────────────────
@app.post("/assignments")
def create_assignment(
    title: str = Form(...),
    description: str = Form(default=""),
    course_id: int = Form(...),
    due_date: str = Form(default=""),
    allowed_formats: str = Form(default=".pdf,.docx,.txt"),
    max_marks: int = Form(default=100),
    grading_criteria: str = Form(default=""),
    auto_grade_enabled: bool = Form(default=False),
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    course = db.query(TeacherCourse).filter(
        TeacherCourse.id == course_id,
        TeacherCourse.teacher_id == teacher.id).first()
    if not course:
        raise HTTPException(404, "Course not found or not yours")
    parsed_due = None
    if due_date.strip():
        try:
            parsed_due = datetime.fromisoformat(due_date.strip())
        except ValueError:
            raise HTTPException(400, "Invalid due_date format — use ISO 8601 (YYYY-MM-DDTHH:MM)")
    asgn = Assignment(
        title=title.strip(), description=description.strip(),
        teacher_id=teacher.id, course_id=course_id,
        due_date=parsed_due, allowed_formats=allowed_formats.strip(),
        max_marks=max(1, max_marks), grading_criteria=grading_criteria.strip(),
        auto_grade_enabled=auto_grade_enabled,
    )
    db.add(asgn)
    db.commit()
    db.refresh(asgn)
    return _assignment_dict(asgn)


@app.get("/assignments")
def list_assignments(db: Session = Depends(get_db), teacher=Depends(require_teacher)):
    rows = db.query(Assignment).filter(Assignment.teacher_id == teacher.id).order_by(
        Assignment.created_at.desc()).all()
    return [_assignment_dict(a) for a in rows]


@app.put("/assignments/{assignment_id}")
def update_assignment(
    assignment_id: int,
    title: str = Form(...),
    description: str = Form(default=""),
    due_date: str = Form(default=""),
    allowed_formats: str = Form(default=".pdf,.docx,.txt"),
    max_marks: int = Form(default=100),
    grading_criteria: str = Form(default=""),
    auto_grade_enabled: bool = Form(default=False),
    is_active: bool = Form(default=True),
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    asgn = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.teacher_id == teacher.id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found")
    asgn.title = title.strip()
    asgn.description = description.strip()
    asgn.allowed_formats = allowed_formats.strip()
    asgn.max_marks = max(1, max_marks)
    asgn.grading_criteria = grading_criteria.strip()
    asgn.auto_grade_enabled = auto_grade_enabled
    asgn.is_active = is_active
    if due_date.strip():
        try:
            asgn.due_date = datetime.fromisoformat(due_date.strip())
        except ValueError:
            raise HTTPException(400, "Invalid due_date format")
    else:
        asgn.due_date = None
    db.commit()
    db.refresh(asgn)
    return _assignment_dict(asgn)


@app.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db),
                      teacher=Depends(require_teacher)):
    asgn = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.teacher_id == teacher.id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found")
    db.delete(asgn)
    db.commit()
    return {"deleted": True}


@app.post("/assignments/{assignment_id}/auto-grade")
def auto_grade_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    """Grade all submissions for an assignment automatically using semantic
    similarity between each submission and the assignment's grading criteria."""
    from app.similarity import auto_grade_doc
    asgn = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.teacher_id == teacher.id,
    ).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found")
    if not (asgn.grading_criteria or "").strip():
        raise HTTPException(
            400,
            "No grading criteria set. Add criteria in the assignment settings before auto-grading.",
        )
    docs = db.query(Document).filter(Document.assignment_id == assignment_id).all()
    if not docs:
        raise HTTPException(404, "No submissions found for this assignment")

    results = []
    for doc in docs:
        text = (doc.clean_text or doc.raw_text or "").strip()
        if not text:
            continue
        marks = auto_grade_doc(text, asgn.grading_criteria, asgn.max_marks or 100)
        doc.marks = marks
        doc.grade_feedback = (
            "Auto-graded by the Assignment Similarity Engine based on how well this "
            "submission aligns with the stated assignment criteria. "
            "You may edit this grade at any time."
        )
        doc.graded_by = teacher.id
        doc.graded_at = datetime.utcnow()
        results.append({"doc_id": doc.id, "student": doc.student_name, "marks": marks})

    db.commit()
    return {"graded": len(results), "results": results}


def _assignment_dict(a: Assignment) -> dict:
    return {
        "id": a.id, "title": a.title, "description": a.description,
        "course_id": a.course_id,
        "course_code": a.course.course_code if a.course else "",
        "program": a.course.program if a.course else "",
        "course_name": a.course.course_name if a.course else "",
        "due_date": a.due_date.isoformat() if a.due_date else None,
        "allowed_formats": a.allowed_formats,
        "max_marks": a.max_marks or 100,
        "grading_criteria": a.grading_criteria or "",
        "auto_grade_enabled": bool(a.auto_grade_enabled),
        "is_active": a.is_active,
        "created_at": str(a.created_at),
    }


# ── STUDENT — enrolled assignments ───────────────────────
@app.get("/my-assignments")
def student_my_assignments(db: Session = Depends(get_db),
                            current_user=Depends(require_student)):
    enrollments = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_id == current_user.id).all()
    course_ids = [e.course_id for e in enrollments]
    if not course_ids:
        return []
    assignments = db.query(Assignment).filter(
        Assignment.course_id.in_(course_ids),
        Assignment.is_active == True,
    ).order_by(Assignment.created_at.desc()).all()
    result = []
    for a in assignments:
        d = _assignment_dict(a)
        # Has the student already submitted to this assignment?
        sub = db.query(Document).filter(
            Document.assignment_id == a.id,
            Document.owner_id == current_user.id,
        ).first()
        d["submitted"]      = sub is not None
        d["submission_id"]  = sub.id if sub else None
        d["marks"]          = sub.marks if sub else None
        d["grade_feedback"] = sub.grade_feedback if sub else ""
        d["graded"]         = bool(sub and sub.graded_at) if sub else False
        result.append(d)
    return result


# ── DOCUMENTS ────────────────────────────────────────────
@app.post("/assignments/{assignment_id}/submit")
async def submit_to_assignment(
    assignment_id: int,
    file: UploadFile = File(...),
    student_name: str = Form(...),
    matric_no: str = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_student),
):
    asgn = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not asgn:
        raise HTTPException(404, "Assignment not found")
    if not asgn.is_active:
        raise HTTPException(400, "This assignment is no longer accepting submissions")

    # Enrollment check
    enrolled = db.query(StudentEnrollment).filter(
        StudentEnrollment.student_id == current_user.id,
        StudentEnrollment.course_id == asgn.course_id,
    ).first()
    if not enrolled:
        raise HTTPException(403, "You are not enrolled in this course")

    # Due date check
    if asgn.due_date and datetime.utcnow() > asgn.due_date:
        raise HTTPException(400, "The submission deadline has passed")

    # File format check
    allowed = [f.strip().lower() for f in asgn.allowed_formats.split(",") if f.strip()]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(400, f"File type '{ext}' not allowed. Accepted: {', '.join(allowed)}")

    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        raw = extract_text(file_path)
    except ValueError as e:
        os.remove(file_path)
        raise HTTPException(400, str(e))

    clean = clean_text(raw)
    doc = Document(
        filename=file.filename, student_name=student_name, matric_no=matric_no,
        program=asgn.course.program, course_code=asgn.course.course_code,
        teacher_id=asgn.teacher_id, owner_id=current_user.id,
        assignment_id=assignment_id, file_path=file_path,
        raw_text=raw, clean_text=clean,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "filename": doc.filename, "message": "Submitted successfully"}


@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    student_name: str = Form(...),
    matric_no: str = Form(...),
    program: str = Form(...),
    course_code: str = Form(...),
    teacher_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Legacy upload endpoint — kept for backward compatibility."""
    program = program.strip()
    course_code = course_code.strip().upper()
    teacher = db.query(User).filter(User.id == teacher_id, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(400, "Selected teacher does not exist")
    course = db.query(TeacherCourse).filter(
        TeacherCourse.teacher_id == teacher_id,
        TeacherCourse.program == program,
        TeacherCourse.course_code == course_code).first()
    if not course:
        raise HTTPException(400, "This teacher has not registered that program/course code")
    allowed = {".pdf", ".docx", ".txt"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(400, f"File type {ext} not allowed")
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        raw = extract_text(file_path)
    except ValueError as e:
        os.remove(file_path)
        raise HTTPException(400, str(e))
    clean = clean_text(raw)
    doc = Document(filename=file.filename, student_name=student_name,
                   matric_no=matric_no, program=program, course_code=course_code,
                   teacher_id=teacher_id, owner_id=current_user.id,
                   file_path=file_path, raw_text=raw, clean_text=clean)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "filename": doc.filename, "message": "Uploaded successfully"}


@app.get("/documents")
def list_documents(
    program: str = "",
    course_code: str = "",
    assignment_id: int = 0,
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    q = db.query(Document).filter(Document.teacher_id == teacher.id)
    if program:
        q = q.filter(Document.program == program.strip())
    if course_code:
        q = q.filter(Document.course_code == course_code.strip().upper())
    if assignment_id:
        q = q.filter(Document.assignment_id == assignment_id)
    docs = q.order_by(Document.uploaded_at.desc()).all()
    return [{"id": d.id, "filename": d.filename, "student_name": d.student_name,
             "matric_no": d.matric_no, "program": d.program,
             "course_code": d.course_code, "assignment_id": d.assignment_id,
             "uploaded_at": str(d.uploaded_at),
             "marks": d.marks, "grade_feedback": d.grade_feedback or "",
             "graded": d.graded_at is not None} for d in docs]


# ── COMPARE HELPERS ──────────────────────────────────────
def _to_dict(d: Document) -> dict:
    return {"id": d.id, "raw_text": d.raw_text, "clean_text": d.clean_text,
            "student_name": d.student_name, "matric_no": d.matric_no,
            "program": d.program, "course_code": d.course_code,
            "filename": d.filename}


def _load_doc(db: Session, doc_id: int, teacher: User) -> Document:
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, f"Document {doc_id} not found")
    if doc.teacher_id != teacher.id:
        raise HTTPException(403, f"Document {doc_id} was not submitted to you")
    return doc


def _cohort(db: Session, doc: Document, teacher: User, exclude_ids: list = None) -> list:
    q = db.query(Document).filter(
        Document.id != doc.id,
        Document.teacher_id == teacher.id,
        Document.program == doc.program,
        Document.course_code == doc.course_code,
    )
    if exclude_ids:
        q = q.filter(Document.id.notin_(exclude_ids))
    return q.all()


def _run_one(d1_dict: dict, targets: list) -> dict:
    results = compare_documents(d1_dict, [_to_dict(d) for d in targets])
    return {
        "primary_document": d1_dict["filename"],
        "student": d1_dict["student_name"],
        "matric_no": d1_dict["matric_no"],
        "program": d1_dict["program"],
        "course_code": d1_dict["course_code"],
        "total_compared": len(targets),
        "results": results,
    }


# ── SIMILARITY MODES ─────────────────────────────────────
class SimilarityRequest(BaseModel):
    mode: str           # one_one | one_all | one_selected | many_selected | many_all
    primary_ids: List[int]
    target_ids: Optional[List[int]] = None


@app.post("/similarity/run")
def run_similarity(
    req: SimilarityRequest,
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    def load(doc_id):
        return _load_doc(db, doc_id, teacher)

    if req.mode == "one_one":
        if len(req.primary_ids) != 1 or not req.target_ids or len(req.target_ids) != 1:
            raise HTTPException(400, "one_one requires exactly 1 primary and 1 target")
        d1 = load(req.primary_ids[0])
        d2 = load(req.target_ids[0])
        return [_run_one(_to_dict(d1), [d2])]

    elif req.mode == "one_all":
        if len(req.primary_ids) != 1:
            raise HTTPException(400, "one_all requires exactly 1 primary")
        d1 = load(req.primary_ids[0])
        others = _cohort(db, d1, teacher)
        if not others:
            raise HTTPException(400, "No other documents in this course to compare against")
        return [_run_one(_to_dict(d1), others)]

    elif req.mode == "one_selected":
        if len(req.primary_ids) != 1 or not req.target_ids:
            raise HTTPException(400, "one_selected requires 1 primary and at least 1 target")
        d1 = load(req.primary_ids[0])
        targets = [load(tid) for tid in req.target_ids]
        return [_run_one(_to_dict(d1), targets)]

    elif req.mode == "many_selected":
        if not req.primary_ids or not req.target_ids:
            raise HTTPException(400, "many_selected requires at least 1 primary and 1 target")
        out = []
        for pid in req.primary_ids:
            d1 = load(pid)
            targets = [load(tid) for tid in req.target_ids if tid != pid]
            if targets:
                out.append(_run_one(_to_dict(d1), targets))
        return out

    elif req.mode == "many_all":
        if not req.primary_ids:
            raise HTTPException(400, "many_all requires at least 1 primary")
        out = []
        for pid in req.primary_ids:
            d1 = load(pid)
            others = _cohort(db, d1, teacher)
            if others:
                out.append(_run_one(_to_dict(d1), others))
        return out

    raise HTTPException(400, f"Unknown mode: {req.mode}")


# ── LEGACY COMPARE (kept for backward compat) ────────────
@app.post("/compare/{doc1_id}")
def compare(doc1_id: int, db: Session = Depends(get_db),
            teacher=Depends(require_teacher)):
    d1 = _load_doc(db, doc1_id, teacher)
    others = _cohort(db, d1, teacher)
    if not others:
        raise HTTPException(400, "No other documents to compare against")
    results = compare_documents(_to_dict(d1), [_to_dict(d) for d in others])
    return {"primary_document": d1.filename, "student": d1.student_name,
            "program": d1.program, "course_code": d1.course_code,
            "total_compared": len(others), "results": results}


# ── REPORTS ──────────────────────────────────────────────
@app.post("/reports/{doc1_id}")
def create_report(doc1_id: int, db: Session = Depends(get_db),
                  teacher=Depends(require_teacher)):
    d1 = _load_doc(db, doc1_id, teacher)
    others = _cohort(db, d1, teacher)
    d1_dict = _to_dict(d1)
    results = compare_documents(d1_dict, [_to_dict(d) for d in others])
    output_path = f"reports/report_{doc1_id}.pdf"
    generate_report(d1_dict, results, output_path)
    return FileResponse(output_path, media_type="application/pdf",
                        filename=f"similarity_report_{d1.filename}.pdf")


# ── FEEDBACK ─────────────────────────────────────────────
@app.post("/feedback/{doc1_id}")
def send_feedback(
    doc1_id: int,
    message: str = Form(default=""),
    only_flagged: bool = Form(default=False),
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    d1 = _load_doc(db, doc1_id, teacher)
    others = _cohort(db, d1, teacher)
    if not others:
        raise HTTPException(400, "No documents to compare against")
    d1_dict = _to_dict(d1)
    results = compare_documents(d1_dict, [_to_dict(d) for d in others])
    if only_flagged:
        results = [r for r in results if r["risk_level"] in ("High", "Medium")]
    db.query(Feedback).filter(
        Feedback.document_id == d1.id,
        Feedback.recipient_id == d1.owner_id).delete()
    for r in results:
        db.add(Feedback(
            recipient_id=d1.owner_id, teacher_id=teacher.id,
            document_id=d1.id, program=d1.program, course_code=d1.course_code,
            similar_to_name=r["student_name"], similar_to_matric=r["matric_no"],
            similar_to_program=r["program"], percentage=r["final_score"],
            level=r["risk_level"], message=message))
    db.commit()
    return {"sent": len(results), "recipient_id": d1.owner_id}


@app.get("/feedback/me")
def my_feedback(db: Session = Depends(get_db),
                current_user=Depends(get_current_user)):
    rows = db.query(Feedback).filter(
        Feedback.recipient_id == current_user.id
    ).order_by(Feedback.created_at.desc(), Feedback.percentage.desc()).all()
    return [{"id": f.id, "course_code": f.course_code, "program": f.program,
             "similar_to_name": f.similar_to_name,
             "similar_to_matric": f.similar_to_matric,
             "similar_to_program": f.similar_to_program,
             "percentage": f.percentage, "level": f.level,
             "message": f.message, "created_at": str(f.created_at)}
            for f in rows]
