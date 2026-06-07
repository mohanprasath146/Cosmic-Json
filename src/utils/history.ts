import { openDB } from 'idb'
import type { HistoryEntry } from '../types'

const DB_NAME = 'json-viewer-history'
const STORE_NAME = 'entries'
const MAX_ENTRIES = 50

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
  },
})

function toPreview(sourceText: string): string {
  return sourceText.replace(/\s+/g, ' ').trim().slice(0, 100)
}

export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  const db = await dbPromise
  const items = (await db.getAll(STORE_NAME)) as HistoryEntry[]
  return items.sort((left, right) => right.timestamp - left.timestamp)
}

export async function saveHistoryEntry(sourceText: string): Promise<HistoryEntry[]> {
  const db = await dbPromise
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    preview: toPreview(sourceText),
    size: new Blob([sourceText]).size,
    sourceText,
  }

  await db.put(STORE_NAME, entry)
  const items = await listHistoryEntries()
  const overflow = items.slice(MAX_ENTRIES)
  await Promise.all(overflow.map((item) => db.delete(STORE_NAME, item.id)))
  return items.slice(0, MAX_ENTRIES)
}

export async function deleteHistoryEntry(id: string): Promise<HistoryEntry[]> {
  const db = await dbPromise
  await db.delete(STORE_NAME, id)
  return listHistoryEntries()
}

export async function clearHistoryEntries(): Promise<void> {
  const db = await dbPromise
  await db.clear(STORE_NAME)
}
