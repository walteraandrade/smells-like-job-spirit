import pytest
import asyncio
import tempfile
from pathlib import Path
from httpx import AsyncClient

from app.main import app
from app.services.llm_service import CVData

@pytest.mark.asyncio
class TestIntegration:

    @pytest.fixture
    async def client(self, monkeypatch):
        def fake_parse_cv(_cv_text: str) -> CVData:
            return CVData(
                personal_info={
                    "full_name": "John Doe",
                    "email": "john.doe@email.com",
                    "phone": "+1234567890",
                    "address": "123 Main St",
                    "city": "Springfield",
                    "country": "USA",
                    "linkedin": "",
                    "github": "",
                },
                education=[
                    {
                        "degree": "BS",
                        "institution": "MIT",
                        "graduation_year": "2018",
                        "gpa": "",
                        "field_of_study": "CS",
                    }
                ],
                experience=[
                    {
                        "job_title": "Senior Developer",
                        "company": "Tech Corp",
                        "start_date": "2020-01-01",
                        "end_date": "Present",
                        "location": "",
                        "description": "",
                        "achievements": [],
                    }
                ],
                skills=[
                    {"category": "Programming", "items": ["Python", "JavaScript", "React"]}
                ],
                certifications=[],
                languages=[],
            )

        monkeypatch.setattr("app.services.llm_service.parse_cv", fake_parse_cv, raising=True)

        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

    async def test_health_endpoint(self, client):
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    async def test_cv_parsing_flow(self, client):
        sample_form_fields = [
            {
                "name": "full_name",
                "type": "text",
                "label": "Full Name",
                "placeholder": "",
                "id": "name",
                "className": "",
                "required": True,
            },
            {
                "name": "email",
                "type": "email",
                "label": "Email Address",
                "placeholder": "Enter your email",
                "id": "email",
                "className": "",
                "required": True,
            },
        ]

        mapping_request = {
            "cv_data": {
                "personal_info": {
                    "full_name": "John Doe",
                    "email": "john.doe@email.com",
                    "phone": "+1234567890",
                },
                "experience": [
                    {
                        "job_title": "Senior Developer",
                        "company": "Tech Corp",
                        "start_date": "2020-01-01",
                        "end_date": "Present",
                    }
                ],
                "education": [
                    {
                        "degree": "BS",
                        "institution": "MIT",
                        "graduation_year": "2018",
                    }
                ],
                "skills": [
                    {"category": "Programming", "items": ["Python", "JavaScript", "React"]}
                ],
            },
            "form_fields": sample_form_fields,
        }

        response = await client.post("/api/generate-mappings", json=mapping_request)
        assert response.status_code == 200

        mapping_data = response.json()
        assert mapping_data["success"] is True
        assert "mappings" in mapping_data
        assert len(mapping_data["mappings"]) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
