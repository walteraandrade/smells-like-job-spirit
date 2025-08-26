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