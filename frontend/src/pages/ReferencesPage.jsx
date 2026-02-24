import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api.js'

export default function ReferencesPage() {
  const [references, setReferences] = useState([])
  const [categories, setCategories] = useState([])
  const [expectedResults, setExpectedResults] = useState(null)
  const [selectedCat, setSelectedCat] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [refsRes, resultsRes] = await Promise.all([
          apiClient.get('/references'),
          apiClient.get('/expected-results'),
        ])
        setReferences(refsRes.data.references || [])
        setCategories(refsRes.data.categories || [])
        setExpectedResults(resultsRes.data)
      } catch (err) {
        console.error('Failed to load references:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredRefs = selectedCat
    ? references.filter(r => r.category === selectedCat)
    : references

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-[#1e3a5f] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <Link to="/" className="text-sm text-gray-400 hover:text-[#1e3a5f] mb-2 inline-block">
          &larr; Back to Projects
        </Link>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Methodology & References</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scientific citations for all tools, algorithms, and databases used in DockIt.
        </p>
      </div>

      {/* Expected Results */}
      {expectedResults && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">Expected Results by Mode</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {['rapid_mode', 'standard_mode', 'deep_mode'].map(key => {
              const info = expectedResults[key]
              if (!info) return null
              const colors = {
                rapid_mode: 'border-indigo-200 bg-indigo-50',
                standard_mode: 'border-teal-200 bg-teal-50',
                deep_mode: 'border-amber-200 bg-amber-50',
              }
              const labels = {
                rapid_mode: 'Rapid',
                standard_mode: 'Standard',
                deep_mode: 'Deep',
              }
              return (
                <div key={key} className={`rounded-xl border p-4 space-y-2 ${colors[key]}`}>
                  <h3 className="font-bold text-gray-800">{labels[key]}</h3>
                  <p className="text-xs text-gray-600">{info.description}</p>
                  <div className="space-y-1 text-xs">
                    <div><span className="font-medium text-gray-700">Runtime:</span> {info.typical_runtime}</div>
                    <div><span className="font-medium text-gray-700">Hit rate:</span> {info.expected_hit_rate}</div>
                    <div><span className="font-medium text-gray-700">Enrichment:</span> {info.enrichment_factor}</div>
                    <div><span className="font-medium text-gray-700">Accuracy:</span> {info.accuracy}</div>
                    {info.key_advantage && (
                      <div className="mt-1 pt-1 border-t border-gray-200">
                        <span className="font-medium text-gray-700">Key advantage:</span> {info.key_advantage}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {expectedResults.general_notes && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Important Notes</h4>
              <ul className="space-y-1">
                {expectedResults.general_notes.map((note, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">-</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCat(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            !selectedCat ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          All ({references.length})
        </button>
        {categories.map(cat => {
          const count = references.filter(r => r.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                selectedCat === cat ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {cat} ({count})
            </button>
          )
        })}
      </div>

      {/* References list */}
      <div className="space-y-3">
        {filteredRefs.map((ref, i) => (
          <div key={ref.id || i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 leading-tight">{ref.title}</p>
                <p className="text-xs text-gray-500 mt-1">{ref.authors} ({ref.year})</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="italic">{ref.journal}</span>
                  {ref.volume && <>, {ref.volume}</>}
                  {ref.pages && <>, {ref.pages}</>}
                </p>
                <p className="text-xs text-blue-600 mt-2 bg-blue-50 inline-block px-2 py-0.5 rounded">
                  {ref.usage}
                </p>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {ref.category}
                </span>
                {ref.doi && (
                  <a
                    href={`https://doi.org/${ref.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1e3a5f] hover:underline"
                  >
                    DOI
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
        DockIt references are automatically curated from peer-reviewed publications.
        For corrections or additions, please contact the development team.
      </div>
    </div>
  )
}
