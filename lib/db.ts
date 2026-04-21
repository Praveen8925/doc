/**
 * lib/db.ts
 * SQLite database module using better-sqlite3.
 * - Single file database stored at: <project root>/data/docflow.db
 * - Singleton pattern: one connection reused across all API routes.
 * - Auto-migrates schema on first run.
 * - On startup, imports any legacy metadata.json records.
 */

import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync, existsSync, readFileSync } from 'fs'

// ── Storage location ─────────────────────────────────────────────────────────
// On Render.com set env var:  STORAGE_DIR=/data  (the persistent disk mount)
// Locally defaults to <project>/data  (works with no env var set)
const STORAGE_DIR  = process.env.STORAGE_DIR || join(process.cwd(), 'data')
const UPLOADS_DIR  = process.env.UPLOADS_DIR  || join(process.cwd(), 'uploads')
const DATA_DIR     = STORAGE_DIR
const DB_PATH      = join(STORAGE_DIR, 'docflow.db')

// Export so API routes can import the same resolved paths
export { UPLOADS_DIR }

// ── Ensure data/ dir exists ─────────────────────────────────────────────────
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

// ── Open / create the database ──────────────────────────────────────────────
const db = new Database(DB_PATH)

// Enable WAL mode for better read concurrency (multiple browser tabs / users)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id           TEXT PRIMARY KEY,
    stored_name  TEXT NOT NULL,
    original_name TEXT NOT NULL,
    uploaded_at  TEXT NOT NULL,
    size         INTEGER NOT NULL,
    mime_type    TEXT NOT NULL,
    ext          TEXT NOT NULL
  );
`)

// ── Migrate legacy metadata.json → SQLite (runs once) ───────────────────────
const LEGACY_PATH = join(UPLOADS_DIR, 'metadata.json')
const MIGRATED_FLAG = join(DATA_DIR, '.migrated')

if (existsSync(LEGACY_PATH) && !existsSync(MIGRATED_FLAG)) {
  try {
    const raw = readFileSync(LEGACY_PATH, 'utf-8')
    const docs: Array<{
      id: string
      storedName: string
      originalName: string
      uploadedAt: string
      size: number
      mimeType: string
      ext: string
    }> = JSON.parse(raw)

    const insert = db.prepare(`
      INSERT OR IGNORE INTO documents (id, stored_name, original_name, uploaded_at, size, mime_type, ext)
      VALUES (@id, @stored_name, @original_name, @uploaded_at, @size, @mime_type, @ext)
    `)

    const migrateAll = db.transaction((rows: typeof docs) => {
      for (const row of rows) {
        insert.run({
          id: row.id,
          stored_name: row.storedName,
          original_name: row.originalName,
          uploaded_at: row.uploadedAt,
          size: row.size,
          mime_type: row.mimeType,
          ext: row.ext,
        })
      }
    })

    migrateAll(docs)
    // Write flag so we don't re-migrate
    require('fs').writeFileSync(MIGRATED_FLAG, new Date().toISOString())
    console.log(`[DocFlow DB] Migrated ${docs.length} documents from metadata.json`)
  } catch (e) {
    console.warn('[DocFlow DB] Legacy migration skipped:', e)
  }
}

// ── Typed row ────────────────────────────────────────────────────────────────
export interface DocRow {
  id: string
  storedName: string
  originalName: string
  uploadedAt: string
  size: number
  mimeType: string
  ext: string
}

// ── Prepared statements (created once, reused) ───────────────────────────────
const stmtGetAll = db.prepare<[], {
  id: string; stored_name: string; original_name: string;
  uploaded_at: string; size: number; mime_type: string; ext: string;
}>(`SELECT * FROM documents ORDER BY uploaded_at DESC`)

const stmtGetById = db.prepare<[string], {
  id: string; stored_name: string; original_name: string;
  uploaded_at: string; size: number; mime_type: string; ext: string;
}>(`SELECT * FROM documents WHERE id = ?`)

const stmtInsert = db.prepare(`
  INSERT INTO documents (id, stored_name, original_name, uploaded_at, size, mime_type, ext)
  VALUES (@id, @stored_name, @original_name, @uploaded_at, @size, @mime_type, @ext)
`)

const stmtDelete = db.prepare(`DELETE FROM documents WHERE id = ?`)

// ── Helper to convert DB row → camelCase ─────────────────────────────────────
function toDocRow(row: {
  id: string; stored_name: string; original_name: string;
  uploaded_at: string; size: number; mime_type: string; ext: string;
}): DocRow {
  return {
    id: row.id,
    storedName: row.stored_name,
    originalName: row.original_name,
    uploadedAt: row.uploaded_at,
    size: row.size,
    mimeType: row.mime_type,
    ext: row.ext,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export const docDb = {
  /** Return all documents, newest first */
  getAll(): DocRow[] {
    return stmtGetAll.all().map(toDocRow)
  },

  /** Return a single document by id, or null */
  getById(id: string): DocRow | null {
    const row = stmtGetById.get(id)
    return row ? toDocRow(row) : null
  },

  /** Insert a new document record */
  insert(doc: DocRow): void {
    stmtInsert.run({
      id: doc.id,
      stored_name: doc.storedName,
      original_name: doc.originalName,
      uploaded_at: doc.uploadedAt,
      size: doc.size,
      mime_type: doc.mimeType,
      ext: doc.ext,
    })
  },

  /** Delete a document record by id */
  delete(id: string): void {
    stmtDelete.run(id)
  },
}

export default db
