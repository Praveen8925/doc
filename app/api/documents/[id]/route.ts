import { NextRequest, NextResponse } from 'next/server'
import { docDb, docStorage } from '@/lib/supabase'

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
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  svg:  'image/svg+xml',
}

// ── GET: stream file from Supabase Storage ───────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doc = await docDb.getById(params.id)
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const ext      = doc.ext.toLowerCase()
    const mimeType = mimeTypes[ext] || doc.mimeType || 'application/octet-stream'

    const buffer = await docStorage.download(doc.storedName)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        mimeType,
        'Content-Disposition': `inline; filename="${doc.originalName}"`,
        'Cache-Control':       'private, max-age=300',
      },
    })
  } catch (err) {
    console.error('GET document error:', err)
    return NextResponse.json({ error: 'Failed to serve document' }, { status: 500 })
  }
}

// ── DELETE: remove from Storage + DB ────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doc = await docDb.getById(params.id)
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await docStorage.remove(doc.storedName)
    await docDb.delete(params.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE error:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
