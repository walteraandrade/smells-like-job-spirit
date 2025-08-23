from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
from pathlib import Path

from app.services.llm_service import LLMService, CVData
from app.services.pdf_parser import DocumentParser

app = FastAPI(title="Smells Like Job Spirit API", version="1.0.0")

#CORS middleware for browser extension
app.add_middleware(
        CORSMiddleware,
        allow_origins=["chrome-extension://*", "moz-extension://*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        )

# Initialize services
llm_service = LLMService()
document_parser = DocumentParser()

@app.post("/api/parse-cv", response_model=CVData)
async def parse_cv(file: UploadFile = File(...)):
    """Parse uploaded file and return structured data"""

    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in document_parser.supported_formats:
        raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format. Suported: {document_parser.supported_formats}"
                )

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_file.flush()

        try:
            # Extract text from document
            cv_text = document_parser.extract_text(tmp_file.name)
            if not cv_text:
                raise HTTPException(status_code=422, detail="Could not extract text from file")

            # Parse CV with LLM
            parsed_data = llm_service.parse_cv(cv_text)
            if not parsed_data:
                raise HTTPException(status_code=422, detail="Could not parse CV content")

            return parsed_data

        finally:
            os.unlink(tmp_file.name)

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""

    try:
        test_response = llm_service._call_ollama("Test connection")
        return {"status": "healthy", "llm_connected": True}

    except Exception:
        return {"status": "unhealthy", "llm_connected": False}

@app.post("/api/fill_form")
async def fill_form(form_data: dict):
    """Analyze fields and return matching CV data"""
    return {"message": "Form filling endpoint to be implemented"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
