import React, { useState, useRef, useEffect } from 'react'
import { useHitSelection } from '../contexts/HitSelectionContext.jsx'

// -----------------------------------------------------------------------
// Tag configuration
// -----------------------------------------------------------------------
const TAGS = [
  {
    id: 'hit',
    label: 'Hit',
    activeClasses: 'bg-green-100 text-green-700 border-green-300',
    dotColor: 'bg-green-500',
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    id: 'investigate',
    label: 'Investigate',
    activeClasses: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    dotColor: 'bg-yellow-400',
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    id: 'discard',
    label: 'Discard',
    activeClasses: 'bg-red-100 text-red-700 border-red-300',
    dotColor: 'bg-red-400',
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
]

const INACTIVE_CLASSES = 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600'

// -----------------------------------------------------------------------
// NoteInput — an inline text area that expands on focus
// -----------------------------------------------------------------------
function NoteInput({ index, currentNote, disabled }) {
  const { setNote } = useHitSelection()
  const [expanded, setExpanded] = useState(false)
  const textareaRef = useRef(null)

  // Auto-resize textarea on content change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [currentNote, expanded])

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={disabled}
        title={currentNote ? `Note: ${currentNote}` : 'Add a note'}
        className={`flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors ${
          currentNote
            ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
            : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        {currentNote ? (
          <span className="max-w-[120px] truncate">{currentNote}</span>
        ) : (
          <span>Note</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex items-start gap-1">
      <textarea
        ref={textareaRef}
        autoFocus
        rows={2}
        value={currentNote || ''}
        onChange={(e) => setNote(index, e.target.value)}
        onBlur={() => setExpanded(false)}
        placeholder="Add a research note..."
        className="flex-1 min-w-[160px] text-xs border border-blue-300 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700 bg-white"
        style={{ minHeight: '40px', maxHeight: '120px', overflow: 'hidden' }}
      />
    </div>
  )
}

// -----------------------------------------------------------------------
// CompactDot — small colored dot for compact mode
// -----------------------------------------------------------------------
function CompactDot({ tag, isActive, onClick, dotColor }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isActive ? `Active: ${tag} (click to remove)` : `Mark as ${tag}`}
      className={`w-5 h-5 rounded-full border-2 transition-all duration-150 flex-shrink-0 ${
        isActive
          ? `${dotColor} border-current opacity-100 ring-2 ring-offset-1 ring-current`
          : 'bg-gray-100 border-gray-300 hover:border-gray-400 opacity-60 hover:opacity-100'
      }`}
    />
  )
}

// -----------------------------------------------------------------------
// HitSelector — main component
// -----------------------------------------------------------------------
/**
 * HitSelector — inline hit selection controls for a specific molecule.
 *
 * Props:
 *   index    {number}  — molecule index in results array
 *   molecule {object}  — { name, smiles, affinity, composite_score, svg }
 *   compact  {boolean} — if true, render only small colored dots (no labels)
 */
export default function HitSelector({ index, molecule, compact = false }) {
  const { selections, setTag, setNote, removeSelection } = useHitSelection()

  const selection = selections[index] ?? null
  const activeTag = selection?.tag ?? null
  const currentNote = selection?.note ?? ''

  const handleTagClick = (tagId) => {
    if (activeTag === tagId) {
      // Toggle off — same tag clicked again
      removeSelection(index)
    } else {
      setTag(index, tagId)
    }
  }

  const moleculeName = molecule?.name || molecule?.molecule_name || `Ligand ${index + 1}`

  // ---- Compact mode ----
  if (compact) {
    return (
      <div className="flex items-center gap-1.5" role="group" aria-label={`Tag ${moleculeName}`}>
        {TAGS.map((tag) => (
          <CompactDot
            key={tag.id}
            tag={tag.label}
            isActive={activeTag === tag.id}
            onClick={() => handleTagClick(tag.id)}
            dotColor={tag.dotColor}
          />
        ))}
      </div>
    )
  }

  // ---- Full mode ----
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label={`Tag ${moleculeName}`}>
      {/* Molecule name — truncated */}
      <span
        className="text-xs font-medium text-gray-600 truncate max-w-[140px] flex-shrink-0"
        title={moleculeName}
      >
        {moleculeName}
      </span>

      {/* Tag buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {TAGS.map((tag) => {
          const isActive = activeTag === tag.id
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleTagClick(tag.id)}
              title={isActive ? `Remove "${tag.label}" tag` : `Mark as ${tag.label}`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                isActive ? tag.activeClasses : INACTIVE_CLASSES
              }`}
            >
              {tag.icon}
              {tag.label}
            </button>
          )
        })}
      </div>

      {/* Note input — only enabled once a tag is set */}
      <NoteInput
        index={index}
        currentNote={currentNote}
        disabled={activeTag === null}
      />
    </div>
  )
}
