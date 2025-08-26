from typing import Dict, Optional, Any, Tuple

from collections import defaultdict
from app.services.config_service import Configuration
from statistics import fmean


class Learning:
    def __init__(self, config_service: Configuration) -> None:
        self.config_service = config_service
        self.feedback_data = defaultdict(list)

    def record_user_correction(
        self,
        domain: str,
        field_info: Dict[str, Any],
        suggested_mapping: str,
        user_mapping: str,
        confidence: float,
    ) -> None:
        feedback = {
            "domain": domain,
            "field_name": field_info.get("name", ""),
            "field_type": field_info.get("type", ""),
            "field_label": field_info.get("label", ""),
            "field_placeholder": field_info.get("placeholder", ""),
            "suggested_mapping": suggested_mapping,
            "correct_mapping": user_mapping,
            "original_confidence": confidence,
        }

        self.feedback_data[domain].append(feedback)
        self.config_service.learn_field_mapping(
            domain, field_info.get("name", ""), user_mapping, 1.0
        )

    def record_successfull_fill(
        self, domain: str, field_name: str, mapping: str, confidence: float
    ) -> None:
        self.config_service.learn_field_mapping(domain, field_name, mapping, confidence)

    def improve_field_classification(
        self, domain: str, field_info: Dict[str, Any]
    ) -> Tuple[Optional[str], float]:
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
        self, field_info: Dict[str, Any], learned_mapping: Dict[str, Any]
    ) -> float:
        field_text = f"{field_info.get('name', '')} {field_info.get('label', '')} {field_info.get('placeholder', '')}".lower()
        mapping_field = learned_mapping["field_name"].lower()

        field_words = set(field_text.split())
        mapping_words = set(mapping_field.split())

        if not field_words or not mapping_words:
            return 0.0

        intersection = field_words & mapping_words
        union = field_words | mapping_words
        jaccard_score = len(intersection) / len(union) if union else 0.0

        if mapping_field in field_text or any(
            word in field_text for word in mapping_words
        ):
            jaccard_score *= 1.5

        return min(jaccard_score, 1.0)

    def get_domain_statistics(self, domain: str) -> Dict[str, Any]:
        learned_mappings = self.config_service.get_learned_mappings(domain)

        return {
            "total_learned_mappings": len(learned_mappings),
            "most_common_fields": [
                {
                    "field": mapping["field_name"],
                    "usage_count": mapping.get("usage_count", 0),  # Fixed key access
                }
                for mapping in learned_mappings[:10]
            ],
            "average_confidence": (
                fmean([m["confidence"] for m in learned_mappings])
                if learned_mappings
                else 0.0
            ),
            "domain": domain,
        }

    def export_learned_data(self, domain: str = None) -> Dict[str, Any]:
        if domain:
            mappings = self.config_service.get_learned_mappings(domain)
            return {"domain": domain, "mappings": mappings}

        return {"message": "Full export not implemented yet"}

    def import_learned_data(self, data: Dict[str, Any]) -> None:
        domain = data.get("domain")
        mappings = data.get("mappings", [])

        for mapping in mappings:
            self.config_service.learn_field_mappings(
                domain, mapping["field_name"], mapping["cv_path"], mapping["confidence"]
            )
