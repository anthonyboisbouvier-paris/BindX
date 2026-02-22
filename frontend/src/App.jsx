import React, { useState, useEffect, useRef } from 'react'
import InputForm from './components/InputForm.jsx'
import ProgressBar from './components/ProgressBar.jsx'
import PipelineSummary from './components/PipelineSummary.jsx'
import ResultsDashboard from './components/ResultsDashboard.jsx'
import Viewer3D from './components/Viewer3D.jsx'
import ResultsTable from './components/ResultsTable.jsx'
import MoleculeCard from './components/MoleculeCard.jsx'
import DownloadButtons from './components/DownloadButtons.jsx'
import GeneratedMols from './components/GeneratedMols.jsx'
import MethodologyPage from './components/MethodologyPage.jsx'
import OptimizationView from './components/OptimizationView.jsx'
import InteractionView from './components/InteractionView.jsx'
import ClusterView from './components/ClusterView.jsx'
import InfoTip from './components/InfoTip.jsx'
import { checkHealth } from './api.js'

// --------------------------------------------------
// Logo SVG
// --------------------------------------------------
function DockItLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#1e3a5f" />
      <circle cx="20" cy="15" r="6" fill="none" stroke="#22c55e" strokeWidth="2.5" />
      <circle cx="10" cy="29" r="3.5" fill="none" stroke="#22c55e" strokeWidth="2" />
      <circle cx="30" cy="29" r="3.5" fill="none" stroke="#22c55e" strokeWidth="2" />
      <line x1="20" y1="21" x2="10" y2="29" stroke="#22c55e" strokeWidth="1.8" />
      <line x1="20" y1="21" x2="30" y2="29" stroke="#22c55e" strokeWidth="1.8" />
      <circle cx="20" cy="15" r="2.5" fill="#22c55e" />
      <circle cx="10" cy="29" r="2" fill="#22c55e" />
      <circle cx="30" cy="29" r="2" fill="#22c55e" />
    </svg>
  )
}

// --------------------------------------------------
// Header
// --------------------------------------------------
function Header({ currentView, onReset, onMethodology }) {
  return (
    <header className="bg-dockit-blue shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + title */}
          <button
            onClick={onReset}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none"
            title="Back to home"
          >
            <DockItLogo size={36} />
            <div>
              <span className="text-white font-bold text-xl leading-none tracking-tight">DockIt</span>
              <p className="text-white/50 text-xs leading-none mt-0.5 hidden sm:block">
                The molecular docking platform
              </p>
            </div>
          </button>

          {/* Nav + view indicator */}
          <div className="flex items-center gap-3">
            {/* V5: Methodology link */}
            <button
              onClick={onMethodology}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                currentView === 'methodology'
                  ? 'bg-dockit-green text-white font-semibold'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Methodology
            </button>

            {(currentView === 'results' || currentView === 'summary' || currentView === 'clusters') && (
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Analysis
              </button>
            )}

            {/* Pipeline steps dots */}
            <div className="flex items-center gap-1.5 text-white/60 text-sm">
              <span className={`w-2 h-2 rounded-full ${currentView === 'input' ? 'bg-dockit-green' : 'bg-white/20'}`} />
              <span className={`w-2 h-2 rounded-full ${currentView === 'progress' ? 'bg-dockit-green animate-pulse' : 'bg-white/20'}`} />
              <span className={`w-2 h-2 rounded-full ${currentView === 'summary' ? 'bg-dockit-green animate-pulse' : 'bg-white/20'}`} />
              <span className={`w-2 h-2 rounded-full ${currentView === 'results' ? 'bg-dockit-green' : 'bg-white/20'}`} />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

// --------------------------------------------------
// Backend status badge
// --------------------------------------------------
function BackendStatus() {
  const [status, setStatus] = useState('checking') // checking | ok | error

  useEffect(() => {
    checkHealth()
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'))
  }, [])

  if (status === 'ok') return null // Don't show when healthy

  return (
    <div className={`text-center py-2 text-xs font-medium ${
      status === 'checking'
        ? 'bg-yellow-50 text-yellow-700 border-b border-yellow-100'
        : 'bg-red-50 text-red-700 border-b border-red-100'
    }`}>
      {status === 'checking'
        ? 'Checking backend connection...'
        : 'Backend unavailable at http://localhost:8000 - Analyses will not work.'
      }
    </div>
  )
}

// --------------------------------------------------
// Results view — full table + 3D viewer
// --------------------------------------------------
function ResultsView({ jobId, results, initialPoseIndex, onBack }) {
  const [selectedPoseIndex, setSelectedPoseIndex] = useState(
    initialPoseIndex !== null && initialPoseIndex !== undefined ? initialPoseIndex : null
  )

  const handlePoseSelect = (idx) => {
    setSelectedPoseIndex(idx !== null ? parseInt(idx) : null)
  }

  const selectedMolecule = selectedPoseIndex !== null
    ? results?.results?.[selectedPoseIndex]
    : null

  const uniprotId = results?.uniprot_id || jobId
  const totalTested = results?.results?.length || 0
  const topAffinity = results?.results?.[0]?.affinity ?? results?.results?.[0]?.affinity_kcal

  return (
    <div className="space-y-6">
      {/* Results summary banner */}
      <div className="bg-dockit-blue rounded-xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {/* Back to dashboard link */}
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 mb-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors w-fit"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to dashboard
              </button>
            )}
            <h2 className="text-2xl font-bold mb-1">
              Screening Results
              <span className="ml-2 text-dockit-green font-mono">{uniprotId}</span>
            </h2>
            <p className="text-white/60 text-sm">
              {totalTested} ligands tested — Top 10 shown below
            </p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-dockit-green">
                {topAffinity ? Number(topAffinity).toFixed(1) : 'N/A'}
              </div>
              <div className="text-xs text-white/50">
                Best affinity (kcal/mol)
                <InfoTip text="Binding energy in kilocalories per mole. More negative values indicate stronger predicted binding." />
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-dockit-green">
                {results?.results?.[0]?.composite_score
                  ? Number(results.results[0].composite_score).toFixed(3)
                  : 'N/A'}
              </div>
              <div className="text-xs text-white/50">
                Best composite score
                <InfoTip text="Composite score (0-100) combining binding affinity, drug-likeness (QED), and ADMET properties." />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid: Viewer + Card (V6.1: md breakpoint for tablet) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="md:col-span-2 min-h-[400px]">
          <Viewer3D
            jobId={jobId}
            results={results}
            selectedPoseIndex={selectedPoseIndex}
            onPoseSelect={handlePoseSelect}
            simplified={false}
          />
        </div>
        <div>
          <MoleculeCard
            molecule={selectedMolecule}
            rank={selectedPoseIndex ?? 0}
          />
        </div>
      </div>

      {/* Results table */}
      <ResultsTable
        results={results}
        selectedIndex={selectedPoseIndex}
        onSelect={handlePoseSelect}
      />

      {/* AI-generated molecules section */}
      {results?.generated_molecules?.length > 0 && (
        <GeneratedMols molecules={results.generated_molecules} />
      )}

      {/* Downloads */}
      <DownloadButtons jobId={jobId} results={results} />
    </div>
  )
}

// --------------------------------------------------
// Main App
// --------------------------------------------------
export default function App() {
  // Views: input | progress | summary | results | methodology | optimization | clusters
  const [currentView, setCurrentView] = useState('input')
  const [jobId, setJobId] = useState(null)
  const [results, setResults] = useState(null)
  // Track elapsed seconds when pipeline finishes (for PipelineSummary)
  const progressStartRef = useRef(null)
  const [elapsedAtCompletion, setElapsedAtCompletion] = useState(null)
  // Dashboard sub-state
  const [showAllResults, setShowAllResults] = useState(false)
  const [dashboardSelectedIndex, setDashboardSelectedIndex] = useState(null)
  // V5: optimization state
  const [optimizationMolecule, setOptimizationMolecule] = useState(null)
  // Remember which view to return to after methodology/optimization/clusters
  const returnViewRef = useRef('results')

  const handleJobCreated = (newJobId) => {
    setJobId(newJobId)
    setResults(null)
    setElapsedAtCompletion(null)
    setShowAllResults(false)
    setDashboardSelectedIndex(null)
    setOptimizationMolecule(null)
    progressStartRef.current = Date.now()
    setCurrentView('progress')
  }

  const handleComplete = (jobResults) => {
    setResults(jobResults)
    if (progressStartRef.current) {
      setElapsedAtCompletion(Math.floor((Date.now() - progressStartRef.current) / 1000))
    }
    setCurrentView('summary')
  }

  const handleError = (err) => {
    console.error('[App] Job error:', err)
    // Stay on progress view, ProgressBar handles error display
  }

  // Summary -> show results dashboard (top 3)
  const handleViewResults = () => {
    setShowAllResults(false)
    setDashboardSelectedIndex(null)
    setCurrentView('results')
  }

  // Dashboard "View in 3D" -> open full results with that molecule pre-selected
  const handleSelect3D = (index) => {
    setDashboardSelectedIndex(index)
    setShowAllResults(true)
  }

  // Dashboard "View all results"
  const handleShowAll = () => {
    setDashboardSelectedIndex(null)
    setShowAllResults(true)
  }

  // Full results -> back to dashboard
  const handleBackToDashboard = () => {
    setShowAllResults(false)
    setDashboardSelectedIndex(null)
  }

  // V5: Open methodology page
  const handleMethodology = () => {
    returnViewRef.current = currentView
    setCurrentView('methodology')
  }

  // V5: Back from methodology
  const handleBackFromMethodology = () => {
    setCurrentView(returnViewRef.current)
  }

  // V5: Open optimization for a molecule
  const handleOptimize = (mol) => {
    setOptimizationMolecule(mol)
    returnViewRef.current = 'results'
    setCurrentView('optimization')
  }

  // V5: Back from optimization
  const handleBackFromOptimization = () => {
    setOptimizationMolecule(null)
    setCurrentView('results')
  }

  // V5bis: Open clusters view
  const handleShowClusters = () => {
    returnViewRef.current = currentView
    setCurrentView('clusters')
  }

  // V5bis: Back from clusters view
  const handleBackFromClusters = () => {
    setCurrentView(returnViewRef.current || 'results')
  }

  // V5bis: Select molecule from cluster -> go to full results with that molecule
  const handleClusterSelect = (mol) => {
    const allMols = [
      ...(results?.results || []),
      ...(results?.generated_molecules || []),
    ]
    const idx = allMols.findIndex(
      m => (m.name && m.name === mol.name) || (m.ligand_name && m.ligand_name === mol.ligand_name)
    )
    if (idx >= 0) {
      setDashboardSelectedIndex(idx)
    }
    setShowAllResults(true)
    setCurrentView('results')
  }

  const handleReset = () => {
    setCurrentView('input')
    setJobId(null)
    setResults(null)
    setElapsedAtCompletion(null)
    setShowAllResults(false)
    setDashboardSelectedIndex(null)
    setOptimizationMolecule(null)
    progressStartRef.current = null
  }

  return (
    <div className="min-h-screen flex flex-col bg-dockit-gray">
      <Header
        currentView={currentView}
        onReset={handleReset}
        onMethodology={handleMethodology}
      />
      <BackendStatus />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">

        {/* Input view */}
        {currentView === 'input' && (
          <div>
            {/* Hero */}
            <div className="text-center mb-10">
              <div className="flex justify-center mb-4">
                <DockItLogo size={64} />
              </div>
              <h1 className="text-4xl font-extrabold text-dockit-blue mb-3 flex items-center justify-center gap-2">
                Automated Molecular Docking
                <InfoTip text="Molecular docking is a computational method that predicts how small molecules (ligands) bind to a target protein, helping identify potential drug candidates." />
              </h1>
              <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                Identify the best inhibitors for your target protein in minutes,
                directly from your browser.
              </p>
              {/* Feature badges */}
              <div className="flex flex-wrap justify-center gap-3 mt-6">
                {[
                  { icon: '🧬', text: 'Flexible structure' },
                  { icon: '🎯', text: 'Auto strategy' },
                  { icon: '⚡', text: 'CPU screening' },
                  { icon: '📊', text: 'Score/100' },
                  { icon: '📄', text: 'PDF report' },
                  { icon: '🛡', text: 'Safety screening' },
                ].map(({ icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full shadow-sm border border-gray-100 text-sm text-gray-600">
                    <span>{icon}</span>
                    {text}
                  </span>
                ))}
              </div>
            </div>

            <InputForm onJobCreated={handleJobCreated} />
          </div>
        )}

        {/* Progress view */}
        {currentView === 'progress' && jobId && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-dockit-blue">Analysis in Progress</h2>
              <p className="text-gray-500 mt-1">
                Your screening is being processed. This may take several minutes.
              </p>
            </div>
            <ProgressBar
              jobId={jobId}
              onComplete={handleComplete}
              onError={handleError}
            />
          </div>
        )}

        {/* Summary view — shown after pipeline completes, before results */}
        {currentView === 'summary' && jobId && results && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-dockit-blue">Analysis Complete</h2>
              <p className="text-gray-500 mt-1">
                The pipeline has successfully analyzed your target protein.
              </p>
            </div>
            <PipelineSummary
              results={results}
              elapsed={elapsedAtCompletion}
              onViewResults={handleViewResults}
            />
          </div>
        )}

        {/* Results view — dashboard first, full table on demand */}
        {currentView === 'results' && jobId && results && (
          <>
            {!showAllResults ? (
              <ResultsDashboard
                results={results}
                onSelect3D={handleSelect3D}
                onShowAll={handleShowAll}
                onOptimize={handleOptimize}
                onShowClusters={handleShowClusters}
              />
            ) : (
              <ResultsView
                jobId={jobId}
                results={results}
                initialPoseIndex={dashboardSelectedIndex}
                onBack={handleBackToDashboard}
              />
            )}
          </>
        )}

        {/* V5bis: Clusters view */}
        {currentView === 'clusters' && results && (
          <div>
            <div className="mb-6">
              <button
                onClick={handleBackFromClusters}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-dockit-blue text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Results
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <ClusterView
                molecules={[
                  ...(results.results || []),
                  ...(results.generated_molecules || []),
                ]}
                onSelect={handleClusterSelect}
              />
            </div>
          </div>
        )}

        {/* V5: Methodology page */}
        {currentView === 'methodology' && (
          <MethodologyPage onBack={handleBackFromMethodology} />
        )}

        {/* V5: Optimization view */}
        {currentView === 'optimization' && jobId && optimizationMolecule && (
          <OptimizationView
            jobId={jobId}
            molecule={optimizationMolecule}
            onBack={handleBackFromOptimization}
            onComplete={(data) => {
              console.log('[App] Optimization complete:', data)
            }}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <DockItLogo size={28} />
              <div>
                <span className="font-semibold text-dockit-blue text-sm">DockIt</span>
                <span className="text-gray-400 text-xs ml-2">v5.0.0</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">
                Automated molecular docking platform
              </p>
              <p className="text-xs text-gray-300 mt-0.5">
                AlphaFold · ESMFold · fpocket · AutoDock Vina · ChEMBL · RDKit · REINVENT4 · ADMET-AI
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <button
                onClick={handleMethodology}
                className="hover:text-dockit-blue transition-colors"
              >
                Methodology
              </button>
              <a href="https://www.uniprot.org" target="_blank" rel="noopener noreferrer"
                className="hover:text-dockit-blue transition-colors">UniProt</a>
              <a href="https://www.ebi.ac.uk/chembl" target="_blank" rel="noopener noreferrer"
                className="hover:text-dockit-blue transition-colors">ChEMBL</a>
              <a href="https://alphafold.ebi.ac.uk" target="_blank" rel="noopener noreferrer"
                className="hover:text-dockit-blue transition-colors">AlphaFold</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
