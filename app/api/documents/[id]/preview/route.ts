import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { existsSync } from 'fs'
import { docDb, UPLOADS_DIR } from '@/lib/db'

const uploadDir = UPLOADS_DIR

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matched = docDb.getById(params.id)
    if (!matched) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const filepath = join(uploadDir, matched.storedName)
    if (!existsSync(filepath)) return NextResponse.json({ error: 'File missing' }, { status: 404 })

    const ext = matched.ext.toLowerCase()

    // ── DOCX → HTML via mammoth ───────────────────────────────────────────
    if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.convertToHtml({ path: filepath })
      return buildHtmlResponse(matched.originalName, result.value)
    }

    // ── DOC → text via word-extractor ─────────────────────────────────────
    if (ext === 'doc') {
      try {
        // word-extractor is a CommonJS module
        const WordExtractor = require('word-extractor')
        const extractor = new WordExtractor()
        const extracted = await extractor.extract(filepath)
        const body = extracted.getBody() as string
        // Convert plain-text line breaks to simple paragraphs
        const html = body
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => `<p>${escapeHtml(line)}</p>`)
          .join('\n')
        return buildHtmlResponse(matched.originalName, html || '<p><em>(No text content found)</em></p>')
      } catch (e) {
        console.error('word-extractor error:', e)
        return buildHtmlResponse(
          matched.originalName,
          '<p style="color:#ef4444">Could not read this .doc file. Try re-saving it as .docx in Word.</p>'
        )
      }
    }

    // ── XLS/XLSX → HTML table via xlsx ────────────────────────────────────
    if (ext === 'xls' || ext === 'xlsx') {
      try {
        const XLSX = await import('xlsx')
        const workbook = XLSX.readFile(filepath)
        let allHtml = ''
        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName]
          const tableHtml = XLSX.utils.sheet_to_html(ws, { header: '', footer: '' })
          allHtml += `<h3 style="margin:1.5rem 0 .5rem;font-weight:700;color:#4f46e5">${escapeHtml(sheetName)}</h3>${tableHtml}`
        }
        return buildHtmlResponse(matched.originalName, allHtml, xlsStyle)
      } catch (e) {
        console.error('xlsx error:', e)
        return buildHtmlResponse(matched.originalName, '<p style="color:#ef4444">Could not read spreadsheet.</p>')
      }
    }

    return NextResponse.json({ error: 'No HTML preview for this type' }, { status: 415 })
  } catch (err) {
    console.error('preview route error:', err)
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 })
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
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
  h1,h2,h3,h4,h5,h6 { margin: 1.4rem 0 .6rem; font-weight: 700; color: #0f172a; line-height: 1.3; }
  p { margin: 0 0 .9rem; }
  ul,ol { margin: .5rem 0 1rem 1.5rem; }
  li { margin-bottom: .3rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 13px; }
  th,td { border: 1px solid #e2e8f0; padding: 7px 12px; }
  th { background: #f1f5f9; font-weight: 600; }
  img { max-width: 100%; height: auto; }
  b,strong { font-weight: 700; }
  em,i { font-style: italic; }
  u { text-decoration: underline; }
  a { color: #4f46e5; }
  ${extraStyle}
  @media(max-width:680px){ .page { padding: 1.5rem; } }
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
