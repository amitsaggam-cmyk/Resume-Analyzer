from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager
from sqlalchemy.future import select
from fastapi import Header

from database import engine, Base, get_db
import models
import schemas
from pdf_utils import extract_text_from_pdf
from llm_service import analyze_resume_with_llm

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="Resume Analyzer AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
    "message": "Success", 
    "results": ai_results,
    "extracted_text": resume.content # <-- ADD THIS (use whatever variable holds your raw text!)
}

# --- RESUME UPLOAD ---
@app.post("/api/upload-resume", response_model=schemas.ResumeResponse)
async def upload_resume(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".pdf") or filename_lower.endswith(".txt")):
        raise HTTPException(status_code=400, detail="Only PDF and TXT allowed.")

    file_bytes = await file.read()
    try:
        if filename_lower.endswith(".pdf"):
            extracted_text = await extract_text_from_pdf(file_bytes)
        else:
            extracted_text = file_bytes.decode('utf-8').strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")

    new_resume = models.Resume(filename=file.filename, extracted_text=extracted_text)
    db.add(new_resume)
    await db.commit()
    await db.refresh(new_resume)
    return new_resume

# --- RUN ANALYSIS ---
@app.post("/api/analyze")
async def analyze_resume(
    request: schemas.AnalyzeRequest, 
    db: AsyncSession = Depends(get_db),
    user_id: str = Header("anonymous") # <--- GET USER ID FROM HEADER
):
    result = await db.execute(select(models.Resume).where(models.Resume.id == request.resume_id))
    resume = result.scalars().first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    try:
        ai_result = await analyze_resume_with_llm(resume.extracted_text, request.job_description)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

    jd_record = models.JobDescription(content=request.job_description)
    db.add(jd_record)
    await db.flush()

    new_analysis = models.Analysis(
        resume_id=resume.id,
        job_description_id=jd_record.id,
        user_id=user_id, # <--- SAVE IT TO DB
        match_score=ai_result.get("match_score", 0),
        matched_skills=ai_result.get("matched_skills", []), 
        missing_skills=ai_result.get("missing_skills", []),
        ats_tips=ai_result.get("ats_tips", [])
    )
    db.add(new_analysis)
    await db.commit()
    await db.refresh(new_analysis)

    for item in ai_result.get("weak_bullets", []):
        db.add(models.Suggestion(
            analysis_id=new_analysis.id,
            original_bullet=item.get("original", ""),
            rewritten_bullet=item.get("rewritten", "")
        ))
    await db.commit()

    return {"analysis_id": new_analysis.id, "results": ai_result}

# --- GET HISTORY ---
@app.get("/api/history")
async def get_history(
    db: AsyncSession = Depends(get_db),
    user_id: str = Header("anonymous") # <--- GET USER ID FROM HEADER
):
    query = (
        select(models.Analysis, models.Resume.filename, models.JobDescription.content)
        .join(models.Resume, models.Analysis.resume_id == models.Resume.id)
        .join(models.JobDescription, models.Analysis.job_description_id == models.JobDescription.id)
        .where(models.Analysis.user_id == user_id) # <--- FILTER BY THIS USER ONLY!
        .order_by(models.Analysis.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()
    
    return [{
        "id": a.id,
        "resume_filename": fname,
        "job_description": (jd[:100] + "...") if jd else "No description", 
        "match_score": a.match_score,
        "created_at": a.created_at
    } for a, fname, jd in rows]

# --- GET SPECIFIC DETAILS (The "View Details" Fix) ---
@app.get("/api/analysis/{analysis_id}")
async def get_analysis_details(analysis_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Analysis).where(models.Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Audit not found")

    sug_result = await db.execute(select(models.Suggestion).where(models.Suggestion.analysis_id == analysis_id))
    suggestions = sug_result.scalars().all()
        
    return {
        "id": analysis.id,
        "results": {
            "match_score": analysis.match_score,
            "matched_skills": analysis.matched_skills,
            "missing_skills": analysis.missing_skills,
            "ats_tips": analysis.ats_tips,
            "weak_bullets": [
                {"original": s.original_bullet, "rewritten": s.rewritten_bullet} 
                for s in suggestions
            ]
        },
        "created_at": analysis.created_at
    }

# Don't forget to import the new function at the top of main.py!
from llm_service import analyze_resume_with_llm, generate_cover_letter_with_llm

@app.post("/api/cover-letter")
async def create_cover_letter(request: schemas.AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    # 1. Fetch the resume text
    result = await db.execute(select(models.Resume).where(models.Resume.id == request.resume_id))
    resume = result.scalars().first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    # 2. Generate the letter
    try:
        letter = await generate_cover_letter_with_llm(resume.extracted_text, request.job_description)
        return {"cover_letter": letter}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cover Letter generation failed: {str(e)}")