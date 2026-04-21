import { NextRequest, NextResponse } from 'next/server'
import { docDb, docStorage } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doc = await docDb.getById(params.id)
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const ext = doc.ext.toLowerCase()

    // ── DOCX → HTML via mammoth ──────────────────────────────────────────────
    if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const buffer  = await docStorage.download(doc.storedName)
      const result  = await mammoth.convertToHtml({ buffer })
      return buildHtmlResponse(doc.originalName, result.value)
    }

    // ── DOC → text via word-extractor ────────────────────────────────────────
    if (ext === 'doc') {
      const buffer = await docStorage.download(doc.storedName)
      // word-extractor needs a file path, so write to /tmp first
      const tmpPath = `/tmp/${doc.storedName}`
      const fs = await import('fs/promises')
      await fs.writeFile(tmpPath, buffer)
      try {
        const WordExtractor = require('word-extractor')
        const extractor = new WordExtractor()
        const extracted = await extractor.extract(tmpPath)
        const body = extracted.getBody() as string
        const html = body
          .split('\n')
          .map((l: string) => l.trim())
          .filter(Boolean)
          .map((l: string) => `<p>${escapeHtml(l)}</p>`)
          .join('\n')
        await fs.unlink(tmpPath).catch(() => {})
        return buildHtmlResponse(doc.originalName, html || '<p><em>(No text content found)</em></p>')
      } catch (e) {
        await fs.unlink(tmpPath).catch(() => {})
        return buildHtmlResponse(doc.originalName, '<p style="color:#ef4444">Could not read this .doc file.</p>')
      }
    }

    // ── XLS/XLSX → HTML table ────────────────────────────────────────────────
    if (ext === 'xls' || ext === 'xlsx') {
      const XLSX   = await import('xlsx')
      const buffer = await docStorage.download(doc.storedName)
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      let allHtml = ''
      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName]
        const tableHtml = XLSX.utils.sheet_to_html(ws, { header: '', footer: '' })
        allHtml += `<h3 style="margin:1.5rem 0 .5rem;font-weight:700;color:#4f46e5">${escapeHtml(sheetName)}</h3>${tableHtml}`
      }
      return buildHtmlResponse(doc.originalName, allHtml, xlsStyle)
    }

    return NextResponse.json({ error: 'No HTML preview for this type' }, { status: 415 })
  } catch (err) {
    console.error('Preview error:', err)
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 })
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const xlsStyle = `
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
  th { background: #f8fafc; font-weight: 600; color: #475569; }
  tr:nth-child(even) td { background: #f8fafc; }
`

function buildHtmlResponse(title: string, bodyHtml: string, extraStyle = '') {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #f9fafb; font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; line-height: 1.75; font-size: 15px; }
  .page { max-width: 820px; margin: 2rem auto; background: #fff; padding: 3rem 3.5rem; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.07); min-height: calc(100vh - 4rem); }
  h1,h2,h3,h4,h5,h6 { margin: 1.4rem 0 .6rem; font-weight: 700; color: #0f172a; }
  p { margin: 0 0 .9rem; }
  ul,ol { margin: .5rem 0 1rem 1.5rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th,td { border: 1px solid #e2e8f0; padding: 7px 12px; }
  th { background: #f1f5f9; font-weight: 600; }
  img { max-width: 100%; }
  ${extraStyle}
</style>
</head>
<body>
<div class="page">${bodyHtml}</div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=60' },
  })
}
