from app.services.llm_service import LLMService
import json

def test_llm_service():
    llm = LLMService()
    
    sample_cv = CV
    
    result = llm.parse_cv(sample_cv)
    
    if result:
        print("✅ CV parsed successfully!")
        print(json.dumps(result.dict(), indent=2))
    else:
        print("❌ Failed to parse CV")

if __name__ == "__main__":
    test_llm_service()
