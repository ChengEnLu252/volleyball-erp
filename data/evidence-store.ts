// ============================================================
// data/evidence-store.ts — 上傳憑證的 IndexedDB Blob 儲存
// ============================================================
// 階段 8 新增。專門存「真實檔案」(Blob)，與 data/store.ts 分離：
//
//   - data/store.ts → localStorage（meta 與小型 JSON diff）
//   - data/evidence-store.ts → IndexedDB（圖片 Blob 本體）
//
// 用 id 串：meta.id === IndexedDB key。
//
// 設計選擇：
//   1. 用 IndexedDB 而非 localStorage base64：圖片很容易撞 5MB ceiling
//   2. 不用第三方 lib（idb / dexie）：薄到不值得 +dep
//   3. SSR-safe：所有 entry function 都先檢查 `typeof window`
//   4. 容錯：cursor 取 keys 用 fallback（舊 Safari 沒 getAllKeys）
//
// ============================================================

const DB_NAME    = 'volleyops-evidence-v1'
const DB_VERSION = 1
const STORE_NAME = 'blobs'

/** 開 DB（lazy；同一個 tab 內只開一次）*/
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('evidence-store: window not available (SSR)'))
  }
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('evidence-store: IndexedDB not supported'))
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
  // 開失敗時清掉 cache，下次可重試
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

/** 內部：把 IDBRequest 包成 Promise */
function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IDBRequest failed'))
  })
}

// ── public API ───────────────────────────────────────────────

/** 寫入一個 blob，key 由 caller 指定（為了與 meta.id 同步）*/
export async function putEvidence(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('put transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('put transaction aborted'))
  })
}

/** 取一個 blob；找不到回 null */
export async function getEvidence(id: string): Promise<Blob | null> {
  const db = await openDb()
  const result = await reqAsPromise<Blob | undefined>(
    db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id),
  )
  return result ?? null
}

/**
 * 取一個 blob 的 object URL（caller 須在 unmount 時呼叫
 * URL.revokeObjectURL 釋放）。找不到回 null。
 */
export async function getEvidenceObjectUrl(id: string): Promise<string | null> {
  const blob = await getEvidence(id)
  if (!blob) return null
  return URL.createObjectURL(blob)
}

/** 刪掉一個 blob。不存在不報錯 */
export async function deleteEvidence(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('delete transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('delete transaction aborted'))
  })
}

/** 列出所有 key（debug / migration 用）*/
export async function listEvidenceKeys(): Promise<string[]> {
  const db = await openDb()
  const store: IDBObjectStore = db
    .transaction(STORE_NAME, 'readonly')
    .objectStore(STORE_NAME)
  // 用 getAllKeys 一發；現代瀏覽器都支援，舊 Safari 退 cursor
  // 用 typeof check 而非 `in store`，避免 TS 把 else 分支 narrow 成 never
  if (typeof store.getAllKeys === 'function') {
    const keys = await reqAsPromise<IDBValidKey[]>(store.getAllKeys())
    return keys.map(k => String(k))
  }
  return new Promise((resolve, reject) => {
    const result: string[] = []
    const req = store.openKeyCursor()
    req.onerror = () => reject(req.error ?? new Error('cursor failed'))
    req.onsuccess = () => {
      const cur = req.result
      if (cur) { result.push(String(cur.key)); cur.continue() }
      else resolve(result)
    }
  })
}

/** 清空所有 evidence（demo reset 用）*/
export async function clearAllEvidence(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('clear transaction failed'))
  })
}

/** 是否可用（給 UI 在 SSR / 不支援 IndexedDB 環境下優雅降級）*/
export function isEvidenceStoreAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window
}
