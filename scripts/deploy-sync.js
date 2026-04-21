#!/usr/bin/env node
/**
 * scripts/deploy-sync.js
 *
 * Run this on your SERVER after pulling the latest code:
 *   node scripts/deploy-sync.js
 *
 * What it does:
 *  1. Ensures the /uploads and /data directories exist.
 *  2. If there is a legacy metadata.json it migrates it into SQLite.
 *  3. Prints a summary of documents currently in the database.
 *
 * The key rule is:
 *   - The `uploads/` folder must be preserved across deployments (it holds the actual files).
 *   - The `data/docflow.db` file must be preserved (it holds the index / metadata).
 *   - Neither folder should be in .gitignore if you want to keep data on the server.
 *     OR use a persistent volume / shared network drive on the server.
 */

const path  = require('path')
const fs    = require('fs')
const root  = path.join(__dirname, '..')

const uploadsDir = path.join(root, 'uploads')
const dataDir    = path.join(root, 'data')
const dbPath     = path.join(dataDir, 'docflow.db')

// --- 1. Ensure directories exist -------------------------------------------
if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }); console.log('✔ Created uploads/') }
if (!fs.existsSync(dataDir))    { fs.mkdirSync(dataDir,    { recursive: true }); console.log('✔ Created data/') }

// --- 2. Open / create SQLite DB --------------------------------------------
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
console.log(`✔ SQLite DB ready at: ${dbPath}`)

// --- 3. Migrate legacy metadata.json if not done yet -----------------------
const legacyPath  = path.join(uploadsDir, 'metadata.json')
const migratedFlag = path.join(dataDir, '.migrated')

if (fs.existsSync(legacyPath) && !fs.existsSync(migratedFlag)) {
  try {
    const docs = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'))
    const insert = db.prepare(`
      INSERT OR IGNORE INTO documents (id, stored_name, original_name, uploaded_at, size, mime_type, ext)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const migrateAll = db.transaction((rows) => {
      for (const r of rows) {
        insert.run(r.id, r.storedName, r.originalName, r.uploadedAt, r.size, r.mimeType, r.ext)
      }
    })
    migrateAll(docs)
    fs.writeFileSync(migratedFlag, new Date().toISOString())
    console.log(`✔ Migrated ${docs.length} documents from metadata.json → SQLite`)
  } catch (e) {
    console.warn('⚠ Legacy migration skipped:', e.message)
  }
}

// --- 4. Summary -----------------------------------------------------------
const rows = db.prepare('SELECT id, original_name, size, uploaded_at FROM documents ORDER BY uploaded_at DESC').all()
console.log(`\n📄 Documents in database: ${rows.length}`)
rows.forEach((r, i) => {
  const kb = (r.size / 1024).toFixed(1)
  const date = new Date(r.uploaded_at).toLocaleString()
  console.log(`  ${i + 1}. ${r.original_name} (${kb} KB) — uploaded ${date}`)
})

console.log('\n✅ Deploy sync complete. You can now start the server with: npm run start')
