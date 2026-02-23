import React, { useEffect, useRef, useState, useCallback } from 'react'
import { getJobStatus, getJobResults } from '../api.js'
import PedagogicalTip from './PedagogicalTip.jsx'
import InfoTip from './InfoTip.jsx'

const POLL_INTERVAL_MS = 2000

// Pipeline step definitions in display order
const PIPELINE_STEPS = [
  { key: 'ligands',  label: 'Candidate Molecules',  pctRange: [0,  15] },
  { key: 'docking',  label: 'Molecular Docking',    pctRange: [15, 65] },
  { key: 'admet',    label: 'ADMET Profiling',       pctRange: [65, 80] },
  { key: 'scoring',  label: 'Scoring & Ranking',    pctRange: [80, 95] },
  { key: 'report',   label: 'Final Report',         pctRange: [95, 100] },
]

// Step tooltips explaining what each step does
const STEP_TIPS = {
  ligands: 'Retrieving candidate molecules from chemical databases (ChEMBL, ZINC).',
  docking: 'Simulating how each molecule fits into the binding pocket and scoring the interaction.',
  admet: 'Evaluating Absorption, Distribution, Metabolism, Excretion, and Toxicity of top candidates.',
  scoring: 'Combining docking score, drug-likeness, and ADMET profile into a composite ranking.',
  report: 'Compiling all results, structures, and scores into the final PDF report.',
}

// Scientific storytelling cards shown while each step is active
const SCIENCE_CARDS = {
  ligands: {
    icon: '🧪',
    title: 'Gathering Candidate Molecules',
    body: "Querying ChEMBL — the world's largest open-access bioactivity database (>2M compounds) — for molecules previously tested against this target family. Each candidate is filtered by Lipinski's Rule of Five to ensure drug-likeness before docking.",
    ref: 'Mendez et al., ChEMBL: towards direct deposition of bioassay data, NAR 2019',
  },
  docking: {
    icon: '⚡',
    title: 'AutoDock Vina — Simulating Molecular Binding',
    body: 'AutoDock Vina uses a gradient-based optimizer and an empirical scoring function to predict how each molecule fits into the binding pocket. For each candidate it explores millions of conformational poses and reports the lowest-energy binding mode as a kcal/mol affinity score.',
    ref: 'Trott & Olson, AutoDock Vina: improving speed and accuracy, J Comput Chem 2010',
  },
  admet: {
    icon: '🔬',
    title: 'ADMET Profiling — Beyond Affinity',
    body: '90% of drug candidates that enter clinical trials fail — mostly due to ADMET issues, not lack of potency. We screen each top hit for Absorption, Distribution, Metabolism, Excretion, and Toxicity — including CYP inhibition, hERG cardiotoxicity, and blood-brain barrier penetration.',
    ref: 'Lipinski et al., Experimental and computational approaches to estimate solubility, Adv Drug Deliv Rev 1997',
  },
  scoring: {
    icon: '📊',
    title: 'Composite Scoring — Ranking the Best Hits',
    body: "Binding affinity alone doesn't make a drug. We combine docking score, drug-likeness (QED), synthetic accessibility (SA score), and ADMET profile into a composite score to identify the most promising starting points for medicinal chemistry.",
    ref: 'Bickerton et al., Quantifying the chemical beauty of drugs, Nature Chem 2012',
  },
  report: {
    icon: '📄',
    title: 'Generating Your Scientific Report',
    body: 'Compiling docking poses, scores, ADMET flags, and molecular structures into a downloadable PDF report — ready to share with your team or guide your next experiment.',
    ref: null,
  },
}

// Derive which step is active/done/pending from progress percentage and backend current_step string
function resolveStepStatuses(progress, currentStepName) {
  return PIPELINE_STEPS.map((step) => {
    const [min, max] = step.pctRange
    if (progress >= max) return { ...step, status: 'done' }
    if (progress >= min) return { ...step, status: 'active' }
    // Also mark as active if backend explicitly names this step
    if (currentStepName) {
      const name = currentStepName.toLowerCase()
      if (
        (step.key === 'ligands'  && (name.includes('ligand') || name.includes('molecule') || name.includes('chembl'))) ||
        (step.key === 'docking'  && name.includes('dock')) ||
        (step.key === 'admet'    && (name.includes('admet') || name.includes('score'))) ||
        (step.key === 'scoring'  && (name.includes('scoring') || name.includes('rank') || name.includes('composite'))) ||
        (step.key === 'report'   && (name.includes('rapport') || name.includes('report') || name.includes('pdf')))
      ) {
        return { ...step, status: 'active' }
      }
    }
    return { ...step, status: 'pending' }
  })
}

// Format seconds to "Xm Ys"
function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

// Status icon for a step
function StepIcon({ status }) {
  if (status === 'done') {
    return (
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
        <svg className="w-5 h-5 text-dockit-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
        <svg className="w-5 h-5 text-dockit-blue animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </span>
    )
  }
  return (
    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
      <span className="w-3 h-3 rounded-full border-2 border-gray-300" />
    </span>
  )
}

// Scientific story card shown while a step is active
function ScienceCard({ stepKey }) {
  const card = SCIENCE_CARDS[stepKey]
  if (!card) return null
  return (
    <div className="mt-2 ml-9 p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs leading-relaxed">
      <p className="font-semibold text-dockit-blue mb-1">{card.icon} {card.title}</p>
      <p className="text-gray-600">{card.body}</p>
      {card.ref && (
        <p className="mt-1.5 text-gray-400 italic text-[10px]">Ref: {card.ref}</p>
      )}
    </div>
  )
}

// A single pipeline step row
function StepRow({ step, stepDetail, isActive, progress }) {
  // For the active docking step, show a mini sub-progress bar if we have detail
  const showDockingProgress = isActive && step.key === 'docking' && stepDetail && stepDetail.match(/\d+\/\d+/)
  let dockingFraction = null
  let dockingCurrent = null
  let dockingTotal = null
  if (showDockingProgress) {
    const match = stepDetail.match(/(\d+)\/(\d+)/)
    if (match) {
      dockingCurrent = parseInt(match[1], 10)
      dockingTotal = parseInt(match[2], 10)
      dockingFraction = dockingTotal > 0 ? dockingCurrent / dockingTotal : 0
    }
  }

  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-50 last:border-0 transition-all ${isActive ? 'bg-blue-50/40 -mx-4 px-4 rounded-lg' : ''}`}>
      <div className="mt-0.5">
        <StepIcon status={step.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold flex items-center ${
            step.status === 'done'
              ? 'text-dockit-green'
              : step.status === 'active'
              ? 'text-dockit-blue'
              : 'text-gray-400'
          }`}>
            {step.label}
            <InfoTip text={STEP_TIPS[step.key] || step.label} />
          </span>
          {stepDetail && step.status !== 'pending' && (
            <span className={`text-xs flex-shrink-0 ${
              step.status === 'done' ? 'text-gray-400' : 'text-dockit-blue/70 font-medium'
            }`}>
              {stepDetail}
            </span>
          )}
        </div>

        {/* Docking sub-progress bar */}
        {showDockingProgress && dockingFraction !== null && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-dockit-blue rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(dockingFraction * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 font-mono flex-shrink-0">
                {dockingCurrent}/{dockingTotal}
              </span>
            </div>
          </div>
        )}

        {/* Science card — shown only for the active step */}
        {isActive && <ScienceCard stepKey={step.key} />}
      </div>
    </div>
  )
}

export default function ProgressBar({ jobId, onComplete, onError }) {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [stepDetails, setStepDetails] = useState({})
  const [strategyMessage, setStrategyMessage] = useState(null)
  const [pedagogicalStep, setPedagogicalStep] = useState('default')
  const [status, setStatus] = useState('pending')
  const [errorMsg, setErrorMsg] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [stepStatuses, setStepStatuses] = useState(resolveStepStatuses(0, ''))

  const intervalRef = useRef(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(Date.now())

  const poll = useCallback(async () => {
    try {
      const data = await getJobStatus(jobId)
      const prog = data.progress || 0
      const stepName = data.current_step || ''

      setStatus(data.status)
      setProgress(prog)
      setCurrentStep(stepName)
      setStepStatuses(resolveStepStatuses(prog, stepName))

      // V3 fields from backend
      if (data.step_details) {
        // step_details can be a dict {step_key: detail_string} or a plain string
        if (typeof data.step_details === 'object') {
          setStepDetails(data.step_details)
        } else if (typeof data.step_details === 'string') {
          // Map the current step's detail to the resolved step key
          const activeStep = PIPELINE_STEPS.find(s => {
            const [min, max] = s.pctRange
            return prog >= min && prog < max
          })
          if (activeStep) {
            setStepDetails(prev => ({ ...prev, [activeStep.key]: data.step_details }))
          }
        }
      }

      if (data.strategy_message) setStrategyMessage(data.strategy_message)
      if (data.pedagogical_tip || stepName) setPedagogicalStep(data.pedagogical_tip ? stepName : stepName)

      if (data.status === 'completed') {
        clearInterval(intervalRef.current)
        clearInterval(timerRef.current)
        setProgress(100)
        setStepStatuses(resolveStepStatuses(100, ''))
        try {
          const results = await getJobResults(jobId)
          onComplete(results)
        } catch (err) {
          setErrorMsg('Unable to retrieve results. ' + (err.userMessage || err.message))
          if (onError) onError(err)
        }
      } else if (data.status === 'failed') {
        clearInterval(intervalRef.current)
        clearInterval(timerRef.current)
        const msg = data.error_message || data.error || 'The job failed. Check the backend logs.'
        setErrorMsg(msg)
        if (onError) onError(new Error(msg))
      }
    } catch (err) {
      console.error('[ProgressBar] Polling error:', err)
      if (err.response?.status >= 400) {
        clearInterval(intervalRef.current)
        clearInterval(timerRef.current)
        const msg = err.userMessage || 'Communication error with the server.'
        setErrorMsg(msg)
        if (onError) onError(err)
      }
    }
  }, [jobId, onComplete, onError])

  useEffect(() => {
    if (!jobId) return
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => {
      clearInterval(intervalRef.current)
      clearInterval(timerRef.current)
    }
  }, [poll, jobId])

  if (errorMsg) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-red-700">Job Failed</h3>
            <p className="text-gray-600 max-w-md">{errorMsg}</p>
            <p className="text-xs text-gray-400 font-mono">Job ID: {jobId}</p>
          </div>
        </div>
      </div>
    )
  }

  const pct = Math.round(progress)
  // Active step for PedagogicalTip
  const activeStep = stepStatuses.find(s => s.status === 'active')
  const tipStep = activeStep ? activeStep.key : currentStep

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card p-6">

        {/* Thin top progress bar + timer */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-dockit-blue">
            Screening in Progress
          </span>
          <span className="text-sm font-mono text-gray-500">
            {formatTime(elapsedSeconds)}
          </span>
        </div>

        {/* Progress bar (thin) */}
        <div className="relative mb-6">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
            <div
              className="h-full progress-bar-fill rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400 font-mono">{pct}%</span>
            <span className="text-xs text-gray-400 font-mono">Job: {jobId}</span>
          </div>
        </div>

        {/* Vertical steps list */}
        <div className="space-y-0">
          {stepStatuses.map((step) => {
            const isActive = step.status === 'active'
            const detail = stepDetails[step.key] || null
            return (
              <StepRow
                key={step.key}
                step={step}
                stepDetail={detail}
                isActive={isActive}
                progress={progress}
              />
            )
          })}
        </div>
      </div>

      {/* Pedagogical tip */}
      <PedagogicalTip step={tipStep} />

      {/* Strategy message */}
      {strategyMessage && (
        <div className="rounded-xl border border-dockit-blue/20 bg-dockit-blue/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-dockit-blue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-semibold text-dockit-blue uppercase tracking-wide">
              Selected Strategy
            </span>
          </div>
          <p className="text-sm text-dockit-blue/80 leading-relaxed">{strategyMessage}</p>
        </div>
      )}

      {/* Note */}
      <p className="text-xs text-gray-400 text-center pb-2">
        Updated every 2 seconds. Do not close this tab.
      </p>
    </div>
  )
}
