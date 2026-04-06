# backend/pdf_utils.py
import fitz  # PyMuPDF

async def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Reads a PDF file from bytes and extracts all text.
    """
    text = ""
    # Open the PDF directly from memory (no need to save it to disk first!)
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        for page in doc:
            text += page.get_text()
            
    return text.strip()