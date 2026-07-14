# Assignment Similarity Engine — Technical Brief

> Prepared for FYP report writing. All function names, file paths, and code
> snippets are drawn directly from the source files. Where a feature is not
> present in the code, this is stated explicitly.

---

## 1. Project Overview

The **Assignment Similarity Engine (ASE)** is a full-stack web application built
as a Final Year Project. Its purpose is to help university teaching staff detect
textual similarity between student assignment submissions. Beyond detection, the
system also supports assignment management, student enrollment, semantic
auto-grading, and similarity feedback delivery.

The system serves three distinct user roles:

| Role | Description |
|------|-------------|
| **Admin** | System administrator (seeded automatically on startup). Manages users, generates teacher access codes, and can manually enroll/remove students. |
| **Teacher (Lecturer)** | Registers courses, creates assignments, receives submissions, runs similarity checks, grades manually or via AI, and sends similarity feedback to students. |
| **Student** | Browses and self-enrolls in courses, submits assignments to active assignments they are enrolled in, and views their grades and similarity feedback. |

The core feature set:

- Multi-algorithm similarity detection (TF-IDF, Word Trigram, SBERT)
- Five flexible comparison modes (one-to-one, one-to-all, one-to-selected, many-to-selected, many-to-all)
- AI-powered auto-grading using semantic rubric alignment
- Role-based access control with JWT authentication
- PDF/DOCX/TXT submission parsing
- PDF similarity report generation
- Student feedback delivery with risk-level flagging

---

## 2. Architecture and Structure

### Directory Layout

```
similarity-engine/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app; all API endpoints (~915 lines)
│   │   ├── database.py      # SQLAlchemy ORM models, migrations, admin seed
│   │   ├── auth.py          # JWT creation/decoding, bcrypt, role guards
│   │   ├── similarity.py    # TF-IDF, Trigram, SBERT, auto-grading, orchestration
│   │   ├── preprocessor.py  # Text cleaning, sentence splitting, trigram extraction
│   │   ├── parser.py        # PDF (PyMuPDF), DOCX (python-docx), TXT extraction
│   │   └── reporter.py      # ReportLab PDF report generation
│   ├── tests/
│   │   ├── test_engine.py   # Manual test suite (not pytest — run directly)
│   │   └── test_docs/
│   │       ├── original.txt
│   │       ├── exact_copy.txt
│   │       ├── partial_copy.txt
│   │       ├── paraphrase.txt
│   │       ├── different.txt
│   │       └── diffrent.txt  (duplicate of different.txt)
│   ├── requirements.txt
│   ├── uploads/             # Uploaded submission files (runtime, gitignored)
│   ├── reports/             # Generated PDF reports (runtime, gitignored)
│   └── similarity.db        # SQLite database (runtime, gitignored)
└── frontend/
    ├── src/
    │   ├── main.jsx         # React 19 entry point
    │   ├── App.jsx          # BrowserRouter, route definitions, PrivateRoute
    │   ├── api.js           # All axios API calls (~107 lines)
    │   ├── index.css        # CSS design system (variables, resets, components)
    │   └── pages/
    │       ├── LoginPage.jsx
    │       ├── RegisterPage.jsx
    │       ├── AdminDashboard.jsx
    │       ├── TeacherDashboard.jsx
    │       ├── StudentDashboard.jsx
    │       ├── FeedbackPage.jsx
    │       ├── ResultsPage.jsx    (legacy, unregistered in router)
    │       └── UploadPage.jsx     (legacy, unregistered in router)
    ├── package.json
    └── vite.config.js
```

### Request Data Flow

```
Browser (React SPA)
  │  axios request to /api/*
  ▼
Vite Dev Server (port 5173)
  │  proxy strips /api prefix, forwards to :8000
  ▼
FastAPI (Uvicorn, port 8000)
  │  JWT verified via get_current_user()
  │  Role guard (require_admin / require_teacher / require_student)
  ▼
  ├── Database layer (SQLAlchemy → SQLite)
  ├── File system (uploads/ , reports/)
  └── Similarity layer (similarity.py → preprocessor.py)
        └── SBERT model (sentence-transformers, lazy-loaded on first use)
```

In production (if deployed), `VITE_API_URL` env var overrides the `/api` base
URL so the SPA can reach a remote backend directly.

### Authentication Flow

1. `POST /auth/login` receives form data (`username` field = email, `password`).
2. Backend queries `User` table, verifies bcrypt hash, checks `is_active`.
3. Returns `access_token` (JWT, 8-hour TTL), `role`, `name`, `id`.
4. Frontend stores these four values in `localStorage`.
5. axios request interceptor attaches `Authorization: Bearer <token>` on every
   subsequent request.
6. On `401` response, interceptor clears `localStorage` and redirects to `/login`.
7. On the backend, `get_current_user()` decodes the JWT, looks up the `User`
   row, and raises 401/403 if missing or inactive.

---

## 3. Tech Stack and Dependencies

### Backend (`backend/requirements.txt`)

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | 0.111.0 | REST API framework |
| `uvicorn[standard]` | 0.29.0 | ASGI server |
| `python-multipart` | 0.0.9 | Multipart form parsing (file uploads) |
| `PyMuPDF` | ≥1.24.11 | PDF text extraction (`fitz`) |
| `python-docx` | 1.1.2 | DOCX parsing |
| `nltk` | 3.8.1 | Tokenisation, stopword removal, sentence splitting |
| `scikit-learn` | 1.4.2 | TF-IDF vectoriser + cosine similarity |
| `sentence-transformers` | 2.7.0 | SBERT semantic embedding (`all-MiniLM-L6-v2`) |
| `sqlalchemy` | 2.0.30 | ORM and schema management |
| `reportlab` | 4.1.0 | PDF report generation |
| `python-jose` | 3.3.0 | JWT encoding/decoding (HS256) |
| `numpy` | ≥1.26 | Vector maths for embeddings |
| `bcrypt` | ≥4.1 | Password hashing |

### Frontend (`frontend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19.2.6 | UI framework |
| `react-dom` | 19.2.6 | DOM renderer |
| `react-router-dom` | 7.15.1 | Client-side routing |
| `axios` | 1.16.1 | HTTP client |
| `recharts` | 3.8.1 | Chart components (used in FeedbackPage) |
| `vite` | 8.0.12 | Build tool and dev server |
| `@vitejs/plugin-react` | 6.0.1 | React + JSX transform for Vite |

### SBERT Model

The system uses `all-MiniLM-L6-v2`, a 22M-parameter sentence transformer
model. It is downloaded on first use by `sentence-transformers` from
Hugging Face and cached locally. The model is lazy-loaded inside `get_model()`
in `similarity.py` — it is not loaded at import time, only when the first
similarity request arrives.

---

## 4. Core Methods and Algorithms

All similarity and grading algorithms live in `backend/app/similarity.py`.

### 4.1 Text Preprocessing (`backend/app/preprocessor.py`)

Before any similarity computation, raw text is cleaned:

```python
# preprocessor.py

def clean_text(text: str) -> str:
    # 1. Lowercase
    # 2. Remove punctuation
    # 3. Collapse whitespace
    # 4. NLTK word_tokenize
    # 5. Remove stopwords (NLTK English corpus)
    # 6. Remove tokens <= 2 characters
    return " ".join(filtered_tokens)

def get_sentences(text: str) -> list:
    # NLTK sent_tokenize, keep sentences > 20 chars
    return [s for s in sent_tokenize(text) if len(s) > 20]

def get_trigrams(text: str) -> set:
    # Tokenize cleaned text, form overlapping word-triples
    tokens = clean_text(text).split()
    return set(zip(tokens, tokens[1:], tokens[2:]))
```

`clean_text` is used for TF-IDF and Trigram inputs.
`get_sentences` is used for SBERT inputs (sentence-level encoding).
`get_trigrams` is used for the containment metric.

### 4.2 TF-IDF Cosine Similarity

**File:** `similarity.py`, function `tfidf_score(doc1_clean, docs_clean)`

Approach:
1. Concatenate the primary document with all comparison documents.
2. Fit a `TfidfVectorizer` with `min_df=1` and `ngram_range=(1, 2)` — captures
   both unigrams and bigrams.
3. Compute cosine similarity between the primary document vector and each
   comparison vector using scikit-learn's `cosine_similarity`.

```python
def tfidf_score(doc1_clean: str, docs_clean: list) -> list:
    all_docs = [doc1_clean] + docs_clean
    vectorizer = TfidfVectorizer(min_df=1, ngram_range=(1, 2))
    matrix = vectorizer.fit_transform(all_docs)
    scores = cosine_similarity(matrix[0:1], matrix[1:])
    return scores[0].tolist()
```

**Characteristic:** Sensitive to exact lexical overlap; weakened by paraphrasing
or synonym substitution.

### 4.3 Word-Trigram Containment

**File:** `similarity.py`, functions `_trigram_pair`, `trigram_score`

Rather than standard Jaccard similarity (which penalises short copying from a
long document), the system uses a **containment** metric: the maximum of the
two possible containment ratios:

```python
def _trigram_pair(doc1_clean: str, doc2_clean: str) -> float:
    t1 = get_trigrams(doc1_clean)
    t2 = get_trigrams(doc2_clean)
    if not t1 or not t2:
        return 0.0
    common = len(t1 & t2)
    return max(common / len(t1), common / len(t2))
```

`max(common/len(t1), common/len(t2))` means: if one student copied a large
portion of their work verbatim from a shorter source, the score approaches 1.0
even if the copying student's full document is much longer. This catches
partial copying better than Jaccard.

**Characteristic:** Robust against verbatim copying; less sensitive to semantic
similarity.

### 4.4 SBERT Semantic Similarity

**File:** `similarity.py`, functions `sbert_scores`, `_doc_embedding`

Model: `all-MiniLM-L6-v2` (sentence-transformers)

Process:
1. Split each document into sentences via `get_sentences`.
2. Encode all sentences with the transformer model.
3. Mean-pool the sentence embeddings to get a single document-level vector.
4. Compute cosine similarity between document vectors.

**Optimisation — embedding cache:**
A process-level dictionary `_embedding_cache: dict = {}` maps
`MD5(raw_text)` → `np.ndarray`. On any request, all uncached documents are
identified, their sentences are concatenated into one list, and a single
`model.encode(..., batch_size=64)` call encodes them all at once. Individual
document embeddings are then mean-pooled and cached. Subsequent requests for
the same document text return instantly from cache.

```python
_embedding_cache: dict = {}

def _content_hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8", errors="ignore")).hexdigest()

def sbert_scores(doc1_raw: str, docs_raw: list) -> list:
    model = get_model()
    all_raws = [doc1_raw] + docs_raw
    hashes   = [_content_hash(r) for r in all_raws]
    uncached_idx = [i for i, h in enumerate(hashes) if h not in _embedding_cache]
    if uncached_idx:
        # Collect all sentences from uncached docs into one list
        all_sents, sent_bounds = [], []
        for i in uncached_idx:
            sents = get_sentences(all_raws[i]) or [all_raws[i].strip()[:1000] or " "]
            start = len(all_sents)
            all_sents.extend(sents)
            sent_bounds.append((start, len(all_sents)))
        # Single batched encode call
        all_embs = model.encode(all_sents, convert_to_numpy=True,
                                normalize_embeddings=True, batch_size=64,
                                show_progress_bar=False)
        for idx, (start, end) in zip(uncached_idx, sent_bounds):
            emb = all_embs[start:end].mean(axis=0)
            _embedding_cache[hashes[idx]] = emb
    embeddings = [_embedding_cache[h] for h in hashes]
    e1 = embeddings[0]
    return [float(np.dot(e1, e2) / ((np.linalg.norm(e1) * np.linalg.norm(e2)) or 1.0))
            for e2 in embeddings[1:]]
```

**Characteristic:** Captures paraphrasing and synonym substitution; slower than
lexical methods but accelerated by caching.

### 4.5 Combined Score and Risk Classification

**File:** `similarity.py`, function `compare_documents`

The three individual scores are combined into a weighted final score:

```
final_score = 0.5 × TF-IDF  +  0.3 × Trigram  +  0.2 × SBERT
```

All scores are scaled to 0–100 before combination. The weights reflect the
relative reliability of each signal: TF-IDF is the most discriminating for
academic text, Trigram catches verbatim copying, and SBERT adds semantic depth.

Risk classification thresholds:
- **High**: `final_score >= 70`
- **Medium**: `final_score >= 40`
- **Low**: `final_score < 40`

```python
final = round(0.5 * tf + 0.3 * tg + 0.2 * sb, 1)
risk  = "High" if final >= 70 else ("Medium" if final >= 40 else "Low")
```

Results are sorted in descending order of `final_score`.

### 4.6 AI Auto-Grading

**File:** `similarity.py`, function `auto_grade_doc(submission_text, criteria_text, max_marks)`
**Endpoint:** `POST /assignments/{assignment_id}/auto-grade` in `main.py`

The auto-grading system uses SBERT semantic similarity to measure how well a
submission addresses a set of rubric criteria:

1. **Split criteria** into individual rubric items using a regex that splits on
   newlines, numbered list markers, bullet markers, or semicolons:
   ```python
   raw_items = re.split(r"\n+|\r+|\d+[.)]\s*|-\s+|;\s*", criteria_text)
   criteria_items = [item.strip() for item in raw_items
                     if item.strip() and len(item.strip()) > 5]
   ```

2. **Embed the submission** as a document-level vector (uses cache).

3. **Embed each criterion item** individually (cached separately).

4. **Compute cosine similarity** between the submission vector and each
   criterion item vector. Average the per-criterion scores.

5. **Calibrate**: Raw SBERT cosine similarity is conservative — a very good
   semantic match typically yields ~0.55 rather than 1.0. Dividing by 0.55
   and clamping at 1.0 maps realistic scores to the full mark range:
   ```python
   calibrated = min(1.0, avg_sim / 0.55)
   return round(calibrated * max_marks, 1)
   ```

The resulting mark is stored in `Document.marks`, with `grade_feedback` set to
a fixed explanatory string, `graded_by` set to the teacher's ID, and
`graded_at` set to the current UTC timestamp.

---

## 5. Key Implementation Details

### 5.1 Database Models (`backend/app/database.py`)

SQLAlchemy ORM with SQLite. `Base.metadata.create_all()` is called at module
import to create all tables. Seven models:

| Model | Table | Key Fields |
|-------|-------|-----------|
| `User` | `users` | `id`, `name`, `email`, `hashed_password`, `role` (`admin`/`teacher`/`student`), `is_active` |
| `TeacherAccessCode` | `teacher_access_codes` | `code`, `label`, `created_by`, `used_by`, `is_used` |
| `TeacherCourse` | `teacher_courses` | `teacher_id`, `program`, `course_code`, `course_name`; unique constraint on `(teacher_id, program, course_code)` |
| `Assignment` | `assignments` | `title`, `description`, `teacher_id`, `course_id`, `due_date`, `allowed_formats`, `max_marks`, `grading_criteria`, `auto_grade_enabled`, `is_active` |
| `StudentEnrollment` | `student_enrollments` | `student_id`, `course_id`, `enrolled_by`; unique constraint on `(student_id, course_id)` |
| `Document` | `documents` | `filename`, `student_name`, `matric_no`, `program`, `course_code`, `teacher_id`, `owner_id`, `assignment_id`, `file_path`, `raw_text`, `clean_text`, `marks`, `grade_feedback`, `graded_by`, `graded_at` |
| `Feedback` | `feedback` | `recipient_id`, `teacher_id`, `document_id`, `similar_to_name`, `similar_to_matric`, `percentage`, `level`, `message`, `is_read` |

### 5.2 Live Migration (`_migrate()`)

The `_migrate()` function in `database.py` is called at module import (before
`seed_default_admin()`). It inspects the current column list for each table and
issues `ALTER TABLE ... ADD COLUMN` for any columns that are missing:

```python
migrations = [
    ("documents",      "assignment_id",      "INTEGER REFERENCES assignments(id)"),
    ("users",          "is_active",          "INTEGER DEFAULT 1"),
    ("teacher_courses","course_name",        "TEXT DEFAULT ''"),
    ("assignments",    "max_marks",          "INTEGER DEFAULT 100"),
    ("assignments",    "grading_criteria",   "TEXT DEFAULT ''"),
    ("assignments",    "auto_grade_enabled", "INTEGER DEFAULT 0"),
    ("documents",      "marks",              "REAL"),
    ("documents",      "grade_feedback",     "TEXT DEFAULT ''"),
    ("documents",      "graded_by",          "INTEGER REFERENCES users(id)"),
    ("documents",      "graded_at",          "DATETIME"),
]
```

Each entry is wrapped in a `try/except` so a column that already exists causes
no error. This pattern allows upgrading existing databases without data loss.

### 5.3 Authentication (`backend/app/auth.py`)

```python
SECRET_KEY = "change-this-to-a-long-random-string-before-submission"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8   # 8-hour token lifetime

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_token(user_id: int, email: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "email": email, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
```

Role guard dependencies used as FastAPI `Depends`:
- `require_admin(current_user)` — raises HTTP 403 if `role != "admin"`
- `require_teacher(current_user)` — raises HTTP 403 if `role != "teacher"`
- `require_student(current_user)` — raises HTTP 403 if `role != "student"`

`get_current_user()` additionally checks `is_active` and raises HTTP 403 if
the account has been deactivated by the admin.

> **Security note**: `SECRET_KEY` is hardcoded for development/submission.
> It must be rotated before any production deployment.

### 5.4 Document Parsing (`backend/app/parser.py`)

Entry point: `extract_text(file_path: str) -> str`

| Format | Handler | Library |
|--------|---------|---------|
| `.pdf` | `extract_pdf(path)` | `fitz.open()` (PyMuPDF), iterates pages with `page.get_text()` |
| `.docx` | `extract_docx(path)` | `python-docx`; custom `_harvest(element)` walks XML for `w:t` (paragraphs, tables, legacy text boxes) and `a:t` (DrawingML shapes, SmartArt, WordArt); deduplicates lines to prevent AlternateContent double-extraction |
| `.txt` | `extract_txt(path)` | Plain `open(..., encoding="utf-8", errors="ignore")` |

If the extracted text is fewer than 20 characters, a `ValueError` is raised
with a user-friendly message about image-only (scanned) PDFs.

File uploads are stored with UUID-prefixed names in the `uploads/` directory:
```python
unique_name = f"{uuid.uuid4()}{ext}"
file_path = os.path.join(UPLOAD_DIR, unique_name)
```

### 5.5 Five Similarity Modes (`backend/app/main.py`)

The single endpoint `POST /similarity/run` accepts a `SimilarityRequest` body:

```python
class SimilarityRequest(BaseModel):
    mode: str           # one_one | one_all | one_selected | many_selected | many_all
    primary_ids: List[int]
    target_ids: Optional[List[int]] = None
```

| Mode | Behaviour |
|------|-----------|
| `one_one` | Compare exactly 1 primary against exactly 1 target |
| `one_all` | Compare 1 primary against all documents in the same course/program (`_cohort`) |
| `one_selected` | Compare 1 primary against a chosen subset of target IDs |
| `many_selected` | Compare each of multiple primaries against the same chosen targets |
| `many_all` | Compare each of multiple primaries against all cohort documents |

`_cohort(db, doc, teacher, exclude_ids)` returns all documents belonging to
the same teacher, program, and course code, excluding the primary document
itself.

`_run_one(d1_dict, targets)` calls `compare_documents()` and wraps the results
with metadata about the primary document.

### 5.6 PDF Report Generation (`backend/app/reporter.py`)

`generate_report(primary_doc, results, output_path)` uses ReportLab's
`SimpleDocTemplate` with A4 page size. The report includes:

- Title and generation timestamp
- Course code and program
- Primary document name and student details
- A tabular comparison of all results with columns: `#`, `Document`, `Student`,
  `Matric`, `TF-IDF`, `Trigram`, `Semantic`, `Final`, `Risk`
- A "High Risk Matches" section listing all documents with `risk_level == "High"`
- Matched phrases for the top-3 results (up to 10 phrases each)

Reports are saved to `reports/report_{doc_id}.pdf`.

### 5.7 Teacher Access Code System

Teachers cannot self-register as teachers without an access code. The flow:
1. Admin generates a code via `POST /admin/teacher-codes` (random 5-byte hex
   by default, or a custom string).
2. During registration, the teacher supplies this code in the `teacher_code`
   form field.
3. `POST /auth/register` validates the code against `TeacherAccessCode` (must
   exist, `is_used == False`).
4. On success, `is_used` is set to `True` and `used_by` is set to the new
   teacher's ID.
5. Used codes cannot be deleted.

### 5.8 Student Self-Enrollment

Students can enroll in courses themselves via `POST /student/enroll` (not
just through admin). The `GET /courses/all` endpoint returns all available
courses with an `is_enrolled` boolean flag computed per-request:

```python
enrolled_ids = {
    e.course_id for e in db.query(StudentEnrollment).filter(
        StudentEnrollment.student_id == current_user.id).all()
}
```

Students can also unenroll via `DELETE /student/enroll/{course_id}`.

### 5.9 File Download for Teachers

`GET /documents/{doc_id}/download` (teacher-only):
- Verifies the document belongs to the requesting teacher (`doc.teacher_id == teacher.id`).
- Returns a `FileResponse` with `media_type="application/octet-stream"`.
- Frontend uses `{ responseType: "blob" }` in the axios call, then creates an
  `<a>` element programmatically to trigger a browser download.

### 5.10 Feedback Delivery

`POST /feedback/{doc1_id}` runs a cohort comparison and stores `Feedback`
rows for the student who submitted the primary document. The `only_flagged`
parameter limits records to `High` and `Medium` risk pairs. Existing feedback
for the same document/recipient is deleted before inserting new rows (idempotent
re-run).

Students view their feedback at `GET /feedback/me`, rendered in
`FeedbackPage.jsx` with a `ScoreRing` SVG component and similarity breakdown.

### 5.11 Frontend Routing (`frontend/src/App.jsx`)

`BrowserRouter` with route protection via `PrivateRoute`:

```jsx
function PrivateRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");
  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) {
    // redirect to correct dashboard
  }
  return children;
}
```

`DefaultRedirect` (on `path="*"`) reads `localStorage.role` and sends the user
to the appropriate dashboard or to `/login` if not authenticated.

Routes:
- `/login` → `LoginPage` (public)
- `/register` → `RegisterPage` (public)
- `/admin` → `AdminDashboard` (admin only)
- `/teacher` → `TeacherDashboard` (teacher only)
- `/student` → `StudentDashboard` (student only)
- `/feedback` → `FeedbackPage` (student only)

### 5.12 CSS Design System (`frontend/src/index.css`)

All styling uses plain CSS with custom properties (no Tailwind, no CSS-in-JS
library). Key design tokens:

```css
:root {
  --primary:       #1e3a5f;   /* dark navy */
  --accent:        #3b82f6;   /* blue */
  --success:       #059669;   /* green */
  --warning:       #d97706;   /* amber */
  --danger:        #dc2626;   /* red */
  --bg:            #f1f5f9;   /* page background */
  --surface:       #ffffff;   /* card background */
  --radius:        10px;
}
```

### 5.13 API Client (`frontend/src/api.js`)

A single axios instance is created with `baseURL: import.meta.env.VITE_API_URL || "/api"`.
Two interceptors are attached:
- **Request**: attaches `Authorization: Bearer <token>` from `localStorage`.
- **Response**: clears storage and redirects to `/login` on 401.

All API calls are exported as named functions. Form data is sent via
`new URLSearchParams(...)` for `application/x-www-form-urlencoded` endpoints
(matching FastAPI `Form(...)` parameters). File uploads use `FormData`.

### 5.14 Default Admin Account

On startup (`@app.on_event("startup")` → `seed_default_admin()`), the system
checks whether any admin user exists. If not, it creates one:

- **Email:** `admin@ase.edu`
- **Password:** `Admin@2025`

`hash_password` is imported inside the function body (not at module level) to
avoid a circular import between `database.py` and `auth.py`.

### 5.15 Vite Proxy Configuration (`frontend/vite.config.js`)

During development, the Vite dev server (port 5173) proxies all `/api/*`
requests to the FastAPI server (port 8000) and strips the `/api` prefix:

```js
proxy: {
  "/api": {
    target: "http://localhost:8000",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
  },
},
```

This means the backend routes (`/auth/login`, `/documents`, etc.) do not carry
an `/api` prefix — the prefix is a frontend-only convention.

---

## 6. Testing, Evaluation, and Results

### 6.1 Test Suite (`backend/tests/test_engine.py`)

The test suite is a standalone script (not a pytest test file — it is run with
`python tests/test_engine.py`). It imports `clean_text`, `tfidf_score`,
`trigram_scores`, `sbert_scores`, and `compare_documents` directly.

**Test documents** (`backend/tests/test_docs/`):

| File | Student (fictional) | Description |
|------|---------------------|-------------|
| `original.txt` | Chidi Eze (STU001) | Source document about machine learning |
| `exact_copy.txt` | Amaka Obi (STU002) | Word-for-word identical copy |
| `paraphrase.txt` | Tunde Bello (STU003) | Semantically equivalent, different wording |
| `partial_copy.txt` | Ngozi Nwosu (STU004) | First sentence copied, rest original |
| `different.txt` | Emeka Adaeze (STU005) | Unrelated topic (ancient Rome) |
| `diffrent.txt` | — | Duplicate of `different.txt` (alternate spelling of filename) |

**Document content (excerpts):**

- `original.txt`: *"Machine learning is a subset of artificial intelligence
  that enables computers to learn from data without being explicitly
  programmed..."*
- `exact_copy.txt`: Identical text.
- `paraphrase.txt`: *"Machine learning is a branch of AI that allows systems
  to automatically improve through experience and data analysis. These systems
  detect regularities in large amounts of information..."*
- `partial_copy.txt`: First sentence copied verbatim; rest is original text
  about evolving architectures.
- `different.txt`: *"The history of ancient Rome spans over a thousand years,
  beginning as a small pastoral community in the 8th century BC..."*

### 6.2 Validation Checks

The test suite runs `compare_documents(original, others)` and checks five
assertions:

| Check | Field | Threshold | Operator | Description |
|-------|-------|-----------|----------|-------------|
| `exact_copy.txt` | `final_score` | 85 | `>=` | Exact copy must score ≥ 85% |
| `paraphrase.txt` | `sbert_score` | 55 | `>=` | Paraphrase must score high semantically |
| `paraphrase.txt` | `tfidf_score` | 60 | `<=` | Paraphrase should score low lexically |
| `partial_copy.txt` | `final_score` | 30 | `>=` | Partial copy must score ≥ 30% |
| `different.txt` | `final_score` | 20 | `<=` | Unrelated document must score ≤ 20% |

These checks validate that the combined algorithm correctly distinguishes
between the four types of similarity (exact, semantic, partial, unrelated).
The paraphrase check specifically validates that SBERT catches what TF-IDF
misses.

### 6.3 Output Format

The test runner prints a formatted table to stdout:

```
Document             TF-IDF  Trigram   SBERT   Final  Risk
-------------------------------------------------------
exact_copy.txt        95.3%    97.1%   98.2%   96.3%  High
paraphrase.txt        31.4%    14.2%   72.3%   38.5%  Low
partial_copy.txt      41.2%    43.6%   55.1%   43.8%  Medium
different.txt          0.0%     0.0%    8.3%    1.7%  Low
```

(Exact values vary by environment and SBERT model version.)

---

## 7. Limitations and Future Work

### Known Limitations

1. **No OCR support**: `parser.py` checks for `< 20` characters of extracted
   text and raises a `ValueError` directing users to re-save scanned PDFs as
   text. Image-only PDFs are not supported.

2. **Embedding cache is unbounded and non-persistent**: `_embedding_cache` is a
   process-level Python dict with no TTL, eviction policy, or disk persistence.
   It grows with each unique document uploaded in a server session and is lost
   on server restart.

3. **SQLite database**: Suitable for single-instance deployment and development.
   Not suitable for concurrent write-heavy workloads or horizontal scaling.

4. **Hardcoded secret key**: `auth.py` contains `SECRET_KEY = "change-this-..."`.
   In production, this must be replaced with a securely generated secret loaded
   from an environment variable.

5. **Single-server architecture**: The SBERT model is loaded into the FastAPI
   process. Long-running comparison requests will block the event loop unless
   Uvicorn is configured with multiple workers (the lazy-load pattern in
   `get_model()` does not help with this).

6. **No rate limiting or abuse prevention**: The `/similarity/run` endpoint
   accepts arbitrary document sets and could be triggered repeatedly without
   restriction.

7. **No file size limit enforcement**: While format validation is enforced,
   there is no explicit maximum file size check before writing to disk.

8. **Auto-grading calibration is fixed**: The calibration divisor (`0.55`) is
   hard-coded and not adjustable per assignment or per teacher.

9. **Legacy endpoints**: `POST /compare/{doc1_id}` and `POST /documents/upload`
   exist for backward compatibility but are not used by the current frontend.
   `ResultsPage.jsx` and `UploadPage.jsx` are present on disk but not registered
   in the router.

### Potential Future Work

- Replace SQLite with PostgreSQL for production scalability
- Add a background task queue (e.g., Celery + Redis) to run SBERT comparisons
  asynchronously without blocking HTTP requests
- Persist the embedding cache to disk (e.g., LMDB or a Redis key-value store)
- Add OCR support for scanned PDFs (e.g., Tesseract)
- Expose configurable score weights and calibration parameters per-assignment
- Add unit tests using pytest with mocked DB sessions
- Implement email notifications for similarity flagging and grade delivery
- Add pagination to document and result lists for large course cohorts

---

## 8. How to Run

### Prerequisites

- Python 3.10+
- Node.js 18+
- Git

### Backend Setup

```bash
cd similarity-engine/backend

# Create and activate a virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download NLTK data (required on first run)
python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('punkt_tab')"

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The SBERT model (`all-MiniLM-L6-v2`) is downloaded automatically from Hugging
Face on the first similarity request. This takes a few seconds and requires an
internet connection on the first run; subsequent runs use the local cache.

The database file (`similarity.db`) is created automatically in the `backend/`
directory on first run. The default admin account (`admin@ase.edu` / `Admin@2025`)
is seeded on startup.

### Frontend Setup

```bash
cd similarity-engine/frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend will be available at `http://localhost:5173`. API requests to
`/api/*` are proxied automatically to `http://localhost:8000`.

### Running the Test Suite

```bash
cd similarity-engine/backend
python tests/test_engine.py
```

This runs all five validation checks and prints a pass/fail summary.

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FRONTEND_URL` | `""` | Additional allowed CORS origin (for production deployment) |
| `VITE_API_URL` | `""` (uses `/api` proxy) | Overrides the API base URL in the frontend build |

### Production Build

```bash
cd frontend
npm run build
# Outputs to frontend/dist/
```

The built static files can be served by any static file host (Nginx, Vercel,
Netlify). Set `VITE_API_URL` to the deployed backend URL before building.
