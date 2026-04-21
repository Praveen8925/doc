import { NextRequest, NextResponse } from 'next/server'
import { readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { docDb } from '@/lib/db'

const uploadDir = join(process.cwd(), 'uploads')

const mimeTypes: Record<string, string> = {
  pdf:  'application/pdf',
  txt:  'text/plain',
  md:   'text/markdown',
  csv:  'text/csv',
  html: 'text/html',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt:  'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt:  'application/vnd.oasis.opendocument.text',
  ods:  'application/vnd.oasis.opendocument.spreadsheet',
  odp:  'application/vnd.oasis.opendocument.presentation',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  svg:  'image/svg+xml',
}

// ── GET: serve raw file bytes ─────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matched = docDb.getById(params.id)
    if (!matched) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const filepath = join(uploadDir, matched.storedName)
    if (!existsSync(filepath)) return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })

    const ext      = matched.ext.toLowerCase()
    const mimeType = mimeTypes[ext] || matched.mimeType || 'application/octet-stream'
    const buffer   = await readFile(filepath)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        mimeType,
        'Content-Disposition': `inline; filename="${matched.originalName}"`,
        'Cache-Control':       'private, max-age=300',
      },
    })
  } catch (err) {
    console.error('GET document error:', err)
    return NextResponse.json({ error: 'Failed to serve document' }, { status: 500 })
  }
}

// ── DELETE: remove file + DB record ──────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matched = docDb.getById(params.id)
    if (!matched) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const filepath = join(uploadDir, matched.storedName)
    if (existsSync(filepath)) await unlink(filepath)

    docDb.delete(params.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE document error:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
