import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function InfoTip({ text }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    // Position above the button, centered horizontally
    setPos({
      top: rect.top - 8, // 8px gap above button
      left: rect.left + rect.width / 2,
    })
  }, [])

  useEffect(() => {
    if (show) {
      updatePosition()
      window.addEventListener('scroll', updatePosition, true)
      return () => window.removeEventListener('scroll', updatePosition, true)
    }
  }, [show, updatePosition])

  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        ref={btnRef}
        type="button"
        className="w-4 h-4 rounded-full bg-gray-200 hover:bg-dockit-blue hover:text-white text-gray-500 text-[10px] font-bold leading-none flex items-center justify-center transition-colors cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
        aria-label="More info"
      >
        i
      </button>
      {show && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999,
            pointerEvents: 'none',
          }}
        >
          <div className="px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs w-max whitespace-normal leading-relaxed">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </div>
        </div>,
        document.body
      )}
    </span>
  )
}
