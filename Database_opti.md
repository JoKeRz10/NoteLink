# Database Optimization Report

This report documents the core improvements implemented in the **NoteLink** backend to ensure high performance, low latency, and efficient resource management.

---

## 1. High-Performance Full-Text Search (FTS5)
**Problem:** The original search used standard SQL `LIKE` queries, which performed full-text scans. This is extremely slow for long notes like video transcripts.
**Solution:** Implemented **SQLite FTS5 (Full-Text Search)** virtual tables.

| Metric | Before Optimization | After Optimization |
| :--- | :--- | :--- |
| **Logic** | `WHERE content LIKE '%query%'` | `WHERE notes_fts MATCH 'query'` |
| **Speed** | Seconds for large datasets | Near-instant (Sub-second) |
| **Relevance** | No ranking (sequential match) | Smart ranking based on relevance (`rank`) |

---

## 2. Smart Delta Sync & Batch Processing
**Problem:** The sync logic previously deleted all notes and re-inserted them for every sync event, causing $O(N)$ high-cost disk operations.
**Solution:** Implemented a **Delta Sync** system using `UPSERT` logic and `executemany` batch operations.

| Metric | Before Optimization | After Optimization |
| :--- | :--- | :--- |
| **I/O Cost** | High (deleting and writing everything) | Low (writing only modified records) |
| **Transaction** | Multiple individual transactions | Single Batch Transaction |
| **Efficiency** | Redundant operations | Optimized record tracking |

---

## 3. Payload & Memory Optimization (Lazy Loading)
**Problem:** The UI fetched full note content (even long transcripts) just to display the note list, leading to high memory usage and slow UI response.
**Solution:** Decoupled metadata (titles/IDs) from note content.

| Metric | Before Optimization | After Optimization |
| :--- | :--- | :--- |
| **API Payload** | Huge (Metadata + Full Content) | Slim (Titles and IDs only) |
| **Network usage** | High bandwidth consumption | Minimum bandwidth for list view |
| **Loading** | Front-loaded (Slow startup) | On-demand (`Lazy Loading`) |



> [!TIP]
> These optimizations ensure that **NoteLink** scales perfectly, handling thousands of notes and massive video transcripts without any performance degradation.
