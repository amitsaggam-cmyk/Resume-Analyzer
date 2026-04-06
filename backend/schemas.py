# backend/schemas.py
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List

class ResumeResponse(BaseModel):
    id: int
    filename: str
    extracted_text: str
    uploaded_at: datetime

    # The modern Pydantic V2 way to link with SQLAlchemy
    model_config = ConfigDict(from_attributes=True)

class AnalyzeRequest(BaseModel):
    resume_id: int
    job_description: str

class BulletImprovement(BaseModel):
    original: str
    rewritten: str

class AIAnalysisResult(BaseModel):
    match_score: int
    ats_compatibility_score: int
    missing_skills: List[str]
    bullet_improvements: List[BulletImprovement]

# Inside backend/schemas.py
class WeakBullet(BaseModel):
    original: str
    rewritten: str

class AIAnalysisResult(BaseModel):
    match_score: int
    matched_skills: List[str]
    missing_skills: List[str]
    weak_bullets: List[WeakBullet]
    ats_tips: List[str]