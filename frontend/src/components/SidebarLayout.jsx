import React from 'react'
import { Outlet, NavLink, useParams, useLocation } from 'react-router-dom'
import { ProjectProvider, useProject } from '../contexts/ProjectContext.jsx'
import { HitSelectionProvider } from '../contexts/HitSelectionContext.jsx'

// ---------------------------------------------------------------------------
// SVG icon set
// ---------------------------------------------------------------------------

function IconProject() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function IconTarget() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
      <circle cx="12" cy="12" r="5" strokeWidth={1.8} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" strokeWidth={0} />
      <line x1="12" y1="3" x2="12" y2="6" strokeWidth={1.8} strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="21" strokeWidth={1.8} strokeLinecap="round" />
      <line x1="3" y1="12" x2="6" y2="12" strokeWidth={1.8} strokeLinecap="round" />
      <line x1="18" y1="12" x2="21" y2="12" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  )
}

function IconRuns() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M4 6h16M4 10h16M4 14h10M4 18h6" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 14l3 3-3 3" />
    </svg>
  )
}

function IconResults() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function IconOptimization() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  )
}

function IconReports() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Sub-nav items for a project
// ---------------------------------------------------------------------------

function buildSubNavItems(projectId, isTargetConfigured) {
  const base = `/project/${projectId}`
  const targetTo = `${base}/target`

  return [
    { label: 'Target Setup',  icon: <IconTarget />,       to: targetTo,                 disabled: false },
    { label: 'Runs',          icon: <IconRuns />,         to: isTargetConfigured ? `${base}/runs` : targetTo,           disabled: !isTargetConfigured, guardedTo: targetTo },
    { label: 'Results',       icon: <IconResults />,      to: isTargetConfigured ? `${base}/results` : targetTo,        disabled: !isTargetConfigured, guardedTo: targetTo },
    { label: 'Optimization',  icon: <IconOptimization />, to: isTargetConfigured ? `${base}/optimization` : targetTo,   disabled: !isTargetConfigured, guardedTo: targetTo },
    { label: 'Reports',       icon: <IconReports />,      to: isTargetConfigured ? `${base}/reports` : targetTo,        disabled: !isTargetConfigured, guardedTo: targetTo },
  ]
}

// ---------------------------------------------------------------------------
// Project tree node — project name + nested sub-items
// ---------------------------------------------------------------------------

function ProjectTreeNode({ projectId, isTargetConfigured }) {
  const { project } = useProject()
  const name = project?.name || 'Loading...'
  const uniprotId = project?.uniprot_id
  const base = `/project/${projectId}`
  const subItems = buildSubNavItems(projectId, isTargetConfigured)

  const subNavClass = (item, isActive) =>
    [
      'flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors duration-150',
      item.disabled
        ? 'text-white/25 cursor-default'
        : isActive
          ? 'bg-white/10 text-white font-medium'
          : 'text-white/55 hover:text-white hover:bg-white/5',
    ].join(' ')

  return (
    <div>
      {/* Project overview link — acts as the "parent" node */}
      <NavLink
        to={`${base}/overview`}
        className={({ isActive }) =>
          [
            'flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-colors duration-150',
            isActive
              ? 'bg-white/10 text-white font-semibold'
              : 'text-white/80 hover:text-white hover:bg-white/5',
          ].join(' ')
        }
      >
        <IconProject />
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium leading-tight">{name}</p>
          {uniprotId && (
            <p className="text-white/40 font-mono text-[10px] truncate mt-0.5">{uniprotId}</p>
          )}
        </div>
      </NavLink>

      {/* Sub-items — visually nested under the project */}
      <div className="ml-4 border-l border-white/10 pl-2 mt-0.5 space-y-0.5">
        {subItems.map((item) => {
          if (item.disabled) {
            return (
              <NavLink
                key={item.label}
                to={item.guardedTo || item.to}
                className={() => subNavClass(item, false)}
                title="Configure target first"
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                <svg className="w-3 h-3 shrink-0 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </NavLink>
            )
          }
          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => subNavClass(item, isActive)}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inner layout — the actual sidebar + content rendering
// ---------------------------------------------------------------------------

function SidebarLayoutInner() {
  const { projectId } = useParams()
  const location = useLocation()

  // Safely read isTargetConfigured — may not be in a ProjectProvider
  let isTargetConfigured = false
  try {
    const ctx = useProject()
    isTargetConfigured = ctx.isTargetConfigured
  } catch {
    // Not inside ProjectProvider — leave false
  }

  // Sub-items for mobile (flat list)
  const mobileSubItems = projectId ? buildSubNavItems(projectId, isTargetConfigured) : []

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 bg-[#1e3a5f] shrink-0">

        {/* Top: DockIt branding + "All Projects" link */}
        <div className="px-3 py-4 border-b border-white/10">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors duration-150',
                isActive && !projectId
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              ].join(' ')
            }
          >
            <IconProject />
            <span>All Projects</span>
          </NavLink>
        </div>

        {/* Project tree — only shown when a project is selected */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Project navigation">
          {projectId ? (
            <ProjectTreeNode
              projectId={projectId}
              isTargetConfigured={isTargetConfigured}
            />
          ) : (
            <p className="px-3 text-white/30 text-xs italic">Select a project to begin</p>
          )}
        </nav>

        {/* DockIt branding at bottom */}
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-white/20 text-xs">DockIt v8.0.0</p>
        </div>
      </aside>

      {/* Mobile horizontal nav */}
      <div className="md:hidden fixed top-16 inset-x-0 z-40 bg-[#1e3a5f] border-b border-white/10">
        <nav className="flex items-center justify-around px-2 py-1.5" aria-label="Main navigation (mobile)">
          <NavLink to="/" end className={({ isActive }) =>
            ['p-2 rounded-lg transition-colors duration-150', isActive && !projectId ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'].join(' ')
          }>
            <IconProject />
          </NavLink>
          {mobileSubItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.disabled ? (item.guardedTo || item.to) : item.to}
              title={item.label}
              className={({ isActive }) =>
                [
                  'p-2 rounded-lg transition-colors duration-150',
                  item.disabled
                    ? 'text-white/15'
                    : isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/5',
                ].join(' ')
              }
            >
              {item.icon}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Content area */}
      <main className="flex-1 min-w-0 bg-dockit-gray">
        {/* Mobile spacer for fixed top nav */}
        <div className="md:hidden h-12" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SidebarLayout — wraps with providers when projectId is present
// ---------------------------------------------------------------------------

export default function SidebarLayout() {
  const { projectId } = useParams()

  if (projectId) {
    return (
      <ProjectProvider>
        <SidebarLayoutInner />
      </ProjectProvider>
    )
  }

  // No projectId — render without providers (Project list screen, legacy routes, etc.)
  return <SidebarLayoutInner />
}
