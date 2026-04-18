import os
import shutil
import uuid

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage")

if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR)

def save_uploaded_file(file_obj, filename: str) -> str:
    """Saves an uploaded file to the local storage directory and returns the path."""
    file_id = str(uuid.uuid4())
    _, ext = os.path.splitext(filename)
    stored_name = f"{file_id}{ext}"
    dest_path = os.path.join(STORAGE_DIR, stored_name)
    
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file_obj, buffer)
        
    return dest_path

def delete_file(file_path: str):
    """Deletes a file from storage if it exists."""
    if os.path.exists(file_path):
        os.remove(file_path)
