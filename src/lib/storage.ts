import { normalizeDraft, type PosterDraft } from "@/lib/draft"
import type { PhotoSlot } from "@/lib/poster-geom"

const DRAFT_KEY = "icasas-cartaz-draft-v2"
const DB_NAME = "icasas-cartaz"
const STORE = "kv"
const PHOTO_KEY = "photos"

export type PhotoMap = Record<PhotoSlot, string | null>

export function loadDraft(): PosterDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return normalizeDraft(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveDraft(draft: PosterDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* quota or private mode */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadPhotos(): Promise<PhotoMap | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      const req = tx.objectStore(STORE).get(PHOTO_KEY)
      req.onsuccess = () => {
        const value = req.result as PhotoMap | undefined
        if (!value) {
          resolve(null)
          return
        }
        resolve({
          hero: typeof value.hero === "string" ? value.hero : null,
          left: typeof value.left === "string" ? value.left : null,
          right: typeof value.right === "string" ? value.right : null,
        })
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function savePhotos(photos: PhotoMap) {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).put(photos, PHOTO_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* keep the session copy */
  }
}
