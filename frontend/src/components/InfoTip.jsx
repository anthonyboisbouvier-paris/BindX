import React, { useState } from 'react'

export default function InfoTip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-gray-200 hover:bg-dockit-blue hover:text-white text-gray-500 text-[10px] font-bold leading-none flex items-center justify-center transition-colors cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
        aria-label="More info"
      >
        i
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs w-max whitespace-normal leading-relaxed pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </span>
  )
}
