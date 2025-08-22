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
