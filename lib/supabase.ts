/**
 * lib/supabase.ts
 * Supabase client — works in both API routes and edge functions.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL   = https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  = eyJ...  (service role — server only, never expose to client)
 *
 * Supabase setup (one-time, in Supabase dashboard SQL editor):
 * ─────────────────────────────────────────────────────────────
 *   CREATE TABLE documents (
 *     id            TEXT PRIMARY KEY,
 *     original_name TEXT NOT NULL,
 *     stored_name   TEXT NOT NULL,
 *     uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     size          BIGINT NOT NULL,
 *     mime_type     TEXT NOT NULL,
 *     ext           TEXT NOT NULL
 *   );
 *
 * Storage bucket (in Supabase dashboard → Storage → New bucket):
 *   Name: docflow-files
 *   Public: false  (files served through our API, not directly)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  )
}

// Service-role client — full access, server-side only
export const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

export const BUCKET = 'docflow-files'

// ── Document record type ──────────────────────────────────────────────────────
export interface DocRow {
  id:           string
  originalName: string
  storedName:   string
  uploadedAt:   string
  size:         number
  mimeType:     string
  ext:          string
}

// ── Database helpers ──────────────────────────────────────────────────────────
export const docDb = {

  async getAll(): Promise<DocRow[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('uploaded_at', { ascending: false })
    if (error) throw error
    return (data || []).map(toDocRow)
  },

  async getById(id: string): Promise<DocRow | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toDocRow(data) : null
  },

  async insert(doc: DocRow): Promise<void> {
    const { error } = await supabase.from('documents').insert({
      id:            doc.id,
      original_name: doc.originalName,
      stored_name:   doc.storedName,
      uploaded_at:   doc.uploadedAt,
      size:          doc.size,
      mime_type:     doc.mimeType,
      ext:           doc.ext,
    })
    if (error) throw error
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) throw error
  },
}

// ── Storage helpers ───────────────────────────────────────────────────────────
export const docStorage = {

  /** Upload a file buffer to Supabase Storage */
  async upload(storedName: string, buffer: Buffer, mimeType: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storedName, buffer, {
        contentType: mimeType,
        upsert: false,
      })
    if (error) throw error
  },

  /** Download a file as a Buffer */
  async download(storedName: string): Promise<Buffer> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storedName)
    if (error) throw error
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  },

  /** Delete a file from storage */
  async remove(storedName: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([storedName])
    if (error) throw error
  },
}

// ── Row mapper ────────────────────────────────────────────────────────────────
function toDocRow(row: Record<string, any>): DocRow {
  return {
    id:           row.id,
    originalName: row.original_name,
    storedName:   row.stored_name,
    uploadedAt:   row.uploaded_at,
    size:         row.size,
    mimeType:     row.mime_type,
    ext:          row.ext,
  }
}
