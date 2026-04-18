import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal, Base, engine
from backend.services import optimization_layer, storage_service
from backend.utils.hashing import calculate_text_hash
import shutil

from unittest.mock import patch, AsyncMock

async def test_optimization():
    print("Starting optimization verification...")
    
    # Initialize DB
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        content = "This is a test document for verification of the data optimization layer."
        ai_provider = "local"
        ai_api_key = ""
        length = 50
        mode = "text"
        
        # Mock the processing service to avoid network errors
        with patch("backend.services.processing_service.generate_summary", new_callable=AsyncMock) as mock_summary:
            mock_summary.return_value = "Mocked AI Summary"
            
            # 1. Test Summary Caching
            print("\n--- Testing Summary Caching ---")
            print("First call (processing)...")
            summary1 = await optimization_layer.get_or_create_summary(db, content, length, mode, ai_provider, ai_api_key)
            print(f"Summary 1: {summary1}")
            
            print("Second call (should be cached)...")
            summary2 = await optimization_layer.get_or_create_summary(db, content, length, mode, ai_provider, ai_api_key)
            print(f"Summary 2: {summary2}")
            
            assert summary1 == summary2, "Summaries should be identical"
            assert mock_summary.call_count == 1, "AI service should only be called once"
            print("SUCCESS: Summary caching works.")

        with patch("backend.services.processing_service.extract_tasks", new_callable=AsyncMock) as mock_tasks:
            mock_tasks.return_value = "- [ ] Task 1\n- [ ] Task 2"
            
            # 2. Test Task Caching
            print("\n--- Testing Task Caching ---")
            print("First call (processing)...")
            tasks1 = await optimization_layer.get_or_create_tasks(db, content, ai_provider, ai_api_key)
            print(f"Tasks 1: {tasks1}")
            
            print("Second call (should be cached)...")
            tasks2 = await optimization_layer.get_or_create_tasks(db, content, ai_provider, ai_api_key)
            print(f"Tasks 2: {tasks2}")
            
            assert tasks1 == tasks2, "Tasks should be identical"
            assert mock_tasks.call_count == 1, "AI service should only be called once"
            print("SUCCESS: Task caching works.")
        
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_optimization())
