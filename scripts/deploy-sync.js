#!/usr/bin/env node
/**
 * scripts/deploy-sync.js
 *
 * Runs before `npm run start` on every deploy.
 * 1. Ensures storage directories exist (on the persistent volume).
 * 2. Copies any files committed to git's /uploads/ into the persistent volume (once).
 * 3. Migrates legacy metadata.json → SQLite (once).
 * 4. Prints a summary of all documents in the DB.
 */

const path = require('path')
const fs   = require('fs')

const root       = path.join(__dirname, '..')

// Resolve storage paths — same logic as lib/db.ts
const STORAGE_DIR  = process.env.STORAGE_DIR  || path.join(root, 'data')
const UPLOADS_DIR  = process.env.UPLOADS_DIR  || path.join(root, 'uploads')

// The git-committed uploads folder (always at <project>/uploads/)
const GIT_UPLOADS  = path.join(root, 'uploads')

console.log(`\n[DocFlow] Storage dir : ${STORAGE_DIR}`)
console.log(`[DocFlow] Uploads dir : ${UPLOADS_DIR}`)

// ── 1. Ensure directories exist ─────────────────────────────────────────────
;[STORAGE_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`✔ Created: ${dir}`)
  }
})

// ── 2. Copy committed files → persistent volume (skip if already there) ──────
if (fs.existsSync(GIT_UPLOADS) && GIT_UPLOADS !== UPLOADS_DIR) {
  const gitFiles = fs.readdirSync(GIT_UPLOADS).filter(f => f !== 'metadata.json')
  let copied = 0
  for (const file of gitFiles) {
    const src  = path.join(GIT_UPLOADS, file)
    const dest = path.join(UPLOADS_DIR, file)
    if (fs.statSync(src).isFile() && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest)
      copied++
    }
  }
  if (copied > 0) console.log(`✔ Copied ${copied} committed file(s) → ${UPLOADS_DIR}`)
  else            console.log(`✔ All committed files already in volume`)
}

// ── 3. Open / initialise SQLite ──────────────────────────────────────────────
const dbPath = path.join(STORAGE_DIR, 'docflow.db')
const Database = require('better-sqlite3')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id            TEXT PRIMARY KEY,
    stored_name   TEXT NOT NULL,
    original_name TEXT NOT NULL,
    uploaded_at   TEXT NOT NULL,
    size          INTEGER NOT NULL,
    mime_type     TEXT NOT NULL,
    ext           TEXT NOT NULL
  );
`)
console.log(`✔ SQLite DB ready: ${dbPath}`)

// ── 4. Migrate legacy metadata.json if present ───────────────────────────────
const legacyPath    = path.join(GIT_UPLOADS, 'metadata.json')
const migratedFlag  = path.join(STORAGE_DIR, '.migrated')

if (fs.existsSync(legacyPath) && !fs.existsSync(migratedFlag)) {
  try {
    const docs = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'))
    const insert = db.prepare(`
      INSERT OR IGNORE INTO documents (id, stored_name, original_name, uploaded_at, size, mime_type, ext)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const migrate = db.transaction(rows => {
      for (const r of rows) insert.run(r.id, r.storedName, r.originalName, r.uploadedAt, r.size, r.mimeType, r.ext)
    })
    migrate(docs)
    fs.writeFileSync(migratedFlag, new Date().toISOString())
    console.log(`✔ Migrated ${docs.length} record(s) from metadata.json → SQLite`)
  } catch (e) {
    console.warn('⚠ Migration skipped:', e.message)
  }
}

// ── 5. Sync DB records with actual files in UPLOADS_DIR ──────────────────────
// If a file exists on disk but isn't in the DB, add it (shouldn't normally happen).
// If a DB record's file is missing from disk AND from git, remove the orphan record.
const allRows = db.prepare('SELECT * FROM documents').all()
const missingIds = []
for (const row of allRows) {
  const onVolume = path.join(UPLOADS_DIR, row.stored_name)
  const onGit    = path.join(GIT_UPLOADS,  row.stored_name)
  if (!fs.existsSync(onVolume) && !fs.existsSync(onGit)) {
    missingIds.push(row.id)
  }
}
if (missingIds.length) {
  const del = db.prepare('DELETE FROM documents WHERE id = ?')
  missingIds.forEach(id => del.run(id))
  console.log(`⚠ Removed ${missingIds.length} orphan DB record(s) (file missing)`)
}

// ── 6. Summary ───────────────────────────────────────────────────────────────
const rows = db.prepare('SELECT original_name, size, uploaded_at FROM documents ORDER BY uploaded_at DESC').all()
console.log(`\n📄 Documents available: ${rows.length}`)
rows.forEach((r, i) => {
  const kb   = (r.size / 1024).toFixed(1)
  const date = new Date(r.uploaded_at).toLocaleString()
  console.log(`  ${i + 1}. ${r.original_name} (${kb} KB) — ${date}`)
})

console.log('\n✅ Deploy sync complete.\n')
