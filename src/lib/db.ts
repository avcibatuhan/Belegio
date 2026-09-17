import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ReceiptStatus } from '../components/StatusChip'

export type StoredReceipt = {
  id: string
  merchant: string
  note: string
  /** ISO yyyy-mm-dd */
  date: string
  category: string
  vatRate: number
  net: number
  vatAmount: number
  gross: number
  status: ReceiptStatus
  /** Per-field OCR confidence, kept so the review screen can flag weak reads. */
  confidence: {
    merchant: number
    date: number
    gross: number
    vatRate: number
    overall: number
  }
  arithmeticValid: boolean
  rawText: string
  /** Original scan, stored locally so it never leaves the machine. */
  image: Blob
  createdAt: number
}

interface BelegioDB extends DBSchema {
  receipts: {
    key: string
    value: StoredReceipt
    indexes: { 'by-date': string; 'by-status': string }
  }
}

let dbPromise: Promise<IDBPDatabase<BelegioDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<BelegioDB>('belegio', 1, {
      upgrade(db) {
        const store = db.createObjectStore('receipts', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-status', 'status')
      },
    })
  }
  return dbPromise
}

export async function saveReceipt(receipt: StoredReceipt): Promise<void> {
  const db = await getDb()
  await db.put('receipts', receipt)
}

/** All receipts, newest first. */
export async function allReceipts(): Promise<StoredReceipt[]> {
  const db = await getDb()
  const rows = await db.getAll('receipts')
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getReceipt(id: string): Promise<StoredReceipt | undefined> {
  const db = await getDb()
  return db.get('receipts', id)
}

export async function deleteReceipt(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('receipts', id)
}

export async function clearReceipts(): Promise<void> {
  const db = await getDb()
  await db.clear('receipts')
}
