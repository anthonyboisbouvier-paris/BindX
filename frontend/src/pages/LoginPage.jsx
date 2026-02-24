import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || err.userMessage || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <div className="flex justify-center mb-6">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        </div>
        <h2 className="text-2xl font-bold text-[#1e3a5f] mb-1 text-center">Sign In to DockIt</h2>
        <p className="text-sm text-gray-400 text-center mb-6">Access your projects and screening history</p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Your password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none transition-shadow"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#22c55e] text-white py-2.5 rounded-lg font-medium hover:bg-[#16a34a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          No account?{' '}
          <Link to="/register" className="text-[#1e3a5f] font-medium hover:underline">
            Create one
          </Link>
        </p>
        <div className="flex items-center gap-3 mt-4 mb-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-300">or</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <p className="text-center text-sm text-gray-400 mt-2">
          <Link to="/" className="hover:text-[#1e3a5f] transition-colors inline-flex items-center gap-1">
            Continue without signing in
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </p>
      </div>
    </div>
  )
}
