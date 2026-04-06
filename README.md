# AI Resume Analyzer & Job Match Agent

An AI-powered full-stack application that analyzes uploaded resumes against a specific job description. It scores the match, identifies missing keywords, and uses LLMs to rewrite weak bullet points to boost ATS compatibility.

## Tech Stack
* **Frontend:** React 18, Vite, Tailwind CSS
* **Backend:** FastAPI, Python
* **Database:** MySQL 8, async SQLAlchemy, aiomysql
* **AI & Utilities:** Groq/OpenAI (LLM), PyMuPDF (PDF Extraction), httpx (async HTTP calls), pytest (Unit Testing)

## Prerequisites
* Node.js & npm installed
* Python 3.9+ installed
* MySQL Server running
* Groq or OpenAI API Key

## Project Setup Instructions

### 1. Database Setup
Create a MySQL database named `resume_analyzer_db`:
```sql
CREATE DATABASE resume_analyzer_db;