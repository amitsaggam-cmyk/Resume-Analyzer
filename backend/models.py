# backend/models.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# --- NEW: Users Table ---
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    resumes = relationship("Resume", back_populates="user")


# --- UPDATED: Resumes Table ---
class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Links to User
    filename = Column(String(255), nullable=False)
    extracted_text = Column(Text, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="resumes")
    analyses = relationship("Analysis", back_populates="resume", cascade="all, delete-orphan")


# --- NEW: Job Descriptions Table ---
class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    analyses = relationship("Analysis", back_populates="job_description_rel")


# --- UPDATED: Analyses Table ---
# Inside backend/models.py
# Inside backend/models.py

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"))
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id"))
    
    # --- ADD THIS NEW LINE ---
    user_id = Column(String(100), index=True, default="anonymous")
    
    match_score = Column(Integer)
    # ... (keep the rest of your columns the same)
    
    # --- NEW COLUMNS ---
    matched_skills = Column(JSON, nullable=True) # List of strings
    missing_skills = Column(JSON, nullable=True) # List of strings
    ats_tips = Column(JSON, nullable=True)       # List of strings
    # -------------------
    
    created_at = Column(DateTime, default=datetime.utcnow)

    resume = relationship("Resume", back_populates="analyses")
    job_description_rel = relationship("JobDescription", back_populates="analyses")
    suggestions = relationship("Suggestion", back_populates="analysis", cascade="all, delete-orphan")


# --- Suggestions Table (Unchanged) ---
class Suggestion(Base):
    __tablename__ = "suggestions"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False)
    original_bullet = Column(Text, nullable=False)
    rewritten_bullet = Column(Text, nullable=False)

    analysis = relationship("Analysis", back_populates="suggestions")