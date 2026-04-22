import sqlite3
import os
import time
import uuid

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notes.db")

def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    # Use the same optimizations as the app
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn

def benchmark(query_name, func, iterations=1000):
    start_time = time.perf_counter()
    for _ in range(iterations):
        func()
    end_time = time.perf_counter()
    
    total_time = end_time - start_time
    avg_time = (total_time / iterations) * 1000  # Convert to milliseconds
    
    print(f"{query_name:<40} | {iterations:<10} | {avg_time:.4f} ms")

def run_benchmarks():
    print(f"Benchmarking database: {DB_PATH}")
    print("-" * 75)
    print(f"{'Query Operation':<40} | {'Iterations':<10} | {'Avg Time (ms)'}")
    print("-" * 75)
    
    try:
        conn = get_db_conn()
        c = conn.cursor()
        
        # 1. Test fetching all settings
        def test_select_settings():
            c.execute("SELECT key, value FROM settings")
            c.fetchall()
        benchmark("SELECT all settings", test_select_settings)
        
        # 2. Test fetching notes metadata
        def test_select_notes_metadata():
            c.execute("SELECT id, title, lastModified FROM notes")
            c.fetchall()
        benchmark("SELECT notes metadata", test_select_notes_metadata)
        
        # 3. Test fetching full notes
        def test_select_full_notes():
            c.execute("SELECT id, title, content, lastModified FROM notes")
            c.fetchall()
        benchmark("SELECT full notes", test_select_full_notes)
        
        # Get a sample note ID to use for targeted queries
        c.execute("SELECT id FROM notes LIMIT 1")
        row = c.fetchone()
        sample_note_id = row[0] if row else "dummy_id"
        
        # 4. Test fetching single note content
        def test_select_single_note():
            c.execute("SELECT content FROM notes WHERE id = ?", (sample_note_id,))
            c.fetchone()
        benchmark("SELECT single note by ID", test_select_single_note)
        
        # 5. Test LIKE search
        def test_like_search():
            c.execute("SELECT id, title, lastModified FROM notes WHERE title LIKE ? OR content LIKE ? LIMIT 20", ('%test%', '%test%'))
            c.fetchall()
        benchmark("LIKE search (basic)", test_like_search)
        
        # 6. Test FTS search
        def test_fts_search():
            try:
                c.execute('''
                    SELECT n.id, n.title, n.lastModified, snippet(notes_fts, 1, '[', ']', '...', 20) as snippet
                    FROM notes_fts
                    JOIN notes n ON n.rowid = notes_fts.rowid 
                    WHERE notes_fts MATCH ? 
                    ORDER BY rank
                    LIMIT 20
                ''', ("*test*",))
                c.fetchall()
            except sqlite3.OperationalError:
                pass # Table notes_fts might not exist or be populated
        benchmark("FTS5 Match search", test_fts_search)

        # 7. Test Settings Write (includes IO commit time)
        def test_settings_write():
            c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ("benchmark_test_key", "test_value"))
            conn.commit()
        benchmark("INSERT OR REPLACE settings", test_settings_write, iterations=100)

        # 8. Test Note INSERT / UPDATE / DELETE Lifecycle (includes IO commit time)
        def test_write_lifecycle():
            dummy_id = str(uuid.uuid4())
            # Insert Note using RETURNING to get rowid and avoid subqueries later
            c.execute("INSERT INTO notes (id, title, content, lastModified) VALUES (?, ?, ?, ?) RETURNING rowid",
                      (dummy_id, "Benchmark Test Note", "This is a test note for benchmarking.", int(time.time() * 1000)))
            rowid = c.fetchone()[0]
            
            # Insert FTS using the explicit rowid
            try:
                c.execute("INSERT INTO notes_fts(rowid, title, content) VALUES (?, ?, ?)", 
                          (rowid, "Benchmark Test Note", "This is a test note for benchmarking."))
            except sqlite3.OperationalError:
                pass
            
            # Update Note
            c.execute("UPDATE notes SET content = ? WHERE id = ?", ("Updated content for benchmark.", dummy_id))
            
            # Update FTS using the explicit rowid
            try:
                c.execute("DELETE FROM notes_fts WHERE rowid = ?", (rowid,))
                c.execute("INSERT INTO notes_fts(rowid, title, content) VALUES (?, ?, ?)", 
                          (rowid, "Benchmark Test Note", "Updated content for benchmark."))
            except sqlite3.OperationalError:
                pass
                
            # Delete Note
            c.execute("DELETE FROM notes WHERE id = ?", (dummy_id,))
            conn.commit()
            
        benchmark("Note INSERT/UPDATE/DELETE Lifecycle", test_write_lifecycle, iterations=100)

        # Cleanup test settings
        c.execute("DELETE FROM settings WHERE key = ?", ("benchmark_test_key",))
        conn.commit()

    except Exception as e:
        print(f"An error occurred during benchmarking: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    run_benchmarks()
