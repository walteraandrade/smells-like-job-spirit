import requests
import json
import logging
from typing import Any, Optional, Tuple
from pydantic import BaseModel
from collections import defaultdict, deque


class CVData(BaseModel):
    personal_info: dict[str, Any]
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
        url = f"{self.base_url}/api/generate"
        data = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "top_p": 0.9, "num_predict": 2048},
        }

        response = requests.post(url, json=data, timeout=120)
        response.raise_for_status()
        return response.json()["response"]

    def _extract_json_from_response(self, response: str) -> dict[str, Any]:
        start_idx = response.find("{")
        end_idx = response.rfind("}") + 1

        if start_idx == -1 or end_idx == 0:
            raise ValueError("No JSON found in response")

        json_str = response[start_idx:end_idx]
        return json.loads(json_str)


class ConfigService:
    def __init__(self):
        self.feedback_store = {}

    def get_feedback_data(self) -> dict[str, list[dict[str, Any]]]:
        return self.feedback_store

    def save_feedback_data(
        self, domain: str, feedback_list: list[dict[str, Any]]
    ) -> None:
        self.feedback_store[domain] = feedback_list


class InMemoryConfigService:
    def __init__(self):
        self.feedback_store = {}

    def get_feedback_data(self) -> dict[str, list[dict[str, Any]]]:
        """
        Retrieve feedback data stored in memory.

        Returns:
            A dictionary of feedback data grouped by domain.
        """
        return self.feedback_store

    def save_feedback_data(
        self, domain: str, feedback_list: list[dict[str, Any]]
    ) -> None:
        """
        Save feedback data for a specific domain in memory.

        Args:
            domain: The domain to associate with the feedback data.
            feedback_list: A list of feedback data to store.
        """
        self.feedback_store[domain] = feedback_list

    def get_user_preferences(self) -> None:
        raise NotImplementedError(
            "get_user_preferences is not implemented in InMemoryConfigService."
        )

    def save_user_preferences(self, preferences: Any) -> None:
        raise NotImplementedError(
            "save_user_preferences is not implemented in InMemoryConfigService."
        )

    def get_site_configuration(self, domain: str) -> None:
        raise NotImplementedError(
            "get_site_configuration is not implemented in InMemoryConfigService."
        )

    def save_site_configuration(self, config: Any) -> None:
        raise NotImplementedError(
            "save_site_configuration is not implemented in InMemoryConfigService."
        )

    def learn_field_mapping(
        self, domain: str, field_name: str, cv_path: str, confidence: float
    ) -> None:
        raise NotImplementedError(
            "learn_field_mapping is not implemented in InMemoryConfigService."
        )

    def get_learned_mappings(self, domain: str) -> None:
        raise NotImplementedError(
            "get_learned_mappings is not implemented in InMemoryConfigService."
        )


class Learning:
    def __init__(self, config_service, max_feedback_size: int = 100):
        """
        Initialize the Learning service.

        Args:
            config_service: The configuration service for persisting feedback.
            max_feedback_size: Maximum number of feedback entries per domain.
        """
        self.config_service = config_service
        self.max_feedback_size = max_feedback_size
        self.feedback_data = self._load_feedback_data()

    def _load_feedback_data(self) -> dict[str, deque]:
        """
        Load existing feedback data from the configuration or initialize empty deques.

        Returns:
            A dictionary with domain-specific deques for feedback storage.
        """
        persisted_feedback = self.config_service.get_feedback_data()
        feedback_data = defaultdict(lambda: deque(maxlen=self.max_feedback_size))

        for domain, feedback_list in persisted_feedback.items():
            feedback_data[domain].extend(feedback_list)

        return feedback_data

    def save_feedback_data(self, domain: str, feedback: dict[str, Any]) -> None:
        """
        Save feedback data for a specific domain.

        Args:
            domain: The domain to associate with the feedback data.
            feedback: The feedback data to store.
        """
        if domain not in self.feedback_data:
            self.feedback_data[domain] = deque(maxlen=self.max_feedback_size)

        self.feedback_data[domain].append(feedback)
        self._persist_feedback(domain)

    def _persist_feedback(self, domain: str) -> None:
        """
        Persist feedback data for a specific domain to the configuration.

        Args:
            domain: The domain whose feedback data should be persisted.
        """
        try:
            feedback_list = list(self.feedback_data[domain])
            self.config_service.save_feedback_data(domain, feedback_list)
        except Exception as e:
            logging.error(f"Failed to persist feedback for domain '{domain}': {e}")

    def get_feedback_data(self, domain: str) -> list[dict[str, Any]]:
        """
        Retrieve feedback data for a specific domain.

        Args:
            domain: The domain whose feedback data should be retrieved.

        Returns:
            A list of feedback data for the domain.
        """
        return list(self.feedback_data.get(domain, []))

    def import_learned_data(self, data: dict[str, Any]) -> None:
        """
        Import learned data into the configuration service.

        Args:
            data: A dictionary containing the learned data, including a top-level domain
                  and a list of mappings.

        Raises:
            ValueError: If neither a top-level domain nor a per-mapping domain is available.
        """
        top_level_domain = data.get("domain", "").strip().lower()
        mappings = data.get("mappings", [])

        if not top_level_domain and not any(
            "domain" in mapping for mapping in mappings
        ):
            raise ValueError("No valid domain found in the top-level data or mappings.")

        validated_mappings = []

        for mapping in mappings:
            domain = mapping.get("domain", top_level_domain).strip().lower()

            if not domain:
                logging.warning("Skipping mapping due to missing domain: %s", mapping)
                continue

            if not all(
                key in mapping and isinstance(mapping[key], (str, float))
                for key in ["field_name", "cv_path", "confidence"]
            ):
                logging.warning(
                    "Skipping mapping due to missing or invalid keys: %s", mapping
                )
                continue

            confidence = mapping["confidence"]
            if not isinstance(confidence, (int, float)) or not (
                0.0 <= confidence <= 1.0
            ):
                logging.warning(
                    "Skipping mapping due to invalid confidence value: %s", mapping
                )
                continue

            validated_mappings.append(
                {
                    "domain": domain,
                    "field_name": mapping["field_name"].strip(),
                    "cv_path": mapping["cv_path"].strip(),
                    "confidence": float(confidence),
                }
            )

        for mapping in validated_mappings:
            self.config_service.learn_field_mappings(
                mapping["domain"],
                mapping["field_name"],
                mapping["cv_path"],
                mapping["confidence"],
            )

        logging.info("Imported %d validated mappings.", len(validated_mappings))

    def improve_field_classification(
        self, domain: str, field_info: dict[str, Any]
    ) -> Tuple[Optional[str], float]:
        """
        Improve field classification based on learned mappings.

        Args:
            domain: The domain for which the classification is being improved.
            field_info: Information about the field to classify.

        Returns:
            A tuple containing the CV path and confidence score.
        """
        learned_mappings = self.config_service.get_learned_mappings(domain)

        field_name = field_info.get("name", "").lower()

        for mapping in learned_mappings:
            if mapping["field_name"].lower() == field_name:
                return mapping["cv_path"], min(mapping["confidence"] * 1.2, 1.0)

        best_match = None
        best_score = 0.0

        for mapping in learned_mappings:
            score = self._calculate_similarity_score(field_info, mapping)
            if score > best_score and score > 0.3:
                best_score = score
                best_match = mapping

        if best_match:
            adjusted_confidence = best_match["confidence"] * best_score
            return best_match["cv_path"], adjusted_confidence

        return None, 0.0

    def _calculate_similarity_score(
        self, field_info: dict[str, Any], mapping: dict[str, Any]
    ) -> float:
        """
        Calculate a similarity score between a field and a mapping.

        Args:
            field_info: Information about the field.
            mapping: A learned mapping.

        Returns:
            A similarity score between 0.0 and 1.0.
        """
        return 0.0


if __name__ == "__main__":
    llm_service = LLMService()
    sample_cv = """
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
