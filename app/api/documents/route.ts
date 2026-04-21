import { NextResponse } from 'next/server'
import { docDb } from '@/lib/db'

export async function GET() {
  try {
    const docs = docDb.getAll()
    return NextResponse.json(
      docs.map(d => ({
        id:           d.id,
        originalName: d.originalName,
        uploadedAt:   d.uploadedAt,
        size:         d.size,
        ext:          d.ext,
        mimeType:     d.mimeType,
      }))
    )
  } catch (err) {
    console.error('GET /api/documents error:', err)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}
