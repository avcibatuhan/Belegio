import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  allReceipts,
  deleteReceipt,
  saveReceipt,
  clearReceipts,
  type StoredReceipt,
} from './db'

/**
 * A single source of truth for the receipt list.
 *
 * Every page subscribes to this, so deleting a receipt in the archive updates
 * the dashboard KPIs immediately without either page knowing about the other.
 */

let receipts: StoredReceipt[] = []
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  // A new array identity is required for useSyncExternalStore to see the change.
  receipts = [...receipts]
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return receipts
}

/** Loads from IndexedDB once; subsequent calls are no-ops unless forced. */
export async function loadReceipts(force = false): Promise<void> {
  if (loaded && !force) return
  receipts = await allReceipts()
  loaded = true
  listeners.forEach((l) => l())
}

export async function addReceipt(receipt: StoredReceipt): Promise<void> {
  await saveReceipt(receipt)
  receipts = [receipt, ...receipts.filter((r) => r.id !== receipt.id)]
  emit()
}

export async function updateReceipt(
  id: string,
  patch: Partial<StoredReceipt>,
): Promise<StoredReceipt | undefined> {
  const current = receipts.find((r) => r.id === id)
  if (!current) return undefined

  const next = { ...current, ...patch }
  await saveReceipt(next)
  receipts = receipts.map((r) => (r.id === id ? next : r))
  emit()
  return next
}

export async function removeReceipt(id: string): Promise<void> {
  await deleteReceipt(id)
  receipts = receipts.filter((r) => r.id !== id)
  emit()
}

export async function removeReceipts(ids: Iterable<string>): Promise<void> {
  const set = new Set(ids)
  for (const id of set) await deleteReceipt(id)
  receipts = receipts.filter((r) => !set.has(r.id))
  emit()
}

export async function removeAllReceipts(): Promise<void> {
  await clearReceipts()
  receipts = []
  emit()
}

/** Subscribes a component to the receipt list. */
export function useReceipts(): StoredReceipt[] {
  const rows = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    void loadReceipts()
  }, [])
  return rows
}

/** Marks receipts as verified — used by the bulk action in the archive. */
export function useReceiptActions() {
  const markVerified = useCallback(async (ids: Iterable<string>) => {
    for (const id of new Set(ids)) {
      await updateReceipt(id, { status: 'geprueft' })
    }
  }, [])

  const setCategory = useCallback(async (ids: Iterable<string>, category: string) => {
    for (const id of new Set(ids)) {
      await updateReceipt(id, { category })
    }
  }, [])

  return { markVerified, setCategory }
}
