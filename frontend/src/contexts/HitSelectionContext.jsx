import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const HitSelectionContext = createContext(null)

/**
 * State shape:
 * {
 *   [ligandIndex: number]: { tag: 'hit' | 'investigate' | 'discard', note: string }
 * }
 *
 * localStorage key: dockit_hits_${jobId}
 */

/**
 * HitSelectionProvider — persists molecule hit tagging to localStorage.
 * @param {string} jobId - The job whose hits are being managed
 * @param {React.ReactNode} children
 */
export function HitSelectionProvider({ jobId, children }) {
  const storageKey = jobId ? `dockit_hits_${jobId}` : null

  // Load initial state from localStorage
  const [selections, setSelections] = useState(() => {
    if (!storageKey) return {}
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  // Persist to localStorage on every change
  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(selections))
    } catch (err) {
      console.warn('[HitSelectionContext] localStorage write failed:', err)
    }
  }, [selections, storageKey])

  // Re-load from localStorage when jobId changes (switching jobs)
  useEffect(() => {
    if (!storageKey) {
      setSelections({})
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      setSelections(raw ? JSON.parse(raw) : {})
    } catch {
      setSelections({})
    }
  }, [storageKey])

  /**
   * Set the tag for a molecule by its index in results.
   * @param {number} idx
   * @param {'hit' | 'investigate' | 'discard'} tag
   */
  const setTag = useCallback((idx, tag) => {
    setSelections(prev => ({
      ...prev,
      [idx]: {
        tag,
        note: prev[idx]?.note ?? '',
      },
    }))
  }, [])

  /**
   * Set the note for a molecule by its index.
   * @param {number} idx
   * @param {string} note
   */
  const setNote = useCallback((idx, note) => {
    setSelections(prev => ({
      ...prev,
      [idx]: {
        tag: prev[idx]?.tag ?? 'investigate',
        note,
      },
    }))
  }, [])

  /**
   * Remove a molecule's selection entirely.
   * @param {number} idx
   */
  const removeSelection = useCallback((idx) => {
    setSelections(prev => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
  }, [])

  /**
   * Get all selected indices, optionally filtered by tag.
   * @param {'hit' | 'investigate' | 'discard' | undefined} tag - if omitted, returns all tagged indices
   * @returns {number[]} Array of molecule indices
   */
  const getSelected = useCallback((tag) => {
    return Object.entries(selections)
      .filter(([, val]) => (tag ? val.tag === tag : true))
      .map(([idx]) => Number(idx))
  }, [selections])

  /**
   * Clear all hit selections for this job.
   */
  const clearAll = useCallback(() => {
    setSelections({})
  }, [])

  /**
   * Returns a count breakdown: { hit: N, investigate: N, discard: N, total: N }
   */
  const getTagCount = useCallback(() => {
    const counts = { hit: 0, investigate: 0, discard: 0, total: 0 }
    Object.values(selections).forEach(({ tag }) => {
      if (tag in counts) counts[tag]++
      counts.total++
    })
    return counts
  }, [selections])

  const value = {
    selections,
    setTag,
    setNote,
    removeSelection,
    getSelected,
    clearAll,
    getTagCount,
  }

  return (
    <HitSelectionContext.Provider value={value}>
      {children}
    </HitSelectionContext.Provider>
  )
}

/**
 * useHitSelection — access hit selection state and methods.
 * Must be used inside a HitSelectionProvider.
 */
export function useHitSelection() {
  const ctx = useContext(HitSelectionContext)
  if (!ctx) throw new Error('useHitSelection must be used within a HitSelectionProvider')
  return ctx
}

export default HitSelectionContext
