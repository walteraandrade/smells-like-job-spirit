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
        You are a professional CV parses. Extract information from the following CV text and return it as valid JSON.

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
        """Extrat JSON from LLM response, handling potential formatting issues"""
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
    samle_cv = """
    João Macabro
    Software Engineer
    jones@macabro.com | +12348923
    Salvador, BA

    Experience:
    - Senior Developer at Tech Corp (2020-2023)
    - Junior Developer at StartUp Inc (2018-2020)

    Education:
    - BS Computer Science, MIT, 2018

    Skills: Python, JavaScript, React, Docker
    """

    result = llm_service.parse_cv(sample_cv)
    print(json.dumps(result.dict(), indent=2))
