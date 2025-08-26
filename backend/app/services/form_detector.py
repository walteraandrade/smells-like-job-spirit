import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class FormField:
    """Represents a detected form field"""
    name: str
    field_type: str
    classification: Optional[str]
    confidence: float
    attributes: Dict[str, Any]


@dataclass
class FormMapping:
    """Represents mapping between CV data and form field"""
    field_name: str
    cv_path: str
    transform_function: Optional[str]
    confidence: float


class FormDetector:

    def __init__(self):
        """
        Initialize a FormDetector instance.
        
        Sets up regex classification patterns, a mapping of classification keys to transform names, and registers transform functions used when extracting and formatting CV data for form fields.
        """
        self.classification_patterns = self._initialize_patterns()
        self.common_transforms = self._initialize_transforms()
        self.transforms = {
            'join_skills': self._join_skills,
            'format_experience': self._format_experience,
            'format_education': self._format_education
        }

    def _initialize_patterns(self) -> Dict[str, List[re.Pattern]]:
        """
        Return a mapping of CV classification keys to compiled regular-expression patterns used to identify form fields.
        
        Each dictionary key is a canonical CV path or classification (e.g., 'personal_info.full_name', 'experience[0].company', 'skills_text'). The associated value is a list of case-insensitive compiled `re.Pattern` objects that match likely form attribute text (field name, id, label, placeholder, class, etc.) for that classification. Patterns are intended for fuzzy matching of common field label variants and are used by the classifier to compute confidence scores for field-to-CV mappings.
        
        Returns:
            Dict[str, List[re.Pattern]]: Mapping from classification keys to lists of compiled regex patterns.
        """
        return {
                'personal_info.full_name': [
                    re.compile(r'full?.name|name(?!.*email)(?!.*user)', re.I),
                    re.compile(r'^name$', re.I),
                    re.compile(r'applicant.?name', re.I)
                    ],
                'personal_info.first_name': [
                    re.compile(r'first.?name|fname|given.?name', re.I),
                    re.compile(r'^firstname$', re.I),
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
                    re.compile(r'phone|cel|tel|mobile|cell|contact', re.I),
                    re.compile(r'phone.?number', re.I)
                    ],
                'personal_info.address': [
                    re.compile(r'address|addr(?!ess)', re.I),
                    re.compile(r'street|location', re.I)
                    ],
                'personal_info.country': [
                    re.compile(r'country|nation', re.I),
                    re.compile(r'^country$', re.I)
                    ],
                'experience[0].company': [
                    re.compile(r'current.?company', re.I),
                    re.compile(r'company|organization|employer|workplace', re.I)
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
            """
            Return a mapping from internal classification keys to transform function names.
            
            The detector uses these keys to look up and apply named transforms when extracted CV data
            needs formatting (for example, joining skills or formatting experience/education entries).
            
            Returns:
                Dict[str, str]: Mapping where keys are classification identifiers (e.g., 'skills_text',
                'experience_summary', 'education_summary') and values are the names of transform functions
                implemented on the detector (e.g., 'join_skills', 'format_experience', 'format_education').
            """
            return {
                        'skills_text': 'join_skills',
                        'experience_summary': 'format_experience',
                        'education_summary': 'format_education',
                            }

    def classify_fields(self, field_data: List[Dict[str, Any]]) -> List[FormMapping]:
        """
        Classify a list of detected form field attribute dictionaries and produce FormMapping entries for high-confidence matches.
        
        Takes a list of form field attribute dicts (each typically containing keys like 'name', 'type', 'label', 'placeholder', etc.), wraps each in a FormField, and uses internal pattern matching to determine the best CV path classification and confidence. For each field with a classification and confidence > 0.5, returns a FormMapping linking the field name to the matched CV path and any registered transform name.
        
        Parameters:
            field_data (List[Dict[str, Any]]): List of form field attribute dictionaries to classify.
        
        Returns:
            List[FormMapping]: Mappings for fields with a confident classification (confidence > 0.5). Each mapping contains the form field name, the matched CV path, an optional transform function name (from the detector's transform registry), and the confidence score.
        """
        mappings = []
        
        for field in field_data:
            field_obj = FormField(
                    name=field.get('name', ''),
                    field_type=field.get('type', 'text'),
                    classification=None,
                    confidence=0.0,
                    attributes=field
            )
                
            classification, confidence = self._classify_single_field(field_obj)
            if classification and confidence > 0.5:
                mapping = FormMapping(
                        field_name=field_obj.name,
                        cv_path=classification,
                        transform_function=self.common_transforms.get(classification),
                        confidence=confidence
                        )
                mappings.append(mapping)
        return mappings

    
    def _classify_single_field(self, field: FormField) -> tuple[Optional[str], float]:
        """
        Determine the best-matching classification key for a detected form field.
        
        Inspects the field's textual attributes (name, id, placeholder, label, className, class), combines them into a single search string, and scores that text against the detector's classification_patterns. Returns the classification key with the highest confidence and that confidence score (float between 0.0 and 1.0). If no pattern matches, returns (None, 0.0).
        """
        text_attributes = [
            field.name,
            field.attributes.get('id', ''),
            field.attributes.get('placeholder', ''),
            field.attributes.get('label', ''),
            field.attributes.get('className', ''),  # React prop
            field.attributes.get('class', '')  # HTML attribute
        ]

        combined_text = ' '.join(filter(None, text_attributes))

        best_classification = None
        best_confidence = 0

        for classification, patterns in self.classification_patterns.items():
            confidence = self._calculate_pattern_confidence(combined_text, patterns)
            if confidence > best_confidence:
                best_confidence = confidence
                best_classification = classification

        return best_classification, best_confidence

    def _calculate_pattern_confidence(self, text: str, patterns: List[re.Pattern]) -> float:
        """
        Calculate a confidence score indicating how well any of the given regex patterns match the provided text.
        
        Detailed behavior:
        - Returns 0.0 if `text` is empty or no pattern matches.
        - For each pattern that matches, a base confidence of 0.8 is assigned.
          - If the matched substring equals the full input `text` (case-insensitive, ignoring surrounding whitespace), confidence is 1.0.
          - Otherwise, if the matched substring appears as a whole word within `text` (case-insensitive), confidence is 0.9.
        - The method returns the highest confidence observed across all patterns.
        
        Parameters:
            text (str): The combined text attributes of a form field (e.g., name, id, label, placeholder).
            patterns (List[re.Pattern]): Compiled regular expression patterns used to identify a classification.
        
        Returns:
            float: A confidence score in [0.0, 1.0], where higher means a stronger match.
        """
        if not text:
            return 0.0

        max_confidence = 0.0

        for pattern in patterns:
            match = pattern.search(text)
            if match:
                confidence = 0.8
                if match.group(0).lower() == text.strip().lower():
                    confidence = 1.0
                elif re.search(r'\b' + re.escape(match.group(0)) + r'\b', text, re.I):
                    confidence = 0.9

                max_confidence = max(max_confidence, confidence)

        return max_confidence


    def generate_field_mapping(self, cv_data: Dict[str, Any], form_fields: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Build a mapping between detected form fields and values extracted from a CV.
        
        Given parsed CV data and a list of detected form field descriptors, classify form fields (via classify_fields), extract corresponding CV values (applying any configured transforms), and return a summary containing successful mappings, fields that remained unmapped, and per-field confidence scores.
        
        Parameters:
            cv_data (Dict[str, Any]): Nested CV data (dicts/lists) used as the source of values.
            form_fields (List[Dict[str, Any]]): List of form field descriptors (each may include keys like 'name', 'type', 'label', 'placeholder', etc.).
        
        Returns:
            Dict[str, Any]: A dictionary with three keys:
                - 'mappings': List of mapping dicts for fields where a CV value was found. Each mapping contains:
                    - 'field_name': name attribute of the form field
                    - 'cv_path': classification key/path used to extract the value from cv_data
                    - 'value': the extracted (and possibly transformed) string value
                    - 'confidence': classifier confidence for this mapping
                - 'unmapped_fields': List of form field descriptors (subset of input fields) that were not mapped; each entry includes 'name', 'type', 'label', and 'placeholder'.
                - 'confidence_scores': Dict mapping form field names to their classification confidence (float).
        """
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
        """
        Extract a value from nested CV data by a dot/bracket path and optionally apply a named transform.
        
        The `cv_path` may use dot notation and/or bracketed numeric indices (e.g. "experience[0].company" or "personal_info.name").
        The function traverses the nested dict/list structure in `cv_data` following the path. If `transform_function` is provided and the resolved value
        is a list or dict, the named transform is applied via self._apply_transform and its result is returned.
        
        Parameters:
            cv_data (Dict[str, Any]): Nested CV data (dictionaries and lists) to extract from.
            cv_path (str): Path to the desired value using dots and/or bracketed indices.
            transform_function (Optional[str]): Optional name of a transform to apply when the extracted value is a list or dict.
        
        Returns:
            Optional[str]: The extracted (and possibly transformed) value as a string, or None if the path cannot be resolved,
            the resolved value is empty/falsey, or an extraction error occurs.
        """
        try:
            if '[' in cv_path:
                cv_path = re.sub(r'\[(\d+)\]', r'.\1', cv_path)

            path_parts = cv_path.split('.')
            current_data = cv_data

            for part in path_parts:
                if part.isdigit():
                    current_data = current_data[int(part)]
                else:
                    current_data = current_data.get(part)
                if current_data is None:
                    return None

            if transform_function and isinstance(current_data, (list, dict)):
                return self._apply_transform(current_data, transform_function, cv_data)

            return str(current_data) if current_data else None

        except (KeyError, IndexError, TypeError):
            return None


    def _join_skills(self, data):
        """
        Join skills from a list of category objects into a single comma-separated string.
        
        Each category is expected to be a dict containing an 'items' key with a list of skill strings.
        Categories with empty or missing 'items' are ignored. If `data` is not a list or no skills
        are found, an empty string is returned.
        
        Parameters:
            data (list[dict]): List of categories, each typically like {"items": ["skill1", "skill2"]}.
        
        Returns:
            str: Comma-separated skills, with skills from each category grouped and categories separated by commas,
                 or an empty string if input is invalid or contains no skills.
        """
        if not isinstance(data, list):
            return ''
    
        skill_lists = []
        for category in data:
            if isinstance(category, dict):
                items = category.get('items', [])
                if items:
                    skill_lists.append(', '.join(items))
    
        return ', '.join(skill_lists)

    def _format_experience(self, data):
        """
        Format an experience entry into a single human-readable string.
        
        Expects `data` to be a dict containing 'job_title' and 'company'. Returns "<job_title> at <company>".
        If `data` is not a dict or keys are missing/empty, returns an empty string.
        """
        if not isinstance(data, dict):
            return ''
    
        job_title = data.get('job_title', '')
        company = data.get('company', '')
      
        return f"{job_title} at {company}"


    def _format_education(self, data):
        """
        Format an education record into a single human-readable string.
        
        Given an education object, returns "<degree> - <institution>". If `data` is not a dict or either key is missing/empty, empty strings are used in place of missing parts; if `data` is not a dict the function returns an empty string.
        
        Parameters:
            data (dict): Education record expected to contain 'degree' and 'institution' keys.
        
        Returns:
            str: Formatted education string or an empty string for invalid input.
        """
        if not isinstance(data, dict):
            return ''
    
        degree = data.get('degree', '')
        institution = data.get('institution', '')
    
        return f"{degree} - {institution}"
    
    def _apply_transform(self, data: Any, transform_name: str, full_cv_data: Dict[str, Any]) -> str:
       """
       Apply a named transform to `data` and return the result as a string.
       
       Looks up a callable in self.transforms by `transform_name` and calls it with `data`. If the transform raises any exception the method returns an empty string. If no transform is found, returns str(data) if `data` is truthy, otherwise an empty string.
       
       Parameters:
           data: The value to be transformed.
           transform_name (str): Key naming the transform to apply.
           full_cv_data (dict): The full CV data passed to the caller; not used by this method but included for transform compatibility.
       
       Returns:
           str: Transformed string, empty string on error or when no meaningful value is available.
       """
       transform_function = self.transforms.get(transform_name)
       if transform_function:
           try:
               return transform_function(data)
           except Exception:
               return ''
       return str(data) if data else ''
       

if __name__ == "__main__":
    detector = FormDetector()
    
    sample_fields = [
        {'name': 'full_name', 'type': 'text', 'label': 'Full Name', 'placeholder': ''},
        {'name': 'email', 'type': 'email', 'label': 'Email Address', 'placeholder': ''},
        {'name': 'phone', 'type': 'tel', 'label': 'Phone Number', 'placeholder': ''},
        {'name': 'company', 'type': 'text', 'label': 'Current Company', 'placeholder': ''},
        {'name': 'position', 'type': 'text', 'label': 'Job Title', 'placeholder': ''},
    ]
    
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
    
    mappings = detector.generate_field_mapping(sample_cv_data, sample_fields)
    
    print("Generated mappings:")
    for mapping in mappings['mappings']:
        print(f"  {mapping['field_name']} -> {mapping['cv_path']}: {mapping['value']}")
    
    print(f"\nUnmapped fields: {len(mappings['unmapped_fields'])}")
    for field in mappings['unmapped_fields']:
        print(f"  {field['name']} ({field['type']})")