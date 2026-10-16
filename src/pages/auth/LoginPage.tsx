import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { showError, Spinner } from '../../components/ui/index'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, role } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน')
      return
    }
    setLoading(true)
    setError('')

    const { error: signInError } = await signIn(email, password)
    if (signInError) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
      return
    }

    // Wait a tick for profile to load
    setTimeout(() => {
      setLoading(false)
    }, 500)
  }

  // Navigate based on role after sign in
  React.useEffect(() => {
    if (role && !loading) {
      switch (role) {
        case 'SUPER_ADMIN': navigate('/admin/dashboard'); break
        case 'TEACHER': navigate('/admin/dashboard'); break
        case 'STUDENT': navigate('/student/dashboard'); break
        case 'KIOSK': navigate('/kiosk'); break
        default: navigate('/login')
      }
    }
  }, [role, loading, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl shadow-2xl mb-4 animate-bounce-in">
            <span className="text-4xl font-black text-white">EP</span>
          </div>
          <h1 className="text-3xl font-black text-white">EduPoint LMS</h1>
          <p className="text-slate-400 mt-1 text-sm">ระบบจัดการการเรียนรู้และ Point</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl animate-slide-in">
          <h2 className="text-xl font-bold text-white mb-6 text-center">เข้าสู่ระบบ</h2>

          {error && (
            <div className="alert-error mb-5 bg-red-500/20 border-red-500/40 text-red-200">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2" htmlFor="email">
                อีเมล
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@school.ac.th"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2" htmlFor="password">
                รหัสผ่าน
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <><Spinner size="sm" className="text-white" /> กำลังเข้าสู่ระบบ...</> : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-slate-400">
              มีปัญหาในการเข้าสู่ระบบ? ติดต่อผู้ดูแลระบบ
            </p>
          </div>
        </div>

        {/* Role badges */}
        <div className="flex justify-center gap-3 mt-6 flex-wrap">
          {[
            { role: 'ผู้ดูแล', color: 'bg-primary-500/20 text-primary-300 border-primary-500/30' },
            { role: 'ครู', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
            { role: 'นักเรียน', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
            { role: 'Kiosk', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
          ].map(item => (
            <span key={item.role} className={`text-xs px-3 py-1 rounded-full border font-medium ${item.color}`}>
              {item.role}
            </span>
          ))}
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          EduPoint LMS © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
