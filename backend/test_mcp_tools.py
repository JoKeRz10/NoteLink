import asyncio
import sqlite3
import os
import sys

# Add the project root to sys.path so we can import mcp_server
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from mcp_server import read_current_note, search_notes, save_ai_summary

async def run_tests():
    db_path = "notes.db"
    
    # 1. Check if DB exists
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found.")
        return

    # 2. Get a sample note_id
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT id, title, content FROM notes LIMIT 1")
    row = c.fetchone()
    conn.close()

    if not row:
        print("No notes found in database to test with.")
        return

    note_id, title, content = row
    print(f"Testing with Note: {title} (ID: {note_id})")

    # 3. Test read_current_note
    print("\n[Test 1] read_current_note...")
    result_content = await read_current_note(note_id)
    if result_content == content:
        print("PASSED: Content matches.")
    else:
        print(f"FAILED: Content mismatch. Expected start: {content[:20]}... Got: {result_content[:20]}...")

    # 4. Test search_notes
    print("\n[Test 2] search_notes...")
    # Search for a word from the title
    search_query = title.split()[0] if title else "note"
    search_results = await search_notes(search_query)
    found = any(n['id'] == note_id for n in search_results)
    if found:
        print(f"PASSED: Found note with query '{search_query}'.")
    else:
        print(f"FAILED: Did not find note with query '{search_query}'.")

    # 5. Test save_ai_summary
    print("\n[Test 3] save_ai_summary...")
    test_summary = "This is a test summary."
    status = await save_ai_summary(note_id, test_summary)
    
    # Verify update
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT content FROM notes WHERE id = ?", (note_id,))
    new_content = c.fetchone()[0]
    conn.close()

    if test_summary in new_content:
        print("PASSED: Summary saved successfully.")
    else:
        print("FAILED: Summary not found in content.")

    # Cleanup: restore original content
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("UPDATE notes SET content = ? WHERE id = ?", (content, note_id))
    conn.commit()
    conn.close()
    print("\nOriginal content restored.")

if __name__ == "__main__":
    asyncio.run(run_tests())
