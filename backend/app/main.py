from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile
import os
from pathlib import Path
from typing import List, Dict, Any

from app.services.llm_service import LLMService, CVData
from app.services.pdf_parser import DocumentParser
from app.services.form_detector import FormDetector

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
form_detector = FormDetector()

class FormFieldData(BaseModel):
    name: str
    type: str
    label: str = ''
    placeholder: str = ''
    id: str = ''
    required: bool = False


class FormMappingRequest(BaseModel):
    cv_data: Dict[str, Any]
    form_fields: List[FormFieldData]
    

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
        temp_file.write(content)
        temp_file.flush()

        try:
            # Extract text from document
            cv_text = document_parser.extract_text(temp_file.name)
            if not cv_text:
                raise HTTPException(status_code=422, detail="Could not extract text from file")

            # Parse CV with LLM
            parsed_data = llm_service.parse_cv(cv_text)
            if not parsed_data:
                raise HTTPException(status_code=422, detail="Could not parse CV content")

            return parsed_data

        finally:
            os.unlink(temp_file.name)
            

@app.post("/api/generate-mappings")
async def generate_mappings(request: FormMappingRequest):
    """Generate mappings between CV data and form fields"""
    try:
        form_fields_dict = [field.dict() for field in request.form_fields]
        mappings = form_detector.generate_field_mapping(request.cv_data, form_fields_dict)
        
        return {
            "success": True,
            "mappings": mappings["mappings"],
           "unmapped_fields": mappings["unmapped_fields"],
            "confidence_scores": mappings["confidence_scores"],
            "total_fields": len(request.form_fields),
            "mapped_fields": len(mappings["mappings"]),
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating mappings: {str(e)}")


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
