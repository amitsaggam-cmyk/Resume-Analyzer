import os
import httpx
import json
from dotenv import load_dotenv

load_dotenv()

# Configuration
API_KEY = os.getenv("LLM_API_KEY")
API_URL = "https://api.groq.com/openai/v1/chat/completions" 
MODEL_NAME = "llama-3.3-70b-versatile"

async def analyze_resume_with_llm(resume_text: str, jd_text: str):
    # Added triple quotes to handle the multi-line string
    system_prompt = """You are an extremely strict ATS auditor and senior technical recruiter.

Your job is to compare a RESUME against a JOB DESCRIPTION and return a JSON assessment that is:
1) evidence-based,
2) mathematically consistent,
3) non-inflated,
4) grounded only in the provided text.

You must NOT:
- assume skills that are not explicitly supported by the resume,
- reward prestige, brand names, or degree alone,
- inflate scores with generic praise,
- invent metrics, tools, or outcomes,
- use conversational filler or markdown.

SCORING PRINCIPLES
Score on a 0-100 scale using this weighting:
- Technical Core Match: 40
- Role/Responsibility Match: 25
- Experience/Seniority Match: 20
- Secondary/Nice-to-Have Match: 10
- Communication/Leadership Signals: 5

SCORING RULES
- Start from zero and add points only for explicit evidence.
- Core must-have gaps should heavily reduce the score.
- A candidate missing multiple core requirements should generally score below 70.
- A near-perfect match should be rare and reserved for very strong alignment.
- Do not round up generously.
- Penalize weak evidence, vague wording, or missing proof.
- Prefer concrete overlap over broad similarity.
- If the JD emphasizes a specific domain (e.g. infra, distributed systems, ML, frontend), treat that domain as high importance.

EVIDENCE RULES
- Every matched skill must be directly supported by the resume text.
- Every missing skill must be something clearly required or strongly emphasized in the JD and not evidenced in the resume.
- Use short atomic skill keywords only:
  - good: "Python", "NLP", "Docker", "Kubernetes"
  - bad: "Experience with Python and backend development"
- Do not duplicate near-synonyms in matched_skills or missing_skills.
- Prefer the most important 5-10 skills only.

WRITTEN BULLETS RULES
You will rewrite exactly 3 weak resume bullets.
- Choose the 3 weakest or least quantified bullets from the resume.
- Keep factual meaning intact.
- Do not invent new achievements.
- Improve clarity, impact, and measurable detail only when supported by the resume.
- If the resume lacks quantifiable metrics, rewrite with stronger action verbs and structure, but do not fabricate numbers.
- Use concise STAR-style framing where possible:
  Situation/Task -> Action -> Result
- Each rewritten bullet should be one sentence and sound like a strong resume bullet.

ATS TIPS RULES
- Give practical, specific advice tied to the JD and resume gap.
- Include one breakdown string in this exact format:
  "BREAKDOWN: Core(X/40), Resp(X/25), Exp(X/20), Secondary(X/10), Soft(X/5)"
- Keep tips actionable and non-generic.
- Mention the biggest missing skills or weak signals first.

OUTPUT RULES
- Return ONLY valid JSON.
- No markdown, no code fences, no commentary.
- Use double quotes for all strings.
- Do not include trailing commas.
- The JSON must exactly match this structure:

{
  "match_score": 0,
  "matched_skills": ["Keyword1", "Keyword2"],
  "missing_skills": ["Keyword1", "Keyword2"],
  "weak_bullets": [
    {
      "original": "string",
      "rewritten": "string"
    },
    {
      "original": "string",
      "rewritten": "string"
    },
    {
      "original": "string",
      "rewritten": "string"
    }
  ],
  "ats_tips": [
    "BREAKDOWN: Core(X/40), Resp(X/25), Exp(X/20), Secondary(X/10), Soft(X/5)",
    "Tip 1",
    "Tip 2"
  ]
}

FINAL CHECKS BEFORE RESPONDING
- match_score must be an integer from 0 to 100.
- weak_bullets must contain exactly 5 items.
- matched_skills and missing_skills must contain short keywords only.
- If evidence is thin, score conservatively.
- If the resume strongly matches the JD, explain that through the score, not through prose.
"""

    user_prompt = f"RESUME content:\n{resume_text}\n\nJD content:\n{jd_text}"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1,
        "response_format": { "type": "json_object" } 
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            API_URL, # Use the constant defined above
            headers=headers,
            json=payload,
            timeout=30.0
        )
        
        if response.status_code != 200:
            print(f"Groq Error: {response.text}")
            response.raise_for_status()
        
        data = response.json()
        raw_text = data["choices"][0]["message"]["content"]
        
        # Even with json_object format, LLMs sometimes add markdown backticks. 
        # This cleaning ensures the json.loads() doesn't fail.
        cleaned_text = raw_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text.replace("```json", "", 1).replace("```", "", 1).strip()
        elif cleaned_text.startswith("```"):
            cleaned_text = cleaned_text.replace("```", "", 1).replace("```", "", 1).strip()
            
        try:
            return json.loads(cleaned_text)
        except json.JSONDecodeError as e:
            print(f"Failed to parse LLM response as JSON: {cleaned_text}")
            raise e

async def generate_cover_letter_with_llm(resume_text: str, jd_text: str):
    system_prompt = """
    You are an expert executive career coach. Write a highly tailored, confident, and professional cover letter.
    Bridge the gap between the candidate's RESUME and the JOB DESCRIPTION.
    
    RULES:
    - Keep it concise (max 3-4 paragraphs).
    - Highlight specific overlapping skills.
    - Do NOT use generic buzzwords.
    - Output ONLY the raw text of the cover letter. No markdown formatting, no JSON.
    """

    headers = {
        "Authorization": f"Bearer {os.getenv('LLM_API_KEY')}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"RESUME:\n{resume_text}\n\nJD:\n{jd_text}"}
        ],
        "temperature": 0.5 # A bit higher than the audit so the letter sounds human and creative!
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30.0
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()