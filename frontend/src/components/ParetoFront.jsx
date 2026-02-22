import React, { useState, useRef, useCallback } from 'react'

// --------------------------------------------------
// Axis objectives config
// --------------------------------------------------
const OBJECTIVES = [
  { key: 'affinity',       label: 'Affinity',        description: 'Binding affinity score (0-1, higher = stronger binding)' },
  { key: 'safety',         label: 'Safety',          description: 'ADMET/toxicity safety score (0-1, higher = safer)' },
  { key: 'bioavailability',label: 'Bioavailability', description: 'Oral bioavailability score (0-1, Lipinski-based)' },
  { key: 'synthesis',      label: 'Synthesizability', description: 'Synthesis feasibility score (0-1, higher = easier to make)' },
]

// --------------------------------------------------
// Chart layout constants
// --------------------------------------------------
const VIEWBOX_W   = 480
const VIEWBOX_H   = 380
const PAD_LEFT    = 54
const PAD_RIGHT   = 20
const PAD_TOP     = 20
const PAD_BOTTOM  = 52
const PLOT_W      = VIEWBOX_W - PAD_LEFT - PAD_RIGHT
const PLOT_H      = VIEWBOX_H - PAD_TOP  - PAD_BOTTOM
const TICK_COUNT  = 5

// --------------------------------------------------
// Map a [0,1] value to pixel coords within the plot
// --------------------------------------------------
function toX(v) {
  const clamped = Math.max(0, Math.min(1, v ?? 0))
  return PAD_LEFT + clamped * PLOT_W
}

function toY(v) {
  const clamped = Math.max(0, Math.min(1, v ?? 0))
  // SVG Y-axis is inverted: 0 at top, so we invert
  return PAD_TOP + (1 - clamped) * PLOT_H
}

// --------------------------------------------------
// Tooltip component rendered in SVG via foreignObject
// --------------------------------------------------
function Tooltip({ mol, xKey, yKey, svgX, svgY }) {
  if (!mol) return null

  const objectives = mol.pareto_objectives || {}
  const W = 170
  const H = 110
  // Clamp so tooltip stays within viewBox
  let tx = svgX + 12
  let ty = svgY - H / 2
  if (tx + W > VIEWBOX_W - 4) tx = svgX - W - 12
  if (ty < PAD_TOP) ty = PAD_TOP
  if (ty + H > VIEWBOX_H - 4) ty = VIEWBOX_H - H - 4

  return (
    <foreignObject x={tx} y={ty} width={W} height={H} style={{ overflow: 'visible', pointerEvents: 'none' }}>
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          background: '#1e3a5f',
          color: '#fff',
          borderRadius: '8px',
          padding: '8px 10px',
          fontSize: '11px',
          lineHeight: '1.5',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          width: `${W}px`,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '4px', color: '#22c55e', fontSize: '12px' }}>
          {mol.name || 'Molecule'}
        </div>
        {mol.pareto_front && (
          <div style={{ color: '#86efac', fontSize: '10px', marginBottom: '3px' }}>
            Pareto front — rank {mol.pareto_rank ?? '?'}
          </div>
        )}
        {OBJECTIVES.map(({ key, label }) => {
          const val = objectives[key]
          return (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
              <span style={{ opacity: 0.75 }}>{label}</span>
              <span style={{ fontWeight: 600 }}>
                {val !== undefined && val !== null ? Number(val).toFixed(3) : 'N/A'}
              </span>
            </div>
          )
        })}
      </div>
    </foreignObject>
  )
}

// --------------------------------------------------
// Grid lines
// --------------------------------------------------
function GridLines() {
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => i / TICK_COUNT)
  return (
    <g>
      {ticks.map((t) => {
        const x = toX(t)
        const y = toY(t)
        return (
          <g key={t}>
            {/* Vertical grid line */}
            <line
              x1={x} y1={PAD_TOP}
              x2={x} y2={PAD_TOP + PLOT_H}
              stroke="#e5e7eb"
              strokeWidth={t === 0 || t === 1 ? 1.5 : 0.75}
              strokeDasharray={t === 0 || t === 1 ? '0' : '3,3'}
            />
            {/* Horizontal grid line */}
            <line
              x1={PAD_LEFT} y1={y}
              x2={PAD_LEFT + PLOT_W} y2={y}
              stroke="#e5e7eb"
              strokeWidth={t === 0 || t === 1 ? 1.5 : 0.75}
              strokeDasharray={t === 0 || t === 1 ? '0' : '3,3'}
            />
            {/* X axis tick label */}
            <text
              x={x} y={PAD_TOP + PLOT_H + 16}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
            >
              {t.toFixed(1)}
            </text>
            {/* Y axis tick label */}
            <text
              x={PAD_LEFT - 8} y={y + 3.5}
              textAnchor="end"
              fontSize={9}
              fill="#9ca3af"
            >
              {t.toFixed(1)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// --------------------------------------------------
// Pareto front connecting dashed line
// --------------------------------------------------
function ParetoLine({ paretoMols, xKey, yKey }) {
  if (paretoMols.length < 2) return null

  // Sort by X for the line to connect them left-to-right
  const sorted = [...paretoMols].sort((a, b) => {
    const ax = (a.pareto_objectives || {})[xKey] ?? 0
    const bx = (b.pareto_objectives || {})[xKey] ?? 0
    return ax - bx
  })

  const points = sorted
    .map((m) => {
      const objectives = m.pareto_objectives || {}
      const x = toX(objectives[xKey] ?? 0)
      const y = toY(objectives[yKey] ?? 0)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <polyline
      points={points}
      fill="none"
      stroke="#22c55e"
      strokeWidth={1.5}
      strokeDasharray="5,4"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.7}
    />
  )
}

// --------------------------------------------------
// Main ParetoFront component
// --------------------------------------------------
export default function ParetoFront({ molecules, onSelect }) {
  const [xKey, setXKey] = useState('affinity')
  const [yKey, setYKey] = useState('safety')
  const [hovered, setHovered]     = useState(null)
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 })
  const svgRef = useRef(null)

  const mols = (molecules || []).filter(
    (m) => m.pareto_objectives && typeof m.pareto_objectives === 'object'
  )

  const paretoMols    = mols.filter((m) => m.pareto_front === true)
  const nonParetoMols = mols.filter((m) => m.pareto_front !== true)
  const paretoCount   = paretoMols.length

  const handleMouseEnter = useCallback((mol, svgX, svgY) => {
    setHovered(mol)
    setHoveredPos({ x: svgX, y: svgY })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHovered(null)
  }, [])

  const handleClick = useCallback((mol) => {
    if (onSelect) onSelect(mol)
  }, [onSelect])

  if (!mols.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-300">
        <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm">No Pareto data available</p>
      </div>
    )
  }

  const xLabel = OBJECTIVES.find((o) => o.key === xKey)?.label || xKey
  const yLabel = OBJECTIVES.find((o) => o.key === yKey)?.label || yKey

  return (
    <div className="space-y-3">
      {/* Axis selectors */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">X axis:</label>
          <select
            value={xKey}
            onChange={(e) => setXKey(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-dockit-blue"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Y axis:</label>
          <select
            value={yKey}
            onChange={(e) => setYKey(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-dockit-blue"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
        {paretoCount > 0 && (
          <span className="ml-auto text-xs text-gray-400">
            <span className="font-semibold text-dockit-green">{paretoCount}</span> non-dominated solution{paretoCount !== 1 ? 's' : ''} on Pareto front
          </span>
        )}
      </div>

      {/* SVG chart */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          className="w-full"
          style={{ display: 'block' }}
        >
          {/* White background */}
          <rect x={0} y={0} width={VIEWBOX_W} height={VIEWBOX_H} fill="#fff" />

          {/* Plot area background */}
          <rect
            x={PAD_LEFT} y={PAD_TOP}
            width={PLOT_W} height={PLOT_H}
            fill="#f9fafb"
            rx={4}
          />

          {/* Grid */}
          <GridLines />

          {/* Pareto front connecting line (drawn before dots) */}
          <ParetoLine paretoMols={paretoMols} xKey={xKey} yKey={yKey} />

          {/* Non-pareto dots */}
          {nonParetoMols.map((mol, idx) => {
            const objectives = mol.pareto_objectives || {}
            const cx = toX(objectives[xKey] ?? 0)
            const cy = toY(objectives[yKey] ?? 0)
            const isHovered = hovered === mol
            return (
              <circle
                key={mol.name || idx}
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 4.5}
                fill={isHovered ? '#6b7280' : '#9ca3af'}
                fillOpacity={isHovered ? 0.9 : 0.5}
                stroke={isHovered ? '#4b5563' : 'none'}
                strokeWidth={1.5}
                style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'r 0.1s' }}
                onMouseEnter={() => handleMouseEnter(mol, cx, cy)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(mol)}
              />
            )
          })}

          {/* Pareto front dots (on top) */}
          {paretoMols.map((mol, idx) => {
            const objectives = mol.pareto_objectives || {}
            const cx = toX(objectives[xKey] ?? 0)
            const cy = toY(objectives[yKey] ?? 0)
            const isHovered = hovered === mol
            return (
              <g key={mol.name || `pareto-${idx}`}>
                {/* Outer glow ring */}
                <circle
                  cx={cx} cy={cy} r={isHovered ? 12 : 9}
                  fill="#22c55e"
                  fillOpacity={0.15}
                />
                {/* Main dot */}
                <circle
                  cx={cx} cy={cy}
                  r={isHovered ? 8 : 6.5}
                  fill="#22c55e"
                  stroke="#fff"
                  strokeWidth={1.5}
                  style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'r 0.1s' }}
                  onMouseEnter={() => handleMouseEnter(mol, cx, cy)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleClick(mol)}
                />
                {/* Pareto rank label */}
                {mol.pareto_rank !== undefined && mol.pareto_rank !== null && (
                  <text
                    x={cx} y={cy + 3.5}
                    textAnchor="middle"
                    fontSize={7}
                    fontWeight={700}
                    fill="#fff"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {mol.pareto_rank}
                  </text>
                )}
              </g>
            )
          })}

          {/* Axis labels */}
          <text
            x={PAD_LEFT + PLOT_W / 2}
            y={VIEWBOX_H - 6}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="#374151"
          >
            {xLabel}
          </text>
          <text
            x={12}
            y={PAD_TOP + PLOT_H / 2}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="#374151"
            transform={`rotate(-90, 12, ${PAD_TOP + PLOT_H / 2})`}
          >
            {yLabel}
          </text>

          {/* Tooltip */}
          {hovered && (
            <Tooltip
              mol={hovered}
              xKey={xKey}
              yKey={yKey}
              svgX={hoveredPos.x}
              svgY={hoveredPos.y}
            />
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 text-xs text-gray-500 px-1">
        <div className="flex items-center gap-2">
          <svg width={24} height={12}>
            <circle cx={6} cy={6} r={5} fill="#22c55e" stroke="#fff" strokeWidth={1.5} />
            <line x1={10} y1={6} x2={22} y2={6} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="3,2" />
          </svg>
          <span>Pareto front (non-dominated)</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width={14} height={12}>
            <circle cx={6} cy={6} r={4} fill="#9ca3af" fillOpacity={0.5} />
          </svg>
          <span>Dominated solution</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <span>Click a point to select molecule</span>
        </div>
      </div>
    </div>
  )
}
