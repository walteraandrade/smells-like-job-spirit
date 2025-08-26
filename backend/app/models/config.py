from pydantic import BaseModel, Field
from typing import Optional
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
    custom_field_mappings: dict[str, str] = Field(default_factory=dict)
    excluded_sites: list[str] = Field(default_factory=list)
    debug_mode: bool = False


class SiteConfiguration(BaseModel):
    domain: str
    custom_selectors: dict[str, str] = Field(default_factory=dict)
    field_overrides: dict[str, FieldMapping] = Field(default_factory=dict)
    is_enabled: bool = True
    notes: str = ""


class AppConfiguration(BaseModel):
    user_preferences: UserPreferences
    site_configurations: list[SiteConfiguration] = Field(default_factory=list)
    field_mappings: list[FieldMapping] = Field(default_factory=list)
    version: str = "1.0.0"
