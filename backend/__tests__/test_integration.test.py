import pytest
import asyncio
import tempfile
import json
from pathlib import Path
from httpx import AsyncClient

from app.main import app

@pytest.mark.asyncio
class TestIntegration:

    @pytest.fixture
    async def client(self):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

    async def test_health_endpoint(self, client):
        response = await  client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    async def test_cv_parsing_flow(self, client):
        sample_cv_text = """
        João Macabro
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

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(sample_cv_text)
            temp_path = f.name

        try: 
            with open(temp_path, 'rb') as f:
                response = await client.post("/api/parse-cv", files={"file": ("test_cv.txt", f, "text/plain")})

            assert response.status_code == 200
            cv_data = response.json()

            assert "personal_info" in cv_data
            assert "experience" in cv_data
            assert "education" in cv_data
            assert "skills" in cv_data

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
            Path(temp_path).unlink(missing_ok=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
