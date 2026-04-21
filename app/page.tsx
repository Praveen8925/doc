'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import axios from 'axios'

interface DocumentItem {
  id: string
  originalName: string
  uploadedAt: string
  size: number
  ext: string
  mimeType: string
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'])
const TEXT_TYPES  = new Set(['text/plain', 'text/markdown', 'text/csv', 'text/html'])
// Office types that go through server-side HTML conversion
const OFFICE_EXTS = new Set(['doc', 'docx', 'xls', 'xlsx', 'odt', 'ods'])

// ── Icons ──────────────────────────────────────────────────────────────────
const IconPDF = () => (
  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M11.363 15.335h-.54v-1.39h.54c.48 0 .8.27.8.695 0 .43-.32.695-.8.695zm.513-8.835v2.85h2.85L11.876 6.5zM14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM9.513 14.62c0 .87-.643 1.583-1.436 1.583h-.54v1.132H6.41V13.04h1.666c.793 0 1.437.713 1.437 1.58zm3.287 1.258c0 .87-.644 1.583-1.437 1.583h-1.63v-4.423h1.63c.793 0 1.437.713 1.437 1.583v1.257zm4.195-2.285h-1.667v1.282h1.49v.85h-1.49v1.283H12.98v-4.423h3.541v.85h-.001zM7.537 15.335h.54v-.695h-.54v.695z" />
  </svg>
)
const IconImage = () => (
  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
const IconDoc = () => (
  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)
const IconUpload = () => (
  <svg className="w-6 h-6 text-indigo-500 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
)
const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const getFileIcon = (mime: string, ext: string) => {
  if (mime === 'application/pdf') return <IconPDF />
  if (IMAGE_TYPES.has(mime))      return <IconImage />
  return <IconDoc />
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Home() {
  const [documents, setDocuments]           = useState<DocumentItem[]>([])
  const [loading, setLoading]               = useState(false)
  const [uploading, setUploading]           = useState(false)
  const [isDragging, setIsDragging]         = useState(false)
  const [selectedDocumentId, setSelectedId] = useState<string | null>(null)
  const [deletingId, setDeletingId]         = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDelete] = useState<string | null>(null)
  const [error, setError]                   = useState('')
  const [iframeKey, setIframeKey]           = useState(0) // force re-mount on doc change
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedDoc = useMemo(
    () => documents.find(d => d.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  )

  useEffect(() => { void fetchDocuments() }, [])

  const selectDoc = (id: string) => {
    setSelectedId(id)
    setIframeKey(k => k + 1) // remount iframe so it loads the new doc
    setConfirmDelete(null)
  }

  // ── API ────────────────────────────────────────────────────────────────
  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get<DocumentItem[]>('/api/documents')
      setDocuments(data)
      if (data.length > 0 && !selectedDocumentId) setSelectedId(data[0].id)
    } catch { setError('Failed to fetch documents') }
    finally  { setLoading(false) }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    try {
      setUploading(true); setError('')
      const fd = new FormData()
      Array.from(files).forEach(f => fd.append('files', f))
      const { data } = await axios.post<{ files: DocumentItem[] }>('/api/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchDocuments()
      if (data?.files?.length) selectDoc(data.files[0].id)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Upload failed')
    } finally { setUploading(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id)
      await axios.delete(`/api/documents/${id}`)
      setDocuments(prev => {
        const next = prev.filter(d => d.id !== id)
        if (selectedDocumentId === id) setSelectedId(next[0]?.id ?? null)
        return next
      })
    } catch { setError('Delete failed. Please try again.') }
    finally { setDeletingId(null); setConfirmDelete(null) }
  }

  const fmt = (bytes: number) => {
    if (!bytes) return '0 B'
    const s = ['B','KB','MB','GB'], i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / 1024 ** i).toFixed(1)} ${s[i]}`
  }

  // ── Preview ────────────────────────────────────────────────────────────
  const renderPreview = useCallback(() => {
    if (!selectedDoc) return (
      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 select-none">
        <svg className="w-20 h-20 opacity-40" fill="none" stroke="currentColor" strokeWidth="0.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-lg font-medium text-slate-400">Select a document to preview</p>
        <p className="text-sm text-slate-300">PDF · Word · Excel · Images · Text</p>
      </div>
    )

    const ext = selectedDoc.ext.toLowerCase()

    // ── PDF ──────────────────────────────────────────────────────────────
    if (selectedDoc.mimeType === 'application/pdf') {
      return (
        <iframe
          key={iframeKey}
          src={`/api/documents/${selectedDoc.id}`}
          className="w-full h-full border-none"
          title={selectedDoc.originalName}
        />
      )
    }

    // ── Images ───────────────────────────────────────────────────────────
    if (IMAGE_TYPES.has(selectedDoc.mimeType)) {
      return (
        <div className="h-full overflow-auto flex items-center justify-center p-8 bg-[#f4f4f4]">
          <img
            key={iframeKey}
            src={`/api/documents/${selectedDoc.id}`}
            alt={selectedDoc.originalName}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        </div>
      )
    }

    // ── Plain text / CSV / HTML / Markdown ────────────────────────────────
    if (TEXT_TYPES.has(selectedDoc.mimeType) || ext === 'csv' || ext === 'md') {
      return (
        <iframe
          key={iframeKey}
          src={`/api/documents/${selectedDoc.id}`}
          className="w-full h-full border-none bg-white"
          title={selectedDoc.originalName}
        />
      )
    }

    // ── Office / Doc files → server-side HTML conversion ─────────────────
    // doc, docx, xls, xlsx, odt, ods go to /api/documents/[id]/preview
    if (OFFICE_EXTS.has(ext)) {
      return (
        <div className="relative w-full h-full">
          {/* Loading overlay */}
          <div id="preview-loading" className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10 pointer-events-none transition-opacity duration-300">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-sm text-slate-500 font-medium">Converting document…</span>
            </div>
          </div>
          <iframe
            key={iframeKey}
            src={`/api/documents/${selectedDoc.id}/preview`}
            className="w-full h-full border-none"
            title={selectedDoc.originalName}
            onLoad={() => {
              const overlay = document.getElementById('preview-loading')
              if (overlay) overlay.style.opacity = '0'
            }}
          />
        </div>
      )
    }

    // ── Unsupported ───────────────────────────────────────────────────────
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 p-12 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-3xl shadow-inner">📄</div>
        <div>
          <p className="text-lg font-semibold text-slate-700">{selectedDoc.originalName}</p>
          <p className="text-sm text-slate-400 mt-2">
            <strong>.{ext.toUpperCase()}</strong> files cannot be previewed in the browser.
          </p>
        </div>
      </div>
    )
  }, [selectedDoc, iframeKey])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col shadow-sm">

        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-slate-800">DocFlow</span>
        </div>

        {/* Upload zone */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div
            className={`upload-dropzone rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer min-h-[96px] transition-all ${isDragging ? 'dragging scale-[0.98]' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); void handleUpload(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" multiple className="hidden" ref={fileInputRef}
              onChange={e => void handleUpload(e.target.files)} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">Uploading…</span>
              </div>
            ) : (
              <>
                <IconUpload />
                <span className="text-sm font-semibold text-slate-600">Bulk Upload</span>
                <span className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">Click or drag &amp; drop</span>
              </>
            )}
          </div>

          {error && (
            <div className="mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 flex gap-2 items-start">
              <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto py-3">
          <p className="px-5 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em]">
            Documents ({documents.length})
          </p>

          {loading && documents.length === 0
            ? Array(4).fill(0).map((_, i) => (
                <div key={i} className="mx-4 mb-2 h-14 rounded-xl bg-slate-100 animate-pulse" />
              ))
            : documents.length === 0
            ? <p className="px-5 py-8 text-sm text-slate-400 italic text-center">No documents yet.<br />Upload files to get started.</p>
            : documents.map(doc => {
                const active         = doc.id === selectedDocumentId
                const isDeleting     = deletingId === doc.id
                const confirmingDel  = confirmDeleteId === doc.id

                return (
                  <div
                    key={doc.id}
                    className={`group mx-3 mb-1 flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                      active
                        ? 'bg-indigo-50 shadow-sm border border-indigo-100'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                    onClick={() => selectDoc(doc.id)}
                  >
                    {/* File icon */}
                    <div className={`p-1.5 rounded-lg shrink-0 ${active ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                      {getFileIcon(doc.mimeType, doc.ext)}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate leading-tight ${active ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {doc.originalName}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {fmt(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Delete */}
                    <div className="shrink-0" onClick={e => e.stopPropagation()}>
                      {confirmingDel ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => void handleDelete(doc.id)}
                            disabled={isDeleting}
                            className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isDeleting ? '…' : 'Delete'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(doc.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Delete document"
                        >
                          <IconTrash />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
          }
        </div>
      </aside>

      {/* ── Main Preview ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-14 border-b border-slate-200 bg-white flex items-center px-6 gap-3 shrink-0 shadow-sm">
          {selectedDoc ? (
            <>
              <div className="shrink-0">{getFileIcon(selectedDoc.mimeType, selectedDoc.ext)}</div>
              <span className="text-sm font-semibold text-slate-800 truncate flex-1 max-w-[60vw]">
                {selectedDoc.originalName}
              </span>
              <div className="flex items-center gap-3 ml-auto shrink-0">
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-wider">
                  .{selectedDoc.ext}
                </span>
                <span className="text-xs text-slate-400">{fmt(selectedDoc.size)}</span>
              </div>
            </>
          ) : (
            <span className="text-sm text-slate-400">No document selected</span>
          )}
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-hidden bg-slate-100">
          {renderPreview()}
        </div>
      </main>
    </div>
  )
}
