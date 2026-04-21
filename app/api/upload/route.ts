import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import crypto from 'crypto'
import { docDb, UPLOADS_DIR, type DocRow } from '@/lib/db'

async function ensureUploadDir() {
  if (!existsSync(UPLOADS_DIR)) await mkdir(UPLOADS_DIR, { recursive: true })
}

export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir()

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const MAX_SIZE = 50 * 1024 * 1024 // 50 MB per file
    const created: DocRow[] = []

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `"${file.name}" exceeds the 50 MB limit` },
          { status: 400 }
        )
      }

      const fileId    = crypto.randomBytes(8).toString('hex')
      const parts     = file.name.split('.')
      const ext       = (parts.length > 1 ? parts.pop()! : 'bin').toLowerCase()
      const storedName = `${fileId}.${ext}`
      const filepath   = `${UPLOADS_DIR}/${storedName}`

      const bytes = await file.arrayBuffer()
      await writeFile(filepath, Buffer.from(bytes))

      const doc: DocRow = {
        id:           fileId,
        storedName,
        originalName: file.name,
        uploadedAt:   new Date().toISOString(),
        size:         file.size,
        mimeType:     file.type || 'application/octet-stream',
        ext,
      }

      // Persist to SQLite
      docDb.insert(doc)
      created.push(doc)
    }

    return NextResponse.json(
      {
        success: true,
        uploadedCount: created.length,
        files: created.map(d => ({
          id:           d.id,
          originalName: d.originalName,
          uploadedAt:   d.uploadedAt,
          size:         d.size,
          ext:          d.ext,
          mimeType:     d.mimeType,
        })),
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
