# CV Autofill Tool Development Plan

*A comprehensive guide to building an intelligent job application form autofill tool using local LLMs*

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Development Environment Setup](#development-environment-setup)
4. [Phase 1: Local LLM Setup](#phase-1-local-llm-setup)
5. [Phase 2: CV Parsing Service](#phase-2-cv-parsing-service)
6. [Phase 3: Browser Extension Development](#phase-3-browser-extension-development)
7. [Phase 4: Form Detection & Mapping](#phase-4-form-detection--mapping)
8. [Phase 5: Integration & Testing](#phase-5-integration--testing)
9. [Phase 6: Advanced Features](#phase-6-advanced-features)
10. [Deployment & Maintenance](#deployment--maintenance)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Resources & References](#resources--references)

## Project Overview

### What We're Building
An intelligent browser extension that automatically fills job application forms using data extracted from your CV by a local Large Language Model (LLM). This tool will:

- Parse CV documents in multiple formats (PDF, DOCX, TXT)
- Extract structured information using local LLMs
- Detect form fields on job application pages
- Automatically populate forms with relevant CV data
- Maintain privacy by running entirely locally

### Target System Specifications
This guide assumes a system with:
- **CPU**: Modern multi-core processor (Intel i5+ or AMD Ryzen 5+)
- **RAM**: 16GB+ (32GB recommended for larger models)
- **GPU**: 6GB+ VRAM for optimal performance (RTX 3060 or better)
- **Storage**: 50GB+ free space for models and dependencies
- **OS**: Linux (Arch Linux in examples), macOS, or Windows

### Key Technologies
- **Local LLM**: Ollama with Llama 3.1 8B
- **Backend**: Python with FastAPI
- **CV Parsing**: PyMuPDF, python-docx, Pillow
- **Browser Extension**: JavaScript (Manifest V3)
- **Browser Automation**: Selenium WebDriver
- **Database**: SQLite for configuration storage

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CV Document   │───▶│   CV Parser      │───▶│  Structured     │
│  (PDF/DOCX/TXT) │    │  (LLM Service)   │    │  JSON Data      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        │
┌─────────────────┐    ┌──────────────────┐             │
│ Browser         │◄───│     FastAPI      │◄────────────┘
│ Extension       │    │   Backend API    │
└─────────────────┘    └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ Job Application │    │   SQLite DB      │
│ Form Detection  │    │ (User Config &   │
│ & Auto-fill     │    │  Field Mappings) │
└─────────────────┘    └──────────────────┘
```

### Component Breakdown

1. **CV Parser Service**: Local LLM-powered service that extracts structured data
2. **Backend API**: FastAPI server managing data flow and configuration
3. **Browser Extension**: Frontend interface and form manipulation
4. **Database Layer**: SQLite for storing user preferences and field mappings
5. **Form Detection Engine**: Intelligent form field identification and classification

## Development Environment Setup

### Prerequisites Installation

#### 1. System Dependencies (Arch Linux)
```bash
# Update system
sudo pacman -Syu

# Install essential development tools
sudo pacman -S base-devel git python python-pip nodejs npm

# Install additional dependencies
sudo pacman -S poppler-tools tesseract tesseract-data-eng

# Install GPU support (if using NVIDIA)
sudo pacman -S cuda cudnn
```

#### 2. Python Environment
```bash
# Create project directory
mkdir cv-autofill-tool
cd cv-autofill-tool

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install fastapi uvicorn requests python-multipart
pip install PyMuPDF python-docx pillow pytesseract
pip install selenium webdriver-manager
pip install sqlite3 pydantic python-dotenv
pip install pytest pytest-asyncio httpx
```

#### 3. Node.js Dependencies (for browser extension)
```bash
# Create extension directory
mkdir browser-extension
cd browser-extension
npm init -y

# Install development dependencies
npm install --save-dev webpack webpack-cli webpack-extension-reloader
npm install --save-dev copy-webpack-plugin html-webpack-plugin
```

### Project Structure
```
cv-autofill-tool/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── cv_parser.py
│   │   │   └── form_filler.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── cv_data.py
│   │   │   └── form_data.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── llm_service.py
│   │       ├── pdf_parser.py
│   │       └── form_detector.py
│   ├── requirements.txt
│   └── tests/
├── browser-extension/
│   ├── manifest.json
│   ├── background/
│   │   └── background.js
│   ├── content/
│   │   ├── content.js
│   │   └── form-detector.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── assets/
├── models/ (LLM models will be stored here)
├── docs/
├── README.md
└── requirements.txt
```

## Phase 1: Local LLM Setup

### Step 1.1: Install Ollama

Ollama is the easiest way to run local LLMs with GPU acceleration.

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve
```

### Step 1.2: Download and Configure Llama 3.1 8B

```bash
# Pull the model (this will download ~4.7GB)
ollama pull llama3.1:8b

# Test the model
ollama run llama3.1:8b "Hello, can you help me parse some text?"
```

### Step 1.3: Create LLM Service Wrapper

Create `backend/app/services/llm_service.py`:

```python
import requests
import json
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel

class CVData(BaseModel):
    personal_info: Dict[str, Any]
    education: list
    experience: list
    skills: list
    certifications: list
    languages: list

class LLMService:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.model = "llama3.1:8b"
        
    def parse_cv(self, cv_text: str) -> Optional[CVData]:
        """Parse CV text using local LLM and return structured data."""
        
        prompt = self._create_cv_parsing_prompt(cv_text)
        
        try:
            response = self._call_ollama(prompt)
            parsed_data = self._extract_json_from_response(response)
            return CVData(**parsed_data)
        except Exception as e:
            logging.error(f"Error parsing CV: {e}")
            return None
    
    def _create_cv_parsing_prompt(self, cv_text: str) -> str:
        """Create a structured prompt for CV parsing."""
        return f"""
You are a professional CV parser. Extract information from the following CV text and return it as valid JSON.

IMPORTANT: Return ONLY valid JSON, no markdown formatting or explanations.

Required JSON structure:
{{
    "personal_info": {{
        "full_name": "string",
        "email": "string",
        "phone": "string",
        "address": "string",
        "city": "string",
        "country": "string",
        "linkedin": "string",
        "github": "string"
    }},
    "education": [
        {{
            "degree": "string",
            "institution": "string",
            "graduation_year": "string",
            "gpa": "string",
            "field_of_study": "string"
        }}
    ],
    "experience": [
        {{
            "job_title": "string",
            "company": "string",
            "start_date": "string",
            "end_date": "string",
            "location": "string",
            "description": "string",
            "achievements": ["string"]
        }}
    ],
    "skills": [
        {{
            "category": "string",
            "items": ["string"]
        }}
    ],
    "certifications": [
        {{
            "name": "string",
            "issuer": "string",
            "date": "string",
            "expiry": "string"
        }}
    ],
    "languages": [
        {{
            "language": "string",
            "proficiency": "string"
        }}
    ]
}}

CV Text:
{cv_text}

JSON Response:
"""
    
    def _call_ollama(self, prompt: str) -> str:
        """Make API call to local Ollama instance."""
        url = f"{self.base_url}/api/generate"
        data = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "top_p": 0.9,
                "num_predict": 2048
            }
        }
        
        response = requests.post(url, json=data, timeout=120)
        response.raise_for_status()
        return response.json()["response"]
    
    def _extract_json_from_response(self, response: str) -> Dict[str, Any]:
        """Extract JSON from LLM response, handling potential formatting issues."""
        # Find JSON content between braces
        start_idx = response.find("{")
        end_idx = response.rfind("}") + 1
        
        if start_idx == -1 or end_idx == 0:
            raise ValueError("No JSON found in response")
        
        json_str = response[start_idx:end_idx]
        return json.loads(json_str)

# Test the service
if __name__ == "__main__":
    llm_service = LLMService()
    sample_cv = """
    John Doe
    Software Engineer
    john.doe@email.com | +1234567890
    New York, NY
    
    Experience:
    - Senior Developer at Tech Corp (2020-2023)
    - Junior Developer at StartUp Inc (2018-2020)
    
    Education:
    - BS Computer Science, MIT, 2018
    
    Skills: Python, JavaScript, React, Docker
    """
    
    result = llm_service.parse_cv(sample_cv)
    print(json.dumps(result.dict(), indent=2))
```

### Step 1.4: Test LLM Integration

Create `backend/test_llm.py`:

```python
from app.services.llm_service import LLMService
import json

def test_llm_service():
    llm = LLMService()
    
    sample_cv = """
    Jane Smith
    Full Stack Developer
    jane.smith@email.com
    Phone: +1-555-0123
    LinkedIn: linkedin.com/in/janesmith
    
    EXPERIENCE
    Senior Full Stack Developer | Google LLC | 2021 - Present
    • Led development of scalable web applications using React and Node.js
    • Managed team of 5 developers
    • Improved system performance by 40%
    
    Frontend Developer | Facebook | 2019 - 2021
    • Built responsive user interfaces using React and Redux
    • Collaborated with UX/UI designers
    
    EDUCATION
    Master of Science in Computer Science
    Stanford University | 2019
    GPA: 3.8/4.0
    
    Bachelor of Science in Computer Science  
    UC Berkeley | 2017
    
    SKILLS
    Programming: JavaScript, Python, Java, TypeScript
    Frontend: React, Vue.js, HTML5, CSS3
    Backend: Node.js, Express, Django, Flask
    Database: PostgreSQL, MongoDB, Redis
    DevOps: Docker, AWS, Kubernetes
    
    LANGUAGES
    English (Native)
    Spanish (Professional)
    French (Conversational)
    """
    
    result = llm.parse_cv(sample_cv)
    
    if result:
        print("✅ CV parsed successfully!")
        print(json.dumps(result.dict(), indent=2))
    else:
        print("❌ Failed to parse CV")

if __name__ == "__main__":
    test_llm_service()
```

Run the test:
```bash
cd backend
python test_llm.py
```

## Phase 2: CV Parsing Service

### Step 2.1: Document Processing Service

Create `backend/app/services/pdf_parser.py`:

```python
import fitz  # PyMuPDF
import docx
import pytesseract
from PIL import Image
import io
import logging
from typing import Optional
from pathlib import Path

class DocumentParser:
    """Service for extracting text from various document formats."""
    
    def __init__(self):
        self.supported_formats = {'.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg'}
    
    def extract_text(self, file_path: str) -> Optional[str]:
        """Extract text from document based on file extension."""
        path = Path(file_path)
        
        if path.suffix.lower() not in self.supported_formats:
            logging.error(f"Unsupported file format: {path.suffix}")
            return None
        
        try:
            if path.suffix.lower() == '.pdf':
                return self._extract_from_pdf(file_path)
            elif path.suffix.lower() in {'.docx', '.doc'}:
                return self._extract_from_docx(file_path)
            elif path.suffix.lower() == '.txt':
                return self._extract_from_txt(file_path)
            elif path.suffix.lower() in {'.png', '.jpg', '.jpeg'}:
                return self._extract_from_image(file_path)
        except Exception as e:
            logging.error(f"Error extracting text from {file_path}: {e}")
            return None
    
    def _extract_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file."""
        doc = fitz.open(file_path)
        text = ""
        
        for page_num in range(doc.page_count):
            page = doc[page_num]
            text += page.get_text()
            
            # If no text found, try OCR on images
            if not text.strip():
                pix = page.get_pixmap()
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                text += pytesseract.image_to_string(img)
        
        doc.close()
        return text.strip()
    
    def _extract_from_docx(self, file_path: str) -> str:
        """Extract text from DOCX file."""
        doc = docx.Document(file_path)
        text = []
        
        for paragraph in doc.paragraphs:
            text.append(paragraph.text)
        
        return '\n'.join(text).strip()
    
    def _extract_from_txt(self, file_path: str) -> str:
        """Extract text from TXT file."""
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read().strip()
    
    def _extract_from_image(self, file_path: str) -> str:
        """Extract text from image using OCR."""
        image = Image.open(file_path)
        return pytesseract.image_to_string(image).strip()

# Test the document parser
if __name__ == "__main__":
    parser = DocumentParser()
    # Test with your CV file
    text = parser.extract_text("/path/to/your/cv.pdf")
    print(f"Extracted {len(text)} characters")
    print(text[:500] + "..." if len(text) > 500 else text)
```

### Step 2.2: FastAPI Backend

Create `backend/app/main.py`:

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
from pathlib import Path

from app.services.llm_service import LLMService, CVData
from app.services.pdf_parser import DocumentParser

app = FastAPI(title="CV Autofill API", version="1.0.0")

# CORS middleware for browser extension
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
    """Parse uploaded CV file and return structured data."""
    
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in document_parser.supported_formats:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Supported: {document_parser.supported_formats}"
        )
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
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
            # Clean up temporary file
            os.unlink(tmp_file.name)

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Test LLM connection
        test_response = llm_service._call_ollama("Test connection")
        return {"status": "healthy", "llm_connected": True}
    except Exception:
        return {"status": "unhealthy", "llm_connected": False}

@app.post("/api/fill-form")
async def fill_form(form_data: dict):
    """Analyze form fields and return matching CV data."""
    # This will be implemented in Phase 4
    return {"message": "Form filling endpoint - to be implemented"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Step 2.3: Start Backend Server

Create `backend/start_server.py`:

```python
import subprocess
import sys
import time
import requests
from pathlib import Path

def check_ollama():
    """Check if Ollama is running and start if needed."""
    try:
        requests.get("http://localhost:11434/api/tags", timeout=5)
        print("✅ Ollama is running")
        return True
    except requests.exceptions.ConnectionError:
        print("❌ Ollama is not running")
        print("Starting Ollama...")
        
        # Start Ollama in background
        subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Wait for Ollama to start
        for i in range(30):  # Wait up to 30 seconds
            try:
                requests.get("http://localhost:11434/api/tags", timeout=2)
                print("✅ Ollama started successfully")
                return True
            except requests.exceptions.ConnectionError:
                time.sleep(1)
        
        print("❌ Failed to start Ollama")
        return False

def check_model():
    """Check if required model is available."""
    try:
        response = requests.get("http://localhost:11434/api/tags")
        models = response.json().get("models", [])
        
        for model in models:
            if "llama3.1:8b" in model.get("name", ""):
                print("✅ Llama 3.1 8B model is available")
                return True
        
        print("❌ Llama 3.1 8B model not found")
        print("Installing model... (this may take a few minutes)")
        subprocess.run(["ollama", "pull", "llama3.1:8b"])
        return True
        
    except Exception as e:
        print(f"❌ Error checking model: {e}")
        return False

def start_api_server():
    """Start the FastAPI server."""
    print("Starting CV Autofill API server...")
    subprocess.run([sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"])

if __name__ == "__main__":
    print("🚀 Starting CV Autofill Backend...")
    
    # Check prerequisites
    if not check_ollama():
        sys.exit(1)
    
    if not check_model():
        sys.exit(1)
    
    # Start API server
    start_api_server()
```

Run the backend:
```bash
cd backend
python start_server.py
```

Test the API:
```bash
# Use cURL to send a GET request to the health check endpoint of the API.
# This verifies that the backend server is running and responsive.
curl http://localhost:8000/api/health

# Use cURL to send a POST request to the CV parsing endpoint.
# This tests the file upload and parsing functionality.
# Replace `/path/to/your/cv.pdf` with the actual path to a CV file.
curl -X POST -F "file=@/path/to/your/cv.pdf" http://localhost:8000/api/parse-cv
```

## Phase 3: Browser Extension Development

### Step 3.1: Extension Manifest

Create `browser-extension/manifest.json`:

```json
{
    "manifest_version": 3,
    "name": "CV Autofill Assistant",
    "version": "1.0.0",
    "description": "Automatically fill job application forms using your CV data",
    
    "permissions": [
        "activeTab",
        "storage",
        "tabs"
    ],
    
    "host_permissions": [
        "http://localhost:8000/*",
        "https://*/*"
    ],
    
    "background": {
        "service_worker": "background/background.js"
    },
    
    "content_scripts": [{
        "matches": ["<all_urls>"],
        "js": ["content/content.js"],
        "css": ["content/content.css"],
        "run_at": "document_end"
    }],
    
    "action": {
        "default_popup": "popup/popup.html",
        "default_title": "CV Autofill Assistant"
    },
    
    "icons": {
        "16": "assets/icon16.png",
        "48": "assets/icon48.png",
        "128": "assets/icon128.png"
    },
    
    "web_accessible_resources": [{
        "resources": ["content/*"],
        "matches": ["<all_urls>"]
    }]
}
```

### Step 3.2: Background Script

Create `browser-extension/background/background.js`:

```javascript
// Background script for handling API communication and storage

class CVAutofillBackground {
    constructor() {
        this.API_BASE_URL = 'http://localhost:8000/api';
        this.init();
    }
    
    init() {
        // Listen for messages from content script and popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async response
        });
        
        // Handle installation
        chrome.runtime.onInstalled.addListener(() => {
            console.log('CV Autofill Assistant installed');
            this.initializeStorage();
        });
    }
    
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'parseCV':
                    const result = await this.parseCV(request.file);
                    sendResponse({ success: true, data: result });
                    break;
                    
                case 'getCVData':
                    const cvData = await this.getCVData();
                    sendResponse({ success: true, data: cvData });
                    break;
                    
                case 'saveCVData':
                    await this.saveCVData(request.data);
                    sendResponse({ success: true });
                    break;
                    
                case 'fillForm':
                    await this.fillForm(sender.tab.id, request.formData);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async parseCV(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${this.API_BASE_URL}/parse-cv`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const parsedData = await response.json();
        
        // Save parsed data to storage
        await this.saveCVData(parsedData);
        
        return parsedData;
    }
    
    async getCVData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['cvData'], (result) => {
                resolve(result.cvData || null);
            });
        });
    }
    
    async saveCVData(data) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ cvData: data }, resolve);
        });
    }
    
    async fillForm(tabId, formData) {
        // Send message to content script to fill the form
        chrome.tabs.sendMessage(tabId, {
            action: 'performFill',
            formData: formData
        });
    }
    
    initializeStorage() {
        chrome.storage.local.get(['cvData'], (result) => {
            if (!result.cvData) {
                chrome.storage.local.set({
                    cvData: null,
                    settings: {
                        autoDetect: true,
                        confirmBeforeFill: true,
                        debugMode: false
                    }
                });
            }
        });
    }
}

// Initialize background script
new CVAutofillBackground();
```

### Step 3.3: Popup Interface

Create `browser-extension/popup/popup.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {
            width: 350px;
            min-height: 400px;
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px;
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        .content {
            padding: 16px;
        }
        
        .upload-area {
            border: 2px dashed #ddd;
            border-radius: 8px;
            padding: 24px;
            text-align: center;
            margin-bottom: 16px;
            transition: border-color 0.3s ease;
        }
        
        .upload-area.dragover {
            border-color: #667eea;
            background-color: #f8f9ff;
        }
        
        .upload-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .upload-btn:hover {
            background: #5a6fd8;
        }
        
        .cv-status {
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
        }
        
        .cv-status.loaded {
            background: #e8f5e8;
            border: 1px solid #4caf50;
            color: #2e7d2e;
        }
        
        .cv-status.error {
            background: #ffeaea;
            border: 1px solid #f44336;
            color: #c62828;
        }
        
        .form-controls {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .btn {
            padding: 12px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background: #5a6fd8;
        }
        
        .btn-secondary {
            background: #f5f5f5;
            color: #666;
            border: 1px solid #ddd;
        }
        
        .btn-secondary:hover {
            background: #ebebeb;
        }
        
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .cv-preview {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 16px;
            max-height: 150px;
            overflow-y: auto;
        }
        
        .cv-preview h4 {
            margin: 0 0 8px 0;
            color: #333;
            font-size: 14px;
        }
        
        .cv-preview p {
            margin: 4px 0;
            font-size: 12px;
            color: #666;
        }
        
        .error-message {
            color: #c62828;
            font-size: 12px;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>CV Autofill Assistant</h1>
    </div>
    
    <div class="content">
        <!-- CV Upload Section -->
        <div id="upload-section">
            <div class="upload-area" id="upload-area">
                <p>📄 Upload your CV (PDF, DOCX, or TXT)</p>
                <button class="upload-btn" id="upload-btn">Choose File</button>
                <input type="file" id="file-input" accept=".pdf,.docx,.doc,.txt" style="display: none;">
                <p style="font-size: 12px; color: #666; margin-top: 8px;">
                    Or drag and drop your file here
                </p>
            </div>
        </div>
        
        <!-- CV Status -->
        <div id="cv-status" class="cv-status" style="display: none;"></div>
        
        <!-- CV Preview -->
        <div id="cv-preview" class="cv-preview" style="display: none;"></div>
        
        <!-- Form Controls -->
        <div class="form-controls">
            <button id="detect-forms-btn" class="btn btn-primary" disabled>
                🔍 Detect Forms on Page
            </button>
            <button id="auto-fill-btn" class="btn btn-primary" disabled>
                ✨ Auto-Fill Forms
            </button>
            <button id="clear-data-btn" class="btn btn-secondary">
                🗑️ Clear CV Data
            </button>
        </div>
        
        <!-- Loading indicator -->
        <div id="loading" style="display: none; text-align: center; margin-top: 16px;">
            <div class="loading"></div>
            <span>Processing your CV...</span>
        </div>
        
        <!-- Error messages -->
        <div id="error-message" class="error-message" style="display: none;"></div>
    </div>
    
    <script src="popup.js"></script>
</body>
</html>
```

Create `browser-extension/popup/popup.js`:

```javascript
class CVAutofillPopup {
    constructor() {
        this.cvData = null;
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadCVData();
        this.checkPageForForms();
    }
    
    bindEvents() {
        // File upload events
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        
        document.getElementById('file-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.uploadCV(e.target.files[0]);
            }
        });
        
        // Drag and drop events
        const uploadArea = document.getElementById('upload-area');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                this.uploadCV(e.dataTransfer.files[0]);
            }
        });
        
        // Button events
        document.getElementById('detect-forms-btn').addEventListener('click', () => {
            this.detectForms();
        });
        
        document.getElementById('auto-fill-btn').addEventListener('click', () => {
            this.autoFill();
        });
        
        document.getElementById('clear-data-btn').addEventListener('click', () => {
            this.clearData();
        });
    }
    
    async loadCVData() {
        try {
            const response = await this.sendMessage({ action: 'getCVData' });
            if (response.success && response.data) {
                this.cvData = response.data;
                this.showCVLoaded();
            }
        } catch (error) {
            console.error('Error loading CV data:', error);
        }
    }
    
    async uploadCV(file) {
        this.showLoading(true);
        this.hideError();
        
        try {
            const response = await this.sendMessage({ 
                action: 'parseCV', 
                file: file 
            });
            
            if (response.success) {
                this.cvData = response.data;
                this.showCVLoaded();
                this.showSuccess('CV uploaded and parsed successfully!');
            } else {
                this.showError('Failed to parse CV: ' + response.error);
            }
        } catch (error) {
            this.showError('Error uploading CV: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    async detectForms() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            await chrome.tabs.sendMessage(tab.id, {
                action: 'detectForms'
            });
            
            this.showSuccess('Form detection completed!');
        } catch (error) {
            this.showError('Error detecting forms: ' + error.message);
        }
    }
    
    async autoFill() {
        if (!this.cvData) {
            this.showError('Please upload your CV first');
            return;
        }
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            await chrome.tabs.sendMessage(tab.id, {
                action: 'autoFill',
                cvData: this.cvData
            });
            
            this.showSuccess('Auto-fill completed!');
        } catch (error) {
            this.showError('Error auto-filling forms: ' + error.message);
        }
    }
    
    async clearData() {
        try {
            await this.sendMessage({ action: 'saveCVData', data: null });
            this.cvData = null;
            this.showCVNotLoaded();
            this.showSuccess('CV data cleared successfully!');
        } catch (error) {
            this.showError('Error clearing data: ' + error.message);
        }
    }
    
    showCVLoaded() {
        const statusElement = document.getElementById('cv-status');
        statusElement.className = 'cv-status loaded';
        statusElement.innerHTML = '✅ CV loaded and ready to use';
        statusElement.style.display = 'block';
        
        // Show CV preview
        this.showCVPreview();
        
        // Enable form buttons
        document.getElementById('detect-forms-btn').disabled = false;
        document.getElementById('auto-fill-btn').disabled = false;
    }
    
    showCVNotLoaded() {
        const statusElement = document.getElementById('cv-status');
        statusElement.style.display = 'none';
        
        document.getElementById('cv-preview').style.display = 'none';
        document.getElementById('detect-forms-btn').disabled = true;
        document.getElementById('auto-fill-btn').disabled = true;
    }
    
    showCVPreview() {
        if (!this.cvData) return;
        
        const previewElement = document.getElementById('cv-preview');
        const personalInfo = this.cvData.personal_info;
        
        previewElement.innerHTML = `
            <h4>${personalInfo.full_name || 'Name not found'}</h4>
            <p>📧 ${personalInfo.email || 'Email not found'}</p>
            <p>📞 ${personalInfo.phone || 'Phone not found'}</p>
            <p>📍 ${personalInfo.city || 'City not found'}, ${personalInfo.country || 'Country not found'}</p>
            <p>💼 ${this.cvData.experience?.length || 0} work experiences</p>
            <p>🎓 ${this.cvData.education?.length || 0} education entries</p>
            <p>🛠️ ${this.cvData.skills?.length || 0} skill categories</p>
        `;
        
        previewElement.style.display = 'block';
    }
    
    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }
    
    showError(message) {
        const errorElement = document.getElementById('error-message');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
    
    showSuccess(message) {
        // You could implement a success notification here
        console.log('Success:', message);
    }
    
    hideError() {
        document.getElementById('error-message').style.display = 'none';
    }
    
    async checkPageForForms() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Check if current page has forms
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'checkForForms'
            });
            
            if (response && response.formsFound) {
                // Update UI to indicate forms were found
                console.log('Forms found on current page');
            }
        } catch (error) {
            // Content script might not be loaded yet, ignore error
            console.log('Could not check for forms:', error.message);
        }
    }
    
    sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CVAutofillPopup();
});
```

### Step 3.4: Content Script

Create `browser-extension/content/content.js`:

```javascript
class CVAutofillContent {
    constructor() {
        this.detectedForms = [];
        this.fieldMappings = this.initializeFieldMappings();
        this.init();
    }
    
    init() {
        // Listen for messages from popup and background
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
        
        // Auto-detect forms on page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.detectForms();
            });
        } else {
            this.detectForms();
        }
    }
    
    handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'checkForForms':
                const formsFound = this.detectForms();
                sendResponse({ formsFound: formsFound.length > 0 });
                break;
                
            case 'detectForms':
                const detectedForms = this.detectForms();
                this.highlightForms();
                sendResponse({ formsCount: detectedForms.length });
                break;
                
            case 'autoFill':
                this.autoFillForms(request.cvData);
                sendResponse({ success: true });
                break;
                
            case 'performFill':
                this.fillSpecificForm(request.formData);
                sendResponse({ success: true });
                break;
        }
    }
    
    detectForms() {
        this.detectedForms = [];
        
        // Find all forms on the page
        const forms = document.querySelectorAll('form');
        
        forms.forEach((form, index) => {
            const formData = {
                element: form,
                index: index,
                fields: this.analyzeFormFields(form)
            };
            
            // Only include forms with relevant fields
            if (formData.fields.length > 0) {
                this.detectedForms.push(formData);
            }
        });
        
        // Also check for forms without <form> tags (common in modern web apps)
        this.detectFormlessInputs();
        
        console.log(`Detected ${this.detectedForms.length} relevant forms`);
        return this.detectedForms;
    }
    
    analyzeFormFields(form) {
        const fields = [];
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            const fieldInfo = this.analyzeField(input);
            if (fieldInfo) {
                fields.push(fieldInfo);
            }
        });
        
        return fields;
    }
    
    analyzeField(element) {
        // Skip hidden, disabled, and readonly fields
        if (element.type === 'hidden' || 
            element.disabled || 
            element.readOnly ||
            element.type === 'submit' ||
            element.type === 'button') {
            return null;
        }
        
        const fieldInfo = {
            element: element,
            type: element.type || 'text',
            name: element.name || '',
            id: element.id || '',
            placeholder: element.placeholder || '',
            label: this.findFieldLabel(element),
            className: element.className || '',
            required: element.required || false
        };
        
        // Classify the field based on various attributes
        fieldInfo.classification = this.classifyField(fieldInfo);
        
        return fieldInfo.classification ? fieldInfo : null;
    }
    
    findFieldLabel(element) {
        // Try to find associated label
        let label = '';
        
        // Method 1: label[for] attribute
        if (element.id) {
            const labelElement = document.querySelector(`label[for="${element.id}"]`);
            if (labelElement) {
                label = labelElement.textContent.trim();
            }
        }
        
        // Method 2: parent label
        if (!label) {
            const parentLabel = element.closest('label');
            if (parentLabel) {
                label = parentLabel.textContent.trim();
            }
        }
        
        // Method 3: nearby text
        if (!label) {
            const parent = element.parentElement;
            if (parent) {
                // Look for text in parent or siblings
                const textNodes = this.getTextNodes(parent);
                if (textNodes.length > 0) {
                    label = textNodes.join(' ').trim();
                }
            }
        }
        
        return label;
    }
    
    getTextNodes(element) {
        const textNodes = [];
        
        for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent.trim();
                if (text) textNodes.push(text);
            }
        }
        
        return textNodes;
    }
    
    classifyField(fieldInfo) {
        const text = `${fieldInfo.name} ${fieldInfo.id} ${fieldInfo.placeholder} ${fieldInfo.label} ${fieldInfo.className}`.toLowerCase();
        
        // Classification patterns
        const patterns = {
            'first_name': /first.?name|fname|given.?name/,
            'last_name': /last.?name|lname|surname|family.?name/,
            'full_name': /full.?name|name(?!.*email)(?!.*user)/,
            'email': /email|e.?mail/,
            'phone': /phone|tel|mobile|cell/,
            'address': /address|addr(?!ess)/,
            'city': /city|town/,
            'state': /state|province|region/,
            'zip': /zip|postal|post.?code/,
            'country': /country|nation/,
            'company': /company|organization|employer/,
            'position': /position|title|job.?title|role/,
            'website': /website|url|site/,
            'linkedin': /linkedin|linked.in/,
            'github': /github|git.hub/,
            'experience': /experience|exp|years/,
            'education': /education|degree|school|university|college/,
            'skills': /skills|skill|competenc/,
            'cover_letter': /cover.?letter|motivation|why/,
            'salary': /salary|compensation|pay|wage/,
            'date': /date|when|time/
        };
        
        for (const [classification, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) {
                return classification;
            }
        }
        
        return null;
    }
    
    detectFormlessInputs() {
        // Look for input fields outside of forms
        const formlessInputs = document.querySelectorAll('input:not(form input), textarea:not(form textarea), select:not(form select)');
        
        if (formlessInputs.length > 0) {
            const fields = [];
            
            formlessInputs.forEach(input => {
                const fieldInfo = this.analyzeField(input);
                if (fieldInfo) {
                    fields.push(fieldInfo);
                }
            });
            
            if (fields.length > 0) {
                this.detectedForms.push({
                    element: document.body,
                    index: this.detectedForms.length,
                    fields: fields,
                    isFormless: true
                });
            }
        }
    }
    
    highlightForms() {
        // Remove previous highlights
        this.removeHighlights();
        
        // Highlight detected forms
        this.detectedForms.forEach((formData, index) => {
            formData.fields.forEach(field => {
                field.element.style.outline = '2px solid #667eea';
                field.element.style.outlineOffset = '2px';
                field.element.setAttribute('data-cv-autofill', 'detected');
                
                // Add tooltip with classification
                if (field.classification) {
                    field.element.title = `CV Autofill: ${field.classification}`;
                }
            });
        });
        
        // Auto-remove highlights after 5 seconds
        setTimeout(() => {
            this.removeHighlights();
        }, 5000);
    }
    
    removeHighlights() {
        const highlightedElements = document.querySelectorAll('[data-cv-autofill="detected"]');
        highlightedElements.forEach(element => {
            element.style.outline = '';
            element.style.outlineOffset = '';
            element.removeAttribute('data-cv-autofill');
            element.removeAttribute('title');
        });
    }
    
    autoFillForms(cvData) {
        if (!cvData || this.detectedForms.length === 0) {
            console.log('No CV data or forms detected');
            return;
        }
        
        this.detectedForms.forEach(formData => {
            this.fillFormFields(formData.fields, cvData);
        });
        
        // Show success notification
        this.showNotification('Forms filled successfully!', 'success');
    }
    
    fillFormFields(fields, cvData) {
        fields.forEach(field => {
            const value = this.getValueForField(field.classification, cvData);
            if (value) {
                this.fillField(field.element, value);
            }
        });
    }
    
    getValueForField(classification, cvData) {
        const mappings = {
            'first_name': () => {
                const fullName = cvData.personal_info?.full_name || '';
                return fullName.split(' ')[0] || '';
            },
            'last_name': () => {
                const fullName = cvData.personal_info?.full_name || '';
                const parts = fullName.split(' ');
                return parts.length > 1 ? parts[parts.length - 1] : '';
            },
            'full_name': () => cvData.personal_info?.full_name || '',
            'email': () => cvData.personal_info?.email || '',
            'phone': () => cvData.personal_info?.phone || '',
            'address': () => cvData.personal_info?.address || '',
            'city': () => cvData.personal_info?.city || '',
            'country': () => cvData.personal_info?.country || '',
            'linkedin': () => cvData.personal_info?.linkedin || '',
            'github': () => cvData.personal_info?.github || '',
            'company': () => {
                const latestJob = cvData.experience?.[0];
                return latestJob?.company || '';
            },
            'position': () => {
                const latestJob = cvData.experience?.[0];
                return latestJob?.job_title || '';
            },
            'education': () => {
                const latestEducation = cvData.education?.[0];
                return latestEducation ? `${latestEducation.degree} - ${latestEducation.institution}` : '';
            },
            'skills': () => {
                const allSkills = cvData.skills?.flatMap(category => category.items) || [];
                return allSkills.join(', ');
            }
        };
        
        const mapper = mappings[classification];
        return mapper ? mapper() : null;
    }
    
    fillField(element, value) {
        // Handle different input types
        switch (element.type) {
            case 'email':
            case 'text':
            case 'tel':
            case 'url':
                element.value = value;
                break;
                
            case 'textarea':
                element.value = value;
                break;
                
            case 'select-one':
                // Try to find matching option
                const option = Array.from(element.options).find(opt => 
                    opt.text.toLowerCase().includes(value.toLowerCase()) ||
                    opt.value.toLowerCase().includes(value.toLowerCase())
                );
                if (option) {
                    element.value = option.value;
                }
                break;
        }
        
        // Trigger input events to notify the page of changes
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Visual feedback
        element.style.backgroundColor = '#e8f5e8';
        setTimeout(() => {
            element.style.backgroundColor = '';
        }, 1000);
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `cv-autofill-notification cv-autofill-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            backgroundColor: type === 'success' ? '#4caf50' : '#2196f3',
            color: 'white',
            borderRadius: '6px',
            zIndex: '10000',
            fontSize: '14px',
            fontFamily: 'system-ui, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        });
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    initializeFieldMappings() {
        // This can be expanded with more sophisticated mapping logic
        return {};
    }
}

// Initialize content script
new CVAutofillContent();
```

Create `browser-extension/content/content.css`:

```css
/* Content script styles */
.cv-autofill-notification {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

/* Highlighted form fields */
[data-cv-autofill="detected"] {
    transition: outline 0.3s ease !important;
}
```

## Phase 4: Form Detection & Mapping

### Step 4.1: Advanced Form Detection

Create `backend/app/services/form_detector.py`:

```python
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class FormField:
    """Represents a detected form field."""
    name: str
    field_type: str
    classification: Optional[str]
    confidence: float
    attributes: Dict[str, Any]

@dataclass
class FormMapping:
    """Represents mapping between CV data and form field."""
    field_name: str
    cv_path: str
    transform_function: Optional[str]
    confidence: float

class FormDetectorService:
    """Service for detecting and classifying form fields."""
    
    def __init__(self):
        self.classification_patterns = self._initialize_patterns()
        self.common_transforms = self._initialize_transforms()
    
    def _initialize_patterns(self) -> Dict[str, List[re.Pattern]]:
        """Initialize field classification patterns."""
        return {
            'personal_info.full_name': [
                re.compile(r'full.?name|name(?!.*email)(?!.*user)', re.I),
                re.compile(r'^name$', re.I),
                re.compile(r'applicant.?name', re.I)
            ],
            'personal_info.first_name': [
                re.compile(r'first.?name|fname|given.?name', re.I),
                re.compile(r'^firstname$', re.I)
            ],
            'personal_info.last_name': [
                re.compile(r'last.?name|lname|surname|family.?name', re.I),
                re.compile(r'^lastname$', re.I)
            ],
            'personal_info.email': [
                re.compile(r'email|e.?mail', re.I),
                re.compile(r'^email$', re.I)
            ],
            'personal_info.phone': [
                re.compile(r'phone|tel|mobile|cell|contact', re.I),
                re.compile(r'phone.?number', re.I)
            ],
            'personal_info.address': [
                re.compile(r'address|addr(?!ess)', re.I),
                re.compile(r'street|location', re.I)
            ],
            'personal_info.city': [
                re.compile(r'city|town', re.I),
                re.compile(r'^city$', re.I)
            ],
            'personal_info.country': [
                re.compile(r'country|nation', re.I),
                re.compile(r'^country$', re.I)
            ],
            'experience[0].company': [
                re.compile(r'company|organization|employer|workplace', re.I),
                re.compile(r'current.?company', re.I)
            ],
            'experience[0].job_title': [
                re.compile(r'position|title|job.?title|role|current.?role', re.I),
                re.compile(r'^title$', re.I)
            ],
            'education[0].institution': [
                re.compile(r'school|university|college|institution', re.I),
                re.compile(r'education.*institution', re.I)
            ],
            'education[0].degree': [
                re.compile(r'degree|qualification|education.*level', re.I),
                re.compile(r'^degree$', re.I)
            ],
            'skills_text': [
                re.compile(r'skills|skill|competenc|abilities', re.I),
                re.compile(r'technical.?skills', re.I)
            ],
            'cover_letter': [
                re.compile(r'cover.?letter|motivation|why.*interested', re.I),
                re.compile(r'message|additional.*info', re.I)
            ]
        }
    
    def _initialize_transforms(self) -> Dict[str, str]:
        """Initialize common data transformation functions."""
        return {
            'skills_text': 'join_skills',
            'experience_summary': 'format_experience',
            'education_summary': 'format_education'
        }
    
    def classify_fields(self, field_data: List[Dict[str, Any]]) -> List[FormMapping]:
        """Classify form fields and create mappings to CV data."""
        mappings = []
        
        for field in field_data:
            field_obj = FormField(
                name=field.get('name', ''),
                field_type=field.get('type', 'text'),
                classification=None,
                confidence=0.0,
                attributes=field
            )
            
            # Classify the field
            classification, confidence = self._classify_single_field(field_obj)
            
            if classification and confidence > 0.5:  # Minimum confidence threshold
                mapping = FormMapping(
                    field_name=field_obj.name,
                    cv_path=classification,
                    transform_function=self.common_transforms.get(classification),
                    confidence=confidence
                )
                mappings.append(mapping)
        
        return mappings
    
    def _classify_single_field(self, field: FormField) -> tuple[Optional[str], float]:
        """Classify a single form field."""
        # Combine all text attributes for classification
        text_attributes = [
            field.name,
            field.attributes.get('id', ''),
            field.attributes.get('placeholder', ''),
            field.attributes.get('label', ''),
            field.attributes.get('className', '')
        ]
        
        combined_text = ' '.join(filter(None, text_attributes))
        
        best_classification = None
        best_confidence = 0.0
        
        for classification, patterns in self.classification_patterns.items():
            confidence = self._calculate_pattern_confidence(combined_text, patterns)
            
            if confidence > best_confidence:
                best_confidence = confidence
                best_classification = classification
        
        return best_classification, best_confidence
    
    def _calculate_pattern_confidence(self, text: str, patterns: List[re.Pattern]) -> float:
        """Calculate confidence score for pattern matching."""
        if not text:
            return 0.0
        
        max_confidence = 0.0
        
        for pattern in patterns:
            match = pattern.search(text)
            if match:
                # Base confidence on pattern specificity and match quality
                confidence = 0.8  # Base confidence for any match
                
                # Boost confidence for exact matches
                if match.group(0).lower() == text.strip().lower():
                    confidence = 1.0
                # Boost confidence for word boundary matches
                elif re.search(r'\b' + re.escape(match.group(0)) + r'\b', text, re.I):
                    confidence = 0.9
                
                max_confidence = max(max_confidence, confidence)
        
        return max_confidence
    
    def generate_field_mappings(self, cv_data: Dict[str, Any], form_fields: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate mappings between CV data and form fields."""
        mappings = self.classify_fields(form_fields)
        
        result = {
            'mappings': [],
            'unmapped_fields': [],
            'confidence_scores': {}
        }
        
        mapped_field_names = set()
        
        for mapping in mappings:
            field_value = self._extract_cv_value(cv_data, mapping.cv_path, mapping.transform_function)
            
            if field_value:
                result['mappings'].append({
                    'field_name': mapping.field_name,
                    'cv_path': mapping.cv_path,
                    'value': field_value,
                    'confidence': mapping.confidence
                })
                
                result['confidence_scores'][mapping.field_name] = mapping.confidence
                mapped_field_names.add(mapping.field_name)
        
        # Track unmapped fields
        for field in form_fields:
            field_name = field.get('name', '')
            if field_name and field_name not in mapped_field_names:
                result['unmapped_fields'].append({
                    'name': field_name,
                    'type': field.get('type', 'text'),
                    'label': field.get('label', ''),
                    'placeholder': field.get('placeholder', '')
                })
        
        return result
    
    def _extract_cv_value(self, cv_data: Dict[str, Any], cv_path: str, transform_function: Optional[str] = None) -> Optional[str]:
        """Extract value from CV data using dot notation path."""
        try:
            # Handle array access in path (e.g., "experience[0].company")
            if '[' in cv_path:
                cv_path = re.sub(r'\[(\d+)\]', r'.\1', cv_path)
            
            # Split path and traverse CV data
            path_parts = cv_path.split('.')
            current_data = cv_data
            
            for part in path_parts:
                if part.isdigit():
                    # Array index
                    current_data = current_data[int(part)]
                else:
                    # Object key
                    current_data = current_data.get(part, {})
                
                if current_data is None:
                    return None
            
            # Apply transformation if specified
            if transform_function and isinstance(current_data, (list, dict)):
                return self._apply_transform(current_data, transform_function, cv_data)
            
            return str(current_data) if current_data else None
            
        except (KeyError, IndexError, TypeError):
            return None
    
    def _apply_transform(self, data: Any, transform_name: str, full_cv_data: Dict[str, Any]) -> str:
        """Apply transformation function to extract data."""
        transforms = {
            'join_skills': lambda d: ', '.join([
                ', '.join(category.get('items', []))
                for category in d if isinstance(category, dict)
            ]) if isinstance(d, list) else '',
            
            'format_experience': lambda d: f"{d.get('job_title', '')} at {d.get('company', '')}"
            if isinstance(d, dict) else '',
            
            'format_education': lambda d: f"{d.get('degree', '')} - {d.get('institution', '')}"
            if isinstance(d, dict) else ''
        }
        
        transform_func = transforms.get(transform_name)
        if transform_func:
            try:
                return transform_func(data)
            except Exception:
                return ''
        
        return str(data) if data else ''

# Test the form detector
if __name__ == "__main__":
    detector = FormDetectorService()
    
    # Sample form fields
    sample_fields = [
        {'name': 'full_name', 'type': 'text', 'label': 'Full Name', 'placeholder': ''},
        {'name': 'email', 'type': 'email', 'label': 'Email Address', 'placeholder': ''},
        {'name': 'phone', 'type': 'tel', 'label': 'Phone Number', 'placeholder': ''},
        {'name': 'company', 'type': 'text', 'label': 'Current Company', 'placeholder': ''},
        {'name': 'position', 'type': 'text', 'label': 'Job Title', 'placeholder': ''},
    ]
    
    # Sample CV data
    sample_cv_data = {
        'personal_info': {
            'full_name': 'John Doe',
            'email': 'john.doe@email.com',
            'phone': '+1234567890',
        },
        'experience': [
            {
                'job_title': 'Senior Developer',
                'company': 'Tech Corp',
                'start_date': '2020-01-01',
                'end_date': 'Present'
            }
        ],
        'skills': [
            {
                'category': 'Programming',
                'items': ['Python', 'JavaScript', 'React']
            }
        ]
    }
    
    mappings = detector.generate_field_mappings(sample_cv_data, sample_fields)
    
    print("Generated mappings:")
    for mapping in mappings['mappings']:
        print(f"  {mapping['field_name']} -> {mapping['cv_path']}: {mapping['value']}")
    
    print(f"\nUnmapped fields: {len(mappings['unmapped_fields'])}")
    for field in mappings['unmapped_fields']:
        print(f"  {field['name']} ({field['type']})")
```

### Step 4.2: Enhanced Backend API

Update `backend/app/main.py` to include form mapping endpoint:

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile
import os
from pathlib import Path
from typing import List, Dict, Any

from app.services.llm_service import LLMService, CVData
from app.services.pdf_parser import DocumentParser
from app.services.form_detector import FormDetectorService

app = FastAPI(title="CV Autofill API", version="1.0.0")

# CORS middleware for browser extension
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
form_detector = FormDetectorService()

class FormFieldData(BaseModel):
    name: str
    type: str
    label: str = ""
    placeholder: str = ""
    id: str = ""
    className: str = ""
    required: bool = False

class FormMappingRequest(BaseModel):
    cv_data: Dict[str, Any]
    form_fields: List[FormFieldData]

@app.post("/api/parse-cv", response_model=CVData)
async def parse_cv(file: UploadFile = File(...)):
    """Parse uploaded CV file and return structured data."""
    
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in document_parser.supported_formats:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Supported: {document_parser.supported_formats}"
        )
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
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
            # Clean up temporary file
            os.unlink(tmp_file.name)

@app.post("/api/generate-mappings")
async def generate_form_mappings(request: FormMappingRequest):
    """Generate mappings between CV data and form fields."""
    try:
        form_fields_dict = [field.dict() for field in request.form_fields]
        mappings = form_detector.generate_field_mappings(request.cv_data, form_fields_dict)
        
        return {
            "success": True,
            "mappings": mappings["mappings"],
            "unmapped_fields": mappings["unmapped_fields"],
            "confidence_scores": mappings["confidence_scores"],
            "total_fields": len(request.form_fields),
            "mapped_fields": len(mappings["mappings"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating mappings: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Test LLM connection
        test_response = llm_service._call_ollama("Test connection")
        return {"status": "healthy", "llm_connected": True}
    except Exception:
        return {"status": "unhealthy", "llm_connected": False}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Phase 5: Integration & Testing

### Step 5.1: Integration Testing

Create `backend/tests/test_integration.py`:

```python
import pytest
import asyncio
import tempfile
import json
from pathlib import Path
from httpx import AsyncClient

from app.main import app

@pytest.mark.asyncio
class TestIntegration:
    """Integration tests for the CV Autofill system."""
    
    @pytest.fixture
    async def client(self):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac
    
    async def test_health_endpoint(self, client):
        """Test the health check endpoint."""
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
    
    async def test_cv_parsing_flow(self, client):
        """Test the complete CV parsing flow."""
        # Create a sample CV file
        sample_cv_text = """
        John Doe
        Software Engineer
        john.doe@email.com
        +1234567890
        
        Experience:
        Senior Developer at Tech Corp (2020-Present)
        - Led development of web applications
        - Managed team of 5 developers
        
        Education:
        BS Computer Science, MIT, 2018
        
        Skills: Python, JavaScript, React
        """
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(sample_cv_text)
            temp_path = f.name
        
        try:
            # Test CV parsing
            with open(temp_path, 'rb') as f:
                response = await client.post(
                    "/api/parse-cv",
                    files={"file": ("test_cv.txt", f, "text/plain")}
                )
            
            assert response.status_code == 200
            cv_data = response.json()
            
            # Verify parsed data structure
            assert "personal_info" in cv_data
            assert "experience" in cv_data
            assert "education" in cv_data
            assert "skills" in cv_data
            
            # Test form mapping generation
            sample_form_fields = [
                {
                    "name": "full_name",
                    "type": "text",
                    "label": "Full Name",
                    "placeholder": "",
                    "id": "name",
                    "className": "",
                    "required": True
                },
                {
                    "name": "email",
                    "type": "email", 
                    "label": "Email Address",
                    "placeholder": "Enter your email",
                    "id": "email",
                    "className": "",
                    "required": True
                }
            ]
            
            mapping_request = {
                "cv_data": cv_data,
                "form_fields": sample_form_fields
            }
            
            response = await client.post("/api/generate-mappings", json=mapping_request)
            assert response.status_code == 200
            
            mapping_data = response.json()
            assert mapping_data["success"] == True
            assert "mappings" in mapping_data
            assert len(mapping_data["mappings"]) > 0
            
        finally:
            # Clean up
            Path(temp_path).unlink(missing_ok=True)

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

### Step 5.2: Browser Extension Testing

Create `browser-extension/test/test-extension.js`:

```javascript
// Test script for browser extension functionality

class ExtensionTester {
    constructor() {
        this.testResults = [];
    }
    
    async runTests() {
        console.log('🧪 Starting CV Autofill Extension Tests...');
        
        await this.testFormDetection();
        await this.testFieldClassification();
        await this.testAutoFill();
        
        this.reportResults();
    }
    
    async testFormDetection() {
        console.log('Testing form detection...');
        
        try {
            // Create test form
            const testForm = this.createTestForm();
            document.body.appendChild(testForm);
            
            // Test detection
            const contentScript = new CVAutofillContent();
            const detectedForms = contentScript.detectForms();
            
            this.assert(
                detectedForms.length > 0, 
                'Should detect at least one form'
            );
            
            this.assert(
                detectedForms[0].fields.length > 0,
                'Should detect form fields'
            );
            
            // Clean up
            document.body.removeChild(testForm);
            
            this.testResults.push({
                test: 'Form Detection',
                status: 'PASSED',
                message: `Detected ${detectedForms.length} forms with ${detectedForms[0].fields.length} fields`
            });
            
        } catch (error) {
            this.testResults.push({
                test: 'Form Detection',
                status: 'FAILED',
                message: error.message
            });
        }
    }
    
    async testFieldClassification() {
        console.log('Testing field classification...');
        
        try {
            const contentScript = new CVAutofillContent();
            
            // Test various field types
            const testFields = [
                { name: 'first_name', label: 'First Name' },
                { name: 'email', label: 'Email Address' },
                { name: 'phone', label: 'Phone Number' },
                { name: 'company', label: 'Current Company' }
            ];
            
            let correctClassifications = 0;
            
            testFields.forEach(field => {
                const fieldInfo = {
                    name: field.name,
                    label: field.label,
                    placeholder: '',
                    className: '',
                    id: field.name
                };
                
                const classification = contentScript.classifyField(fieldInfo);
                
                if (classification && classification.includes(field.name)) {
                    correctClassifications++;
                }
            });
            
            const accuracy = correctClassifications / testFields.length;
            
            this.assert(
                accuracy >= 0.75,
                `Field classification accuracy should be >= 75% (got ${Math.round(accuracy * 100)}%)`
            );
            
            this.testResults.push({
                test: 'Field Classification',
                status: 'PASSED',
                message: `Classification accuracy: ${Math.round(accuracy * 100)}%`
            });
            
        } catch (error) {
            this.testResults.push({
                test: 'Field Classification',
                status: 'FAILED',
                message: error.message
            });
        }
    }
    
    async testAutoFill() {
        console.log('Testing auto-fill functionality...');
        
        try {
            // Sample CV data
            const sampleCVData = {
                personal_info: {
                    full_name: 'Jane Smith',
                    email: 'jane.smith@email.com',
                    phone: '+1555123456'
                },
                experience: [
                    {
                        job_title: 'Senior Developer',
                        company: 'Tech Solutions Inc'
                    }
                ]
            };
            
            // Create test form
            const testForm = this.createTestForm();
            document.body.appendChild(testForm);
            
            // Test auto-fill
            const contentScript = new CVAutofillContent();
            contentScript.autoFillForms(sampleCVData);
            
            // Verify filled values
            const nameField = document.getElementById('test_name');
            const emailField = document.getElementById('test_email');
            
            this.assert(
                nameField.value === sampleCVData.personal_info.full_name,
                `Name field should be filled correctly (expected: ${sampleCVData.personal_info.full_name}, got: ${nameField.value})`
            );
            
            this.assert(
                emailField.value === sampleCVData.personal_info.email,
                `Email field should be filled correctly`
            );
            
            // Clean up
            document.body.removeChild(testForm);
            
            this.testResults.push({
                test: 'Auto Fill',
                status: 'PASSED',
                message: 'Successfully filled form fields with CV data'
            });
            
        } catch (error) {
            this.testResults.push({
                test: 'Auto Fill',
                status: 'FAILED',
                message: error.message
            });
        }
    }
    
    createTestForm() {
        const form = document.createElement('form');
        form.id = 'test_form';
        
        form.innerHTML = `
            <label for="test_name">Full Name:</label>
            <input type="text" id="test_name" name="full_name" />
            
            <label for="test_email">Email:</label>
            <input type="email" id="test_email" name="email" />
            
            <label for="test_phone">Phone:</label>
            <input type="tel" id="test_phone" name="phone" />
            
            <label for="test_company">Company:</label>
            <input type="text" id="test_company" name="company" />
        `;
        
        return form;
    }
    
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    
    reportResults() {
        console.log('\n📊 Test Results:');
        console.log('================');
        
        let passed = 0;
        let failed = 0;
        
        this.testResults.forEach(result => {
            const status = result.status === 'PASSED' ? '✅' : '❌';
            console.log(`${status} ${result.test}: ${result.message}`);
            
            if (result.status === 'PASSED') {
                passed++;
            } else {
                failed++;
            }
        });
        
        console.log('\n📈 Summary:');
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Total: ${passed + failed}`);
        
        if (failed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️ Some tests failed. Please check the results above.');
        }
    }
}

// Run tests when page loads
document.addEventListener('DOMContentLoaded', () => {
    const tester = new ExtensionTester();
    tester.runTests();
});
```

### Step 5.3: Load Extension for Testing

Create installation script `install-extension.sh`:

```bash
#!/bin/bash

# CV Autofill Extension Installation Script

echo "🚀 Installing CV Autofill Extension..."

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo "❌ Error: manifest.json not found. Make sure you're in the browser-extension directory."
    exit 1
fi

# Create icons directory if it doesn't exist
if [ ! -d "assets" ]; then
    mkdir assets
    echo "📁 Created assets directory"
fi

# Generate simple icons if they don't exist
if [ ! -f "assets/icon16.png" ]; then
    echo "🎨 Generating extension icons..."
    
    # You can replace this with actual icon generation or provide your own icons
    # For now, we'll just create placeholder files
    touch assets/icon16.png
    touch assets/icon48.png  
    touch assets/icon128.png
    
    echo "ℹ️  Placeholder icons created. Replace with actual icons for production."
fi

echo "✅ Extension files prepared!"
echo ""
echo "📋 Manual Installation Steps:"
echo "1. Open Chrome/Edge and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select this directory: $(pwd)"
echo "5. The extension should now be loaded and ready to use!"
echo ""
echo "🔧 For Firefox:"
echo "1. Go to about:debugging"
echo "2. Click 'This Firefox'"
echo "3. Click 'Load Temporary Add-on'"
echo "4. Select manifest.json from this directory"
echo ""
echo "⚠️  Remember to start the backend server first:"
echo "   cd ../backend && python start_server.py"
```

Make it executable:
```bash
chmod +x install-extension.sh
```

## Phase 6: Advanced Features

### Step 6.1: Configuration Management

Create `backend/app/models/config.py`:

```python
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from enum import Enum

class FieldType(str, Enum):
    TEXT = "text"
    EMAIL = "email"
    PHONE = "tel"
    URL = "url"
    TEXTAREA = "textarea"
    SELECT = "select"
    DATE = "date"

class ConfidenceLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class FieldMapping(BaseModel):
    field_name: str
    cv_path: str
    transform_function: Optional[str] = None
    confidence: float
    field_type: FieldType
    is_required: bool = False

class UserPreferences(BaseModel):
    auto_fill_enabled: bool = True
    confirmation_required: bool = True
    min_confidence_threshold: float = 0.7
    preferred_language: str = "en"
    custom_field_mappings: Dict[str, str] = {}
    excluded_sites: List[str] = []
    debug_mode: bool = False

class SiteConfiguration(BaseModel):
    domain: str
    custom_selectors: Dict[str, str] = {}
    field_overrides: Dict[str, FieldMapping] = {}
    is_enabled: bool = True
    notes: str = ""

class AppConfiguration(BaseModel):
    user_preferences: UserPreferences
    site_configurations: List[SiteConfiguration] = []
    field_mappings: List[FieldMapping] = []
    version: str = "1.0.0"
```

Create `backend/app/services/config_service.py`:

```python
import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional
from app.models.config import AppConfiguration, UserPreferences, SiteConfiguration

class ConfigurationService:
    """Service for managing user preferences and site configurations."""
    
    def __init__(self, db_path: str = "cv_autofill.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database for configuration storage."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create tables
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY,
                preferences_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS site_configurations (
                id INTEGER PRIMARY KEY,
                domain TEXT UNIQUE NOT NULL,
                config_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS field_mappings (
                id INTEGER PRIMARY KEY,
                domain TEXT,
                field_name TEXT,
                cv_path TEXT,
                confidence REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def get_user_preferences(self) -> UserPreferences:
        """Get current user preferences."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT preferences_json FROM user_preferences ORDER BY id DESC LIMIT 1')
        result = cursor.fetchone()
        conn.close()
        
        if result:
            preferences_data = json.loads(result[0])
            return UserPreferences(**preferences_data)
        else:
            # Return default preferences
            return UserPreferences()
    
    def save_user_preferences(self, preferences: UserPreferences):
        """Save user preferences to database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        preferences_json = preferences.json()
        
        cursor.execute('''
            INSERT INTO user_preferences (preferences_json)
            VALUES (?)
        ''', (preferences_json,))
        
        conn.commit()
        conn.close()
    
    def get_site_configuration(self, domain: str) -> Optional[SiteConfiguration]:
        """Get configuration for a specific site."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT config_json FROM site_configurations WHERE domain = ?', (domain,))
        result = cursor.fetchone()
        conn.close()
        
        if result:
            config_data = json.loads(result[0])
            return SiteConfiguration(**config_data)
        
        return None
    
    def save_site_configuration(self, config: SiteConfiguration):
        """Save or update site configuration."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        config_json = config.json()
        
        cursor.execute('''
            INSERT OR REPLACE INTO site_configurations (domain, config_json)
            VALUES (?, ?)
        ''', (config.domain, config_json))
        
        conn.commit()
        conn.close()
    
    def learn_field_mapping(self, domain: str, field_name: str, cv_path: str, confidence: float):
        """Learn and store a field mapping from user interaction."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO field_mappings (domain, field_name, cv_path, confidence)
            VALUES (?, ?, ?, ?)
        ''', (domain, field_name, cv_path, confidence))
        
        conn.commit()
        conn.close()
    
    def get_learned_mappings(self, domain: str) -> List[Dict[str, any]]:
        """Get learned field mappings for a domain."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT field_name, cv_path, AVG(confidence) as avg_confidence, COUNT(*) as usage_count
            FROM field_mappings 
            WHERE domain = ? 
            GROUP BY field_name, cv_path
            HAVING avg_confidence > 0.5
            ORDER BY usage_count DESC, avg_confidence DESC
        ''', (domain,))
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'field_name': row[0],
                'cv_path': row[1],
                'confidence': row[2],
                'usage_count': row[3]
            }
            for row in results
        ]
```

### Step 6.2: Smart Learning System

Create `backend/app/services/learning_service.py`:

```python
from typing import Dict, List, Any, Tuple
import numpy as np
from collections import defaultdict
from app.services.config_service import ConfigurationService

class LearningService:
    """Service for learning from user interactions to improve field detection."""
    
    def __init__(self, config_service: ConfigurationService):
        self.config_service = config_service
        self.feedback_data = defaultdict(list)
    
    def record_user_correction(self, domain: str, field_info: Dict[str, Any], 
                             suggested_mapping: str, user_mapping: str, confidence: float):
        """Record when user corrects an auto-fill suggestion."""
        feedback = {
            'domain': domain,
            'field_name': field_info.get('name', ''),
            'field_type': field_info.get('type', ''),
            'field_label': field_info.get('label', ''),
            'field_placeholder': field_info.get('placeholder', ''),
            'suggested_mapping': suggested_mapping,
            'correct_mapping': user_mapping,
            'original_confidence': confidence
        }
        
        self.feedback_data[domain].append(feedback)
        
        # Store in database for persistence
        self.config_service.learn_field_mapping(
            domain, field_info.get('name', ''), user_mapping, 1.0  # High confidence for user corrections
        )
    
    def record_successful_fill(self, domain: str, field_name: str, mapping: str, confidence: float):
        """Record when auto-fill is successful (user doesn't correct it)."""
        self.config_service.learn_field_mapping(domain, field_name, mapping, confidence)
    
    def improve_field_classification(self, domain: str, field_info: Dict[str, Any]) -> Tuple[str, float]:
        """Use learned data to improve field classification."""
        learned_mappings = self.config_service.get_learned_mappings(domain)
        
        field_name = field_info.get('name', '').lower()
        field_label = field_info.get('label', '').lower()
        field_placeholder = field_info.get('placeholder', '').lower()
        
        # Check for exact matches first
        for mapping in learned_mappings:
            if mapping['field_name'].lower() == field_name:
                return mapping['cv_path'], min(mapping['confidence'] * 1.2, 1.0)  # Boost confidence
        
        # Check for partial matches in labels/placeholders
        best_match = None
        best_score = 0.0
        
        for mapping in learned_mappings:
            score = self._calculate_similarity_score(field_info, mapping)
            if score > best_score and score > 0.3:  # Minimum similarity threshold
                best_score = score
                best_match = mapping
        
        if best_match:
            adjusted_confidence = best_match['confidence'] * best_score
            return best_match['cv_path'], adjusted_confidence
        
        return None, 0.0
    
    def _calculate_similarity_score(self, field_info: Dict[str, Any], learned_mapping: Dict[str, Any]) -> float:
        """Calculate similarity score between field and learned mapping."""
        field_text = f"{field_info.get('name', '')} {field_info.get('label', '')} {field_info.get('placeholder', '')}".lower()
        mapping_field = learned_mapping['field_name'].lower()
        
        # Simple word overlap scoring
        field_words = set(field_text.split())
        mapping_words = set(mapping_field.split())
        
        if not field_words or not mapping_words:
            return 0.0
        
        intersection = field_words.intersection(mapping_words)
        union = field_words.union(mapping_words)
        
        # Jaccard similarity
        jaccard_score = len(intersection) / len(union) if union else 0.0
        
        # Boost score for exact substring matches
        if mapping_field in field_text or any(word in field_text for word in mapping_words):
            jaccard_score *= 1.5
        
        return min(jaccard_score, 1.0)
    
    def get_domain_statistics(self, domain: str) -> Dict[str, Any]:
        """Get learning statistics for a domain."""
        learned_mappings = self.config_service.get_learned_mappings(domain)
        
        return {
            'total_learned_mappings': len(learned_mappings),
            'most_common_fields': [
                {'field': mapping['field_name'], 'usage_count': mapping['usage_count']}
                for mapping in learned_mappings[:10]  # Top 10
            ],
            'average_confidence': np.mean([m['confidence'] for m in learned_mappings]) if learned_mappings else 0.0,
            'domain': domain
        }
    
    def export_learned_data(self, domain: str = None) -> Dict[str, Any]:
        """Export learned field mappings for backup or transfer."""
        if domain:
            mappings = self.config_service.get_learned_mappings(domain)
            return {'domain': domain, 'mappings': mappings}
        else:
            # Export all domains (you'd need to modify config_service for this)
            return {'message': 'Full export not implemented yet'}
    
    def import_learned_data(self, data: Dict[str, Any]):
        """Import learned field mappings from backup."""
        domain = data.get('domain')
        mappings = data.get('mappings', [])
        
        for mapping in mappings:
            self.config_service.learn_field_mapping(
                domain,
                mapping['field_name'],
                mapping['cv_path'],
                mapping['confidence']
            )
```

### Step 6.3: Advanced Form Detection

Create `browser-extension/content/advanced-detector.js`:

```javascript
class AdvancedFormDetector {
    constructor() {
        this.siteSpecificHandlers = {
            'linkedin.com': this.handleLinkedIn.bind(this),
            'indeed.com': this.handleIndeed.bind(this),
            'glassdoor.com': this.handleGlassdoor.bind(this),
            'workday.com': this.handleWorkday.bind(this)
        };
        
        this.commonPatterns = {
            nameFields: [
                'input[name*="name"]:not([name*="username"]):not([name*="company"])',
                'input[placeholder*="name"]:not([placeholder*="username"]):not([placeholder*="company"])',
                'input[id*="name"]:not([id*="username"]):not([id*="company"])'
            ],
            emailFields: [
                'input[type="email"]',
                'input[name*="email"]',
                'input[placeholder*="email"]'
            ],
            phoneFields: [
                'input[type="tel"]',
                'input[name*="phone"]',
                'input[name*="mobile"]',
                'input[placeholder*="phone"]'
            ]
        };
    }
    
    detectAdvancedForms() {
        const currentDomain = window.location.hostname;
        const handler = this.siteSpecificHandlers[currentDomain];
        
        if (handler) {
            return handler();
        }
        
        return this.detectGenericForms();
    }
    
    detectGenericForms() {
        const forms = [];
        
        // Method 1: Traditional form detection
        document.querySelectorAll('form').forEach(form => {
            const fields = this.analyzeFormFields(form);
            if (fields.length > 0) {
                forms.push({
                    element: form,
                    fields: fields,
                    type: 'traditional'
                });
            }
        });
        
        // Method 2: Modern SPA detection (React/Vue/Angular forms)
        const modernForm = this.detectModernForms();
        if (modernForm) {
            forms.push(modernForm);
        }
        
        // Method 3: Shadow DOM detection
        const shadowForms = this.detectShadowDOMForms();
        forms.push(...shadowForms);
        
        return forms;
    }
    
    detectModernForms() {
        // Look for common patterns in modern web apps
        const potentialContainers = [
            '[class*="form"]',
            '[class*="application"]',
            '[class*="registration"]',
            '[class*="signup"]',
            '[class*="profile"]',
            '[data-testid*="form"]'
        ];
        
        for (const selector of potentialContainers) {
            const containers = document.querySelectorAll(selector);
            
            for (const container of containers) {
                const inputs = container.querySelectorAll('input, textarea, select');
                if (inputs.length >= 3) { // Minimum threshold for a meaningful form
                    const fields = Array.from(inputs)
                        .map(input => this.analyzeField(input))
                        .filter(field => field !== null);
                    
                    if (fields.length > 0) {
                        return {
                            element: container,
                            fields: fields,
                            type: 'modern'
                        };
                    }
                }
            }
        }
        
        return null;
    }
    
    detectShadowDOMForms() {
        const forms = [];
        
        // Look for elements with shadow roots
        const elementsWithShadow = document.querySelectorAll('*');
        
        elementsWithShadow.forEach(element => {
            if (element.shadowRoot) {
                const shadowForms = element.shadowRoot.querySelectorAll('form');
                shadowForms.forEach(form => {
                    const fields = this.analyzeFormFields(form);
                    if (fields.length > 0) {
                        forms.push({
                            element: form,
                            fields: fields,
                            type: 'shadow',
                            shadowHost: element
                        });
                    }
                });
            }
        });
        
        return forms;
    }
    
    handleLinkedIn() {
        // LinkedIn-specific form detection
        const forms = [];
        
        // Profile edit forms
        const profileForm = document.querySelector('[data-test-modal="profile-edit-modal"]');
        if (profileForm) {
            forms.push({
                element: profileForm,
                fields: this.analyzeLinkedInProfileForm(profileForm),
                type: 'linkedin-profile'
            });
        }
        
        // Job application forms
        const jobApplications = document.querySelectorAll('[data-test-modal*="job-apply"]');
        jobApplications.forEach(form => {
            forms.push({
                element: form,
                fields: this.analyzeLinkedInJobForm(form),
                type: 'linkedin-job-application'
            });
        });
        
        return forms;
    }
    
    handleIndeed() {
        // Indeed-specific form detection
        const forms = [];
        
        // Job application forms
        const applicationForm = document.querySelector('#indeed-apply-form, .indeed-apply-form');
        if (applicationForm) {
            forms.push({
                element: applicationForm,
                fields: this.analyzeIndeedForm(applicationForm),
                type: 'indeed-application'
            });
        }
        
        return forms;
    }
    
    handleGlassdoor() {
        // Glassdoor-specific detection
        return this.detectGenericForms();
    }
    
    handleWorkday() {
        // Workday-specific detection (many companies use Workday)
        const forms = [];
        
        // Workday forms often have specific data attributes
        const workdayForms = document.querySelectorAll('[data-automation-id*="form"]');
        workdayForms.forEach(form => {
            const fields = this.analyzeWorkdayForm(form);
            if (fields.length > 0) {
                forms.push({
                    element: form,
                    fields: fields,
                    type: 'workday'
                });
            }
        });
        
        return forms;
    }
    
    analyzeLinkedInProfileForm(form) {
        // LinkedIn uses specific data attributes
        const fields = [];
        const inputs = form.querySelectorAll('input, textarea');
        
        inputs.forEach(input => {
            const automationId = input.getAttribute('data-automation-id') || '';
            const name = input.name || automationId;
            
            if (name) {
                fields.push({
                    element: input,
                    name: name,
                    type: input.type || 'text',
                    classification: this.classifyLinkedInField(name),
                    label: this.findLinkedInFieldLabel(input)
                });
            }
        });
        
        return fields;
    }
    
    analyzeIndeedForm(form) {
        return this.analyzeFormFields(form);
    }
    
    analyzeWorkdayForm(form) {
        const fields = [];
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            const automationId = input.getAttribute('data-automation-id') || '';
            const field = this.analyzeField(input);
            
            if (field) {
                // Enhance with Workday-specific classification
                field.classification = this.classifyWorkdayField(automationId) || field.classification;
                fields.push(field);
            }
        });
        
        return fields;
    }
    
    classifyLinkedInField(fieldName) {
        const mappings = {
            'firstName': 'personal_info.first_name',
            'lastName': 'personal_info.last_name',
            'emailAddress': 'personal_info.email',
            'phoneNumber': 'personal_info.phone',
            'summary': 'summary'
        };
        
        return mappings[fieldName] || null;
    }
    
    classifyWorkdayField(automationId) {
        if (automationId.includes('firstName')) return 'personal_info.first_name';
        if (automationId.includes('lastName')) return 'personal_info.last_name';
        if (automationId.includes('email')) return 'personal_info.email';
        if (automationId.includes('phone')) return 'personal_info.phone';
        
        return null;
    }
    
    findLinkedInFieldLabel(input) {
        // LinkedIn often uses adjacent labels or aria-label
        const ariaLabel = input.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;
        
        const label = input.closest('[data-test-form-element]')?.querySelector('label');
        return label?.textContent?.trim() || '';
    }
    
    analyzeFormFields(form) {
        const fields = [];
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            const field = this.analyzeField(input);
            if (field) {
                fields.push(field);
            }
        });
        
        return fields;
    }
    
    analyzeField(element) {
        // Skip hidden, disabled, and readonly fields
        if (element.type === 'hidden' || 
            element.disabled || 
            element.readOnly ||
            element.type === 'submit' ||
            element.type === 'button') {
            return null;
        }
        
        return {
            element: element,
            type: element.type || 'text',
            name: element.name || '',
            id: element.id || '',
            placeholder: element.placeholder || '',
            label: this.findFieldLabel(element),
            className: element.className || '',
            required: element.required || false,
            classification: null // Will be set by classifier
        };
    }
    
    findFieldLabel(element) {
        // Try multiple methods to find the field label
        let label = '';
        
        // Method 1: aria-label
        if (element.getAttribute('aria-label')) {
            label = element.getAttribute('aria-label');
        }
        
        // Method 2: associated label element
        else if (element.id) {
            const labelElement = document.querySelector(`label[for="${element.id}"]`);
            if (labelElement) {
                label = labelElement.textContent.trim();
            }
        }
        
        // Method 3: parent label
        if (!label) {
            const parentLabel = element.closest('label');
            if (parentLabel) {
                label = parentLabel.textContent.trim();
            }
        }
        
        // Method 4: nearby text (previous sibling, parent text, etc.)
        if (!label) {
            label = this.findNearbyText(element);
        }
        
        return label;
    }
    
    findNearbyText(element) {
        // Look for text in various nearby locations
        const parent = element.parentElement;
        if (!parent) return '';
        
        // Check previous siblings
        let sibling = element.previousElementSibling;
        while (sibling && !sibling.textContent.trim()) {
            sibling = sibling.previousElementSibling;
        }
        
        if (sibling && sibling.textContent.trim()) {
            return sibling.textContent.trim();
        }
        
        // Check parent's text content (excluding the input itself)
        const parentText = parent.textContent.replace(element.value || '', '').trim();
        if (parentText) {
            return parentText.split('\n')[0].trim(); // Take first line
        }
        
        return '';
    }
}
```

## Deployment & Maintenance

### Step 7.1: Production Deployment

Create `backend/deploy.py`:

```python
import subprocess
import sys
import os
from pathlib import Path

def deploy_production():
    """Deploy CV Autofill service for production use."""
    
    print("🚀 Deploying CV Autofill Service...")
    
    # Check system requirements
    check_system_requirements()
    
    # Install system dependencies
    install_system_dependencies()
    
    # Setup Python environment
    setup_python_environment()
    
    # Configure Ollama service
    setup_ollama_service()
    
    # Setup systemd service for API
    setup_systemd_service()
    
    print("✅ Deployment completed successfully!")
    print("🔧 Post-deployment steps:")
    print("1. Upload your CV through the browser extension")
    print("2. Test on a few job application sites")
    print("3. Check logs: journalctl -u cv-autofill.service -f")

def check_system_requirements():
    """Check if system meets requirements."""
    print("📋 Checking system requirements...")
    
    # Check Python version
    python_version = sys.version_info
    if python_version < (3, 8):
        raise RuntimeError("Python 3.8+ required")
    
    # Check available memory
    with open('/proc/meminfo') as f:
        meminfo = f.read()
    
    mem_total = int([line for line in meminfo.split('\n') if 'MemTotal' in line][0].split()[1])
    mem_gb = mem_total / (1024 * 1024)
    
    if mem_gb < 8:
        print("⚠️  Warning: Less than 8GB RAM detected. Performance may be limited.")
    
    print("✅ System requirements check passed")

def install_system_dependencies():
    """Install required system packages."""
    print("📦 Installing system dependencies...")
    
    # Update package list
    subprocess.run(['sudo', 'apt', 'update'], check=True)
    
    # Install dependencies
    packages = [
        'python3-pip',
        'python3-venv',
        'poppler-utils',
        'tesseract-ocr',
        'tesseract-ocr-eng',
        'sqlite3',
        'nginx'
    ]
    
    subprocess.run(['sudo', 'apt', 'install', '-y'] + packages, check=True)
    print("✅ System dependencies installed")

def setup_python_environment():
    """Setup Python virtual environment and dependencies."""
    print("🐍 Setting up Python environment...")
    
    # Create virtual environment
    if not Path('venv').exists():
        subprocess.run([sys.executable, '-m', 'venv', 'venv'], check=True)
    
    # Install Python dependencies
    pip_path = Path('venv/bin/pip')
    subprocess.run([str(pip_path), 'install', '--upgrade', 'pip'], check=True)
    subprocess.run([str(pip_path), 'install', '-r', 'requirements.txt'], check=True)
    
    print("✅ Python environment setup completed")

def setup_ollama_service():
    """Setup Ollama as a system service."""
    print("🤖 Setting up Ollama service...")
    
    # Install Ollama if not present
    if not subprocess.run(['which', 'ollama'], capture_output=True).returncode == 0:
        print("Installing Ollama...")
        subprocess.run(['curl', '-fsSL', 'https://ollama.ai/install.sh'], stdout=subprocess.PIPE, check=True)
        install_script = subprocess.run(['curl', '-fsSL', 'https://ollama.ai/install.sh'], 
                                      capture_output=True, text=True, check=True)
        subprocess.run(['sh'], input=install_script.stdout, text=True, check=True)
    
    # Create systemd service file
    ollama_service = """[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=127.0.0.1:11434"

[Install]
WantedBy=default.target
"""
    
    with open('/tmp/ollama.service', 'w') as f:
        f.write(ollama_service)
    
    subprocess.run(['sudo', 'mv', '/tmp/ollama.service', '/etc/systemd/system/'], check=True)
    subprocess.run(['sudo', 'systemctl', 'daemon-reload'], check=True)
    subprocess.run(['sudo', 'systemctl', 'enable', 'ollama.service'], check=True)
    subprocess.run(['sudo', 'systemctl', 'start', 'ollama.service'], check=True)
    
    # Pull required model
    print("📥 Downloading Llama 3.1 8B model (this may take a while)...")
    subprocess.run(['ollama', 'pull', 'llama3.1:8b'], check=True)
    
    print("✅ Ollama service setup completed")

def setup_systemd_service():
    """Setup CV Autofill API as systemd service."""
    print("⚙️  Setting up CV Autofill API service...")
    
    current_dir = Path.cwd().absolute()
    python_path = current_dir / 'venv' / 'bin' / 'python'
    
    service_file_content = f"""[Unit]
Description=CV Autofill API Service
After=network.target ollama.service
Requires=ollama.service

[Service]
Type=simple
User={os.getenv('USER')}
WorkingDirectory={current_dir}
Environment=PATH={current_dir}/venv/bin
ExecStart={python_path} -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
"""
    
    with open('/tmp/cv-autofill.service', 'w') as f:
        f.write(service_file_content)
    
    subprocess.run(['sudo', 'mv', '/tmp/cv-autofill.service', '/etc/systemd/system/'], check=True)
    subprocess.run(['sudo', 'systemctl', 'daemon-reload'], check=True)
    subprocess.run(['sudo', 'systemctl', 'enable', 'cv-autofill.service'], check=True)
    subprocess.run(['sudo', 'systemctl', 'start', 'cv-autofill.service'], check=True)
    
    print("✅ CV Autofill API service setup completed")

if __name__ == "__main__":
    if os.geteuid() == 0:
        print("❌ Don't run this script as root!")
        sys.exit(1)
    
    deploy_production()
```

### Step 7.2: Monitoring and Logging

Create `backend/app/core/logging_config.py`:

```python
import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler

def setup_logging(log_level: str = "INFO", log_file: str = "cv_autofill.log"):
    """Setup application logging configuration."""
    
    # Create logs directory
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Configure logging format
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Setup file handler with rotation
    file_handler = RotatingFileHandler(
        log_dir / log_file,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    file_handler.setFormatter(formatter)
    
    # Setup console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    # Configure specific loggers
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    return root_logger

class PerformanceMonitor:
    """Monitor API performance and usage."""
    
    def __init__(self):
        self.logger = logging.getLogger("performance")
        self.metrics = {
            'cv_parsing_times': [],
            'form_mapping_times': [],
            'total_requests': 0,
            'successful_parsings': 0,
            'failed_parsings': 0
        }
    
    def record_cv_parsing(self, duration: float, success: bool):
        """Record CV parsing performance."""
        self.metrics['total_requests'] += 1
        
        if success:
            self.metrics['cv_parsing_times'].append(duration)
            self.metrics['successful_parsings'] += 1
            self.logger.info(f"CV parsing completed in {duration:.2f}s")
        else:
            self.metrics['failed_parsings'] += 1
            self.logger.warning(f"CV parsing failed after {duration:.2f}s")
    
    def record_form_mapping(self, duration: float, fields_count: int, mapped_count: int):
        """Record form mapping performance."""
        self.metrics['form_mapping_times'].append(duration)
        mapping_rate = mapped_count / fields_count if fields_count > 0 else 0
        
        self.logger.info(
            f"Form mapping completed in {duration:.2f}s - "
            f"Mapped {mapped_count}/{fields_count} fields ({mapping_rate:.1%})"
        )
    
    def get_statistics(self) -> dict:
        """Get current performance statistics."""
        cv_times = self.metrics['cv_parsing_times']
        mapping_times = self.metrics['form_mapping_times']
        
        return {
            'total_requests': self.metrics['total_requests'],
            'success_rate': (
                self.metrics['successful_parsings'] / self.metrics['total_requests']
                if self.metrics['total_requests'] > 0 else 0
            ),
            'avg_cv_parsing_time': sum(cv_times) / len(cv_times) if cv_times else 0,
            'avg_mapping_time': sum(mapping_times) / len(mapping_times) if mapping_times else 0,
            'total_cv_parsings': len(cv_times),
            'total_mappings': len(mapping_times)
        }
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. **LLM Connection Issues**

**Problem**: API returns "LLM not connected" or timeouts
**Solutions**:
```bash
# Check if Ollama is running
systemctl status ollama.service

# Restart Ollama service
sudo systemctl restart ollama.service

# Check if model is available
ollama list

# Re-download model if needed
ollama pull llama3.1:8b
```

#### 2. **CV Parsing Errors**

**Problem**: CV parsing fails or returns empty data
**Solutions**:
- Ensure CV is in supported format (PDF, DOCX, TXT)
- Check file is not password-protected
- Verify text extraction works:
```python
from app.services.pdf_parser import DocumentParser
parser = DocumentParser()
text = parser.extract_text("path/to/cv.pdf")
print(text[:500])  # Should show extracted text
```

#### 3. **Browser Extension Not Working**

**Problem**: Extension doesn't detect forms or auto-fill fails
**Solutions**:
- Check browser console for errors (F12)
- Verify backend API is accessible:
```bash
curl http://localhost:8000/api/health
```
- Reload extension in browser extensions page
- Check if content script is injecting properly

#### 4. **Form Detection Issues**

**Problem**: Extension doesn't detect forms on specific sites
**Solutions**:
- Check if site uses Shadow DOM or modern frameworks
- Add site-specific handlers in `advanced-detector.js`
- Use browser dev tools to inspect form structure
- Adjust detection patterns for the specific site

#### 5. **Performance Issues**

**Problem**: Slow response times or high memory usage
**Solutions**:
- Monitor GPU/CPU usage during inference
- Consider using smaller model (7B instead of 8B)
- Implement request caching
- Add request rate limiting

### Debug Mode

Enable debug mode for detailed logging:

```javascript
// In browser extension popup
chrome.storage.local.set({
    settings: {
        debugMode: true,
        autoDetect: true,
        confirmBeforeFill: true
    }
});
```

```python
# In backend
import logging
logging.getLogger().setLevel(logging.DEBUG)
```

## Resources & References

### Documentation Links
- [Ollama Documentation](https://ollama.ai/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Chrome Extension Developer Guide](https://developer.chrome.com/docs/extensions/)
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/)

### Model Information
- **Llama 3.1 8B**: Excellent for text understanding and structured output
- **Mistral 7B**: Faster alternative with good performance
- **CodeLlama 7B**: Better for technical content extraction

### Performance Optimization
- Use GPU acceleration when available
- Implement response caching for frequently used CV data
- Consider model quantization for lower memory usage
- Implement lazy loading for browser extension components

### Security Considerations
- All processing happens locally (privacy-preserving)
- No CV data sent to external services
- Use HTTPS for any external communications
- Validate all file inputs before processing
- Implement rate limiting to prevent abuse

### Future Enhancements
- Multi-language support
- Custom field mapping UI
- Bulk job application support
- Integration with job search APIs
- Mobile app version
- Cloud deployment option for teams

---

This comprehensive development plan provides everything needed to build a sophisticated CV autofill tool using local LLMs. The system is designed to be privacy-preserving, extensible, and production-ready while maintaining high performance and accuracy.

Remember to test thoroughly on various job sites and continuously improve the field detection algorithms based on user feedback and new site patterns.
