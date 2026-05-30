
from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import (get_db, User, Document, TeacherCourse, Feedback)
from app.auth import (hash_password, verify_password, create_token,
                      get_current_user, require_teacher, require_student)
from app.parser import extract_text
from app.preprocessor import clean_text
from app.similarity import compare_documents
from app.reporter import generate_report
import shutil, uuid, os
 
app = FastAPI(title="Similarity Engine API")
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
 
TEACHER_CODE = "STAFF2025"
 
 
# ── HEALTH ───────────────────────────────────────────────
@app.get("/")
def health_check():
    return {"status": "running"}
 
 
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
    if role == "teacher" and teacher_code != TEACHER_CODE:
        raise HTTPException(403, "Invalid teacher access code")
    if role not in ("student", "teacher"):
        raise HTTPException(400, "Invalid role")
    user = User(name=name, email=email,
                hashed_password=hash_password(password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name,
            "email": user.email, "role": user.role}
 
 
@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password")
    token = create_token(user.id, user.email, user.role)
    return {"access_token": token, "token_type": "bearer",
            "id": user.id, "role": user.role, "name": user.name}
 
 
@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name,
            "email": current_user.email, "role": current_user.role}
 
 
# ── TEACHERS & COURSES ───────────────────────────────────
@app.get("/teachers")
def list_teachers(db: Session = Depends(get_db),
                  current_user=Depends(get_current_user)):
    """Used by students to pick the teacher they are submitting to."""
    teachers = db.query(User).filter(User.role == "teacher").all()
    return [{"id": t.id, "name": t.name} for t in teachers]
 
 
@app.post("/courses")
def register_course(
    program: str = Form(...),
    course_code: str = Form(...),
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    """A teacher registers a (program, course_code) they will check."""
    program = program.strip()
    course_code = course_code.strip().upper()
    existing = db.query(TeacherCourse).filter(
        TeacherCourse.teacher_id == teacher.id,
        TeacherCourse.program == program,
        TeacherCourse.course_code == course_code).first()
    if existing:
        raise HTTPException(400, "You have already registered this course")
    tc = TeacherCourse(teacher_id=teacher.id, program=program,
                       course_code=course_code)
    db.add(tc)
    db.commit()
    db.refresh(tc)
    return {"id": tc.id, "program": tc.program, "course_code": tc.course_code}
 
 
@app.get("/courses")
def my_courses(db: Session = Depends(get_db), teacher=Depends(require_teacher)):
    rows = db.query(TeacherCourse).filter(
        TeacherCourse.teacher_id == teacher.id).all()
    return [{"id": c.id, "program": c.program, "course_code": c.course_code}
            for c in rows]
 
 
@app.get("/teachers/{teacher_id}/courses")
def courses_of_teacher(teacher_id: int, db: Session = Depends(get_db),
                       current_user=Depends(get_current_user)):
    """Students use this to pick a registered (program, course) for a teacher."""
    rows = db.query(TeacherCourse).filter(
        TeacherCourse.teacher_id == teacher_id).all()
    return [{"id": c.id, "program": c.program, "course_code": c.course_code}
            for c in rows]
 
 
# ── DOCUMENTS ────────────────────────────────────────────
@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    student_name: str = Form(...),
    matric_no: str = Form(...),
    program: str = Form(...),
    course_code: str = Form(...),
    teacher_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_student),
):
    program = program.strip()
    course_code = course_code.strip().upper()
 
    # Validate the chosen teacher + that they registered this course.
    teacher = db.query(User).filter(User.id == teacher_id,
                                    User.role == "teacher").first()
    if not teacher:
        raise HTTPException(400, "Selected teacher does not exist")
    course = db.query(TeacherCourse).filter(
        TeacherCourse.teacher_id == teacher_id,
        TeacherCourse.program == program,
        TeacherCourse.course_code == course_code).first()
    if not course:
        raise HTTPException(
            400, "This teacher has not registered that program / course code")
 
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
                   matric_no=matric_no, program=program,
                   course_code=course_code, teacher_id=teacher_id,
                   owner_id=current_user.id, file_path=file_path,
                   raw_text=raw, clean_text=clean)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "filename": doc.filename,
            "message": "Uploaded successfully"}
 
 
@app.get("/documents")
def list_documents(
    program: str = "",
    course_code: str = "",
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    """A teacher sees documents submitted to them, optionally scoped to a course."""
    q = db.query(Document).filter(Document.teacher_id == teacher.id)
    if program:
        q = q.filter(Document.program == program.strip())
    if course_code:
        q = q.filter(Document.course_code == course_code.strip().upper())
    docs = q.all()
    return [{"id": d.id, "filename": d.filename,
             "student_name": d.student_name, "matric_no": d.matric_no,
             "program": d.program, "course_code": d.course_code,
             "uploaded_at": str(d.uploaded_at)} for d in docs]
 
 
# ── COMPARE HELPERS ──────────────────────────────────────
def _to_dict(d: Document) -> dict:
    return {"id": d.id, "raw_text": d.raw_text, "clean_text": d.clean_text,
            "student_name": d.student_name, "matric_no": d.matric_no,
            "program": d.program, "course_code": d.course_code,
            "filename": d.filename}
 
 
def _load_cohort(db: Session, doc1_id: int, teacher: User):
    """Load the primary doc plus its cohort (same teacher + program + course)."""
    doc1 = db.query(Document).filter(Document.id == doc1_id).first()
    if not doc1:
        raise HTTPException(404, "Document not found")
    if doc1.teacher_id != teacher.id:
        raise HTTPException(403, "This document was not submitted to you")
    others = db.query(Document).filter(
        Document.id != doc1_id,
        Document.teacher_id == teacher.id,
        Document.program == doc1.program,
        Document.course_code == doc1.course_code).all()
    return doc1, others
 
 
# ── COMPARE ──────────────────────────────────────────────
@app.post("/compare/{doc1_id}")
def compare(doc1_id: int, db: Session = Depends(get_db),
            teacher=Depends(require_teacher)):
    doc1, others_db = _load_cohort(db, doc1_id, teacher)
    if not others_db:
        raise HTTPException(
            400, "No other documents in this course/program to compare against")
    d1 = _to_dict(doc1)
    results = compare_documents(d1, [_to_dict(d) for d in others_db])
    return {"primary_document": d1["filename"],
            "student": d1["student_name"],
            "program": d1["program"], "course_code": d1["course_code"],
            "total_compared": len(others_db), "results": results}
 
 
# ── REPORTS ──────────────────────────────────────────────
@app.post("/reports/{doc1_id}")
def create_report(doc1_id: int, db: Session = Depends(get_db),
                  teacher=Depends(require_teacher)):
    doc1, others_db = _load_cohort(db, doc1_id, teacher)
    d1 = _to_dict(doc1)
    results = compare_documents(d1, [_to_dict(d) for d in others_db])
    output_path = f"reports/report_{doc1_id}.pdf"
    generate_report(d1, results, output_path)
    return FileResponse(output_path, media_type="application/pdf",
                        filename=f"similarity_report_{doc1.filename}.pdf")
 
 
# ── FEEDBACK ─────────────────────────────────────────────
@app.post("/feedback/{doc1_id}")
def send_feedback(
    doc1_id: int,
    message: str = Form(default=""),
    only_flagged: bool = Form(default=False),
    db: Session = Depends(get_db),
    teacher=Depends(require_teacher),
):
    """Compute similarity for the primary doc and send the findings to its owner."""
    doc1, others_db = _load_cohort(db, doc1_id, teacher)
    if not others_db:
        raise HTTPException(400, "No documents to compare against")
    d1 = _to_dict(doc1)
    results = compare_documents(d1, [_to_dict(d) for d in others_db])
 
    if only_flagged:
        results = [r for r in results if r["risk_level"] in ("High", "Medium")]
 
    # Replace any previous feedback for this document so re-sending updates.
    db.query(Feedback).filter(
        Feedback.document_id == doc1.id,
        Feedback.recipient_id == doc1.owner_id).delete()
 
    for r in results:
        db.add(Feedback(
            recipient_id=doc1.owner_id, teacher_id=teacher.id,
            document_id=doc1.id, program=doc1.program,
            course_code=doc1.course_code,
            similar_to_name=r["student_name"], similar_to_matric=r["matric_no"],
            similar_to_program=r["program"], percentage=r["final_score"],
            level=r["risk_level"], message=message))
    db.commit()
    return {"sent": len(results), "recipient_id": doc1.owner_id}
 
 
@app.get("/feedback/me")
def my_feedback(db: Session = Depends(get_db),
                current_user=Depends(get_current_user)):
    """A student retrieves the similarity feedback addressed to them."""
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