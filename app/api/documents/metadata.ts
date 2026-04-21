import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export interface StoredDocument {
  id: string
  storedName: string
  originalName: string
  uploadedAt: string
  size: number
  mimeType: string
  ext: string
}

const uploadDir = join(process.cwd(), 'uploads')
const metadataPath = join(uploadDir, 'metadata.json')

export const ensureStorage = async () => {
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true })
  }

  if (!existsSync(metadataPath)) {
    await writeFile(metadataPath, JSON.stringify([], null, 2), 'utf-8')
  }
}

export const readMetadata = async (): Promise<StoredDocument[]> => {
  await ensureStorage()
  const raw = await readFile(metadataPath, 'utf-8')
  return JSON.parse(raw) as StoredDocument[]
}

export const writeMetadata = async (docs: StoredDocument[]) => {
  await ensureStorage()
  await writeFile(metadataPath, JSON.stringify(docs, null, 2), 'utf-8')
}
