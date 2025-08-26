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
        self.classification_patterns = self._initialize_patterns()
        self.common_transforms = self._initialize_transforms()
        self.transforms = {
            'join_skills': self._join_skills,
            'format_experience': self._format_experience,
            'format_education': self._format_education
        }

    def _initialize_patterns(self) -> Dict[str, List[re.Pattern]]:
        return {
                'personal_info.full_name': [
                    re.compile(r'full?.name|name(?!.*email)) (?!*.user.I)', re.I),
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
                    re.compile(r'phone|cel|tel|moile|cell|contact', re.I),
                    re.compile(r'phone.?number', re.I)
                    ],
                'personal_info.address': [
                    re.compile(r'address|addr(?!ess)', re.I),
                    re.copile(r'street|location', re.I)
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
                'education[r0].degree': [
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
            return {
                        'skills_text': 'join_skills',
                        'experience_summary': 'format_experience',
                        'education_summary': 'format_education',
                            }

    def classify_fields(self, field_data: List[Dict[str, Any]]) -> List[FormMapping]:
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
        return mapping

    
    def _classify_single_field(self, field: FormField) -> tuple[Optional[str], float]:
    
        text_attributes = [
            field.name,
            field.attributes.get('id', ''),
            field.attributes.get('placeholder', ''),
            field.attributes.get('label', ''),
            field.attributes.get('className', '') # TODO: isn't className a React pro
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
        try:
            if '[' in cv_path:
                cv_path = re.sub(r'\[(\d+)\]', r'.\1', cv_path)

            path_parts = cv_path.split('.')
            current_data = cv_data

            for part in path_parts:
                if part.isdigit():
                    current_data = current_data[int(part)]
                else:
                    current_data = current_data.get(part, {})


                if current_data is None:
                    return None

            if transform_function and isinstance(current_data, (list, dict)):
                return self._apply_transform(current_data, transform_function, cv_data)

            return str(current_data) if current_data else None

        except (KeyError, IndexError, TypeError):
            return None


    def _join_skills(self, data):
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
        if not isinstance(data, dict):
            return ''
    
        job_title = data.get('job_title', '')
        company = data.get('company', '')
      
        return f"{job_title} at {company}"


    def _format_education(self, data):
        if not isinstance(data, dict):
            return ''
    
        degree = data.get('degree', '')
        institution = data.get('institution', '')
    
        return f"{degree} - {institution}"
    
    def _apply_transform(self, data: Any, transform_name: str, full_cv_data: Dict[str, Any]) -> str:
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
    
    mappings = detector.generate_field_mappings(sample_cv_data, sample_fields)
    
    print("Generated mappings:")
    for mapping in mappings['mappings']:
        print(f"  {mapping['field_name']} -> {mapping['cv_path']}: {mapping['value']}")
    
    print(f"\nUnmapped fields: {len(mappings['unmapped_fields'])}")
    for field in mappings['unmapped_fields']:
        print(f"  {field['name']} ({field['type']})")