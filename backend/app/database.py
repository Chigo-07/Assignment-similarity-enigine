from sqlalchemy import (create_engine, Column, Integer, String, Text,
                        DateTime, Float, Boolean, ForeignKey, UniqueConstraint)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./similarity.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL,
                       connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String, nullable=False)
    email           = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(String, default="student")  # "teacher" or "student"
    created_at      = Column(DateTime, default=datetime.utcnow)


class TeacherCourse(Base):
    """A (program, course_code) pair a teacher has registered to oversee."""
    __tablename__ = "teacher_courses"
    id          = Column(Integer, primary_key=True, index=True)
    teacher_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    program     = Column(String, nullable=False)
    course_code = Column(String, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint("teacher_id", "program", "course_code",
                         name="uq_teacher_course"),
    )
    teacher = relationship("User")


class Document(Base):
    __tablename__ = "documents"
    id           = Column(Integer, primary_key=True, index=True)
    filename     = Column(String, nullable=False)
    student_name = Column(String, nullable=False)
    matric_no    = Column(String, nullable=False)
    program      = Column(String, nullable=False)
    course_code  = Column(String, nullable=False)
    teacher_id   = Column(Integer, ForeignKey("users.id"), nullable=False)  # chosen teacher
    owner_id     = Column(Integer, ForeignKey("users.id"), nullable=False)  # uploading student
    file_path    = Column(String, nullable=False)
    raw_text     = Column(Text)
    clean_text   = Column(Text)
    uploaded_at  = Column(DateTime, default=datetime.utcnow)


class Feedback(Base):
    """One similarity finding sent from a teacher to a student."""
    __tablename__ = "feedback"
    id                 = Column(Integer, primary_key=True, index=True)
    recipient_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    teacher_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_id        = Column(Integer, ForeignKey("documents.id"), nullable=False)
    program            = Column(String, nullable=False)
    course_code        = Column(String, nullable=False)
    similar_to_name    = Column(String, nullable=False)
    similar_to_matric  = Column(String, nullable=False)
    similar_to_program = Column(String, nullable=False)
    percentage         = Column(Float, nullable=False)
    level              = Column(String, nullable=False)   # High / Medium / Low
    message            = Column(Text, default="")
    created_at         = Column(DateTime, default=datetime.utcnow)
    is_read            = Column(Boolean, default=False)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
