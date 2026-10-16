import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Spinner } from '../../components/ui/index'
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Trophy, 
  Sparkles, 
  Gamepad2, 
  CreditCard, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row overflow-hidden font-sarabun">
      {/* ======================================================== */}
      {/* LEFT 2/3: GRAND GRAPHIC & BRAND SHOWCASE */}
      {/* ======================================================== */}
      <div className="hidden lg:flex lg:w-2/3 relative bg-gradient-to-br from-[#070b15] via-[#0d152a] to-[#150f29] p-12 xl:p-16 flex-col justify-between overflow-hidden">
        {/* Ambient atmospheric glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-32 w-[550px] h-[550px] bg-primary-600/20 rounded-full blur-[140px]" />
          <div className="absolute top-1/3 right-0 w-[450px] h-[450px] bg-violet-600/20 rounded-full blur-[140px]" />
          <div className="absolute -bottom-24 left-1/4 w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-[130px]" />
          {/* Subtle grid texture */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '36px 36px'
            }}
          />
        </div>

        {/* Top Header / Branding */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-indigo-700 flex items-center justify-center shadow-[0_0_25px_rgba(59,130,246,0.6)] border border-white/20">
              <span className="text-xl font-black text-white tracking-wider">EP</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-white tracking-tight">EduPoint LMS</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary-500/20 border border-primary-400/40 text-primary-300">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">ระบบจัดการการเรียนรู้และแต้มสะสมแห่งอนาคต</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-xs font-semibold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ระบบพร้อมใช้งาน (System Online)
          </div>
        </div>

        {/* Hero Central Graphics */}
        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/15 via-primary-500/15 to-violet-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold mb-6 shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>Smart Learning & Gamification Ecosystem</span>
          </div>

          <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-black text-white leading-[1.15] tracking-tight">
            ยกระดับการศึกษา <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-sky-300 to-amber-300">
              ด้วยแรงจูงใจและระบบ Point
            </span>
          </h1>

          <p className="text-slate-300 text-base xl:text-lg max-w-2xl mt-5 leading-relaxed font-light">
            แพลตฟอร์มบริหารจัดการชั้นเรียนครบวงจร วัดผลทันใจ ส่งงานแบบไร้กระดาษ 
            พร้อมระบบแข่งขันอันดับ <span className="text-amber-300 font-semibold">Hall of Fame</span> และสแกนบัตรนักเรียนผ่าน Kiosk อัจฉริยะ
          </p>

          {/* 3 Showcase Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            {/* Card 1 */}
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3.5 group-hover:scale-110 transition-transform">
                <Trophy className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Hall of Fame (Top 3)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                จัดอันดับผู้สะสมคะแนนสูงสุดประจำสัปดาห์ เสริมสร้างแรงจูงใจในการเรียนรู้
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center mb-3.5 group-hover:scale-110 transition-transform">
                <Gamepad2 className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Interactive Games</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                มินิเกมการศึกษา สุ่มกลุ่มทำงาน และกิจกรรมสะสม Point ในห้องเรียน
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-3.5 group-hover:scale-110 transition-transform">
                <CreditCard className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Smart Kiosk Check-in</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                สแกนบัตรหรือกรอกรหัสนักเรียน เช็คชื่อและดูคะแนนได้อย่างรวดเร็ว
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between flex-wrap gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-6 flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-primary-400" /> ปลอดภัยด้วย Supabase Auth
            </span>
            <span className="flex items-center gap-1.5 text-slate-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ประเมินผลและตัดเกรดแม่นยำ
            </span>
            <span className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Sparkles className="w-4 h-4 text-amber-400" /> รองรับการใช้งานมือถือและแท็บเล็ต
            </span>
          </div>

          <span className="text-slate-500 text-[11px]">
            EduPoint LMS Platform
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT 1/3: PREMIUM LOGIN FORM */}
      {/* ======================================================== */}
      <div className="w-full lg:w-1/3 min-h-screen bg-[#0b0f19] border-l border-white/10 p-6 sm:p-10 lg:p-10 xl:p-12 flex flex-col justify-between relative z-10 shadow-2xl">
        {/* Mobile Header (Visible on small screens only) */}
        <div className="lg:hidden flex items-center justify-between pb-6 border-b border-white/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center font-black text-white text-lg shadow-lg">
              EP
            </div>
            <div>
              <h2 className="text-base font-black text-white">EduPoint LMS</h2>
              <p className="text-xs text-slate-400">ระบบจัดการการเรียนรู้</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/kiosk')}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1"
          >
            <CreditCard className="w-3.5 h-3.5" /> Kiosk
          </button>
        </div>

        {/* Form Container */}
        <div className="my-auto max-w-sm w-full mx-auto">
          {/* Form Header */}
          <div className="mb-8">
            <div className="hidden lg:inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl shadow-xl shadow-primary-500/20 mb-5 border border-white/20">
              <span className="text-2xl font-black text-white">EP</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              เข้าสู่ระบบ
            </h2>
            <p className="text-slate-400 text-sm mt-1.5">
              ยินดีต้อนรับกลับ กรุณากรอกข้อมูลเพื่อเข้าใช้งาน
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs sm:text-sm flex items-start gap-2.5 animate-shake">
              <span className="text-base leading-none">⚠️</span>
              <p className="font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider" htmlFor="email">
                อีเมลผู้ใช้งาน (Email)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@school.ac.th"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.06] border border-white/15 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider" htmlFor="password">
                  รหัสผ่าน (Password)
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/[0.06] border border-white/15 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="w-full py-3.5 px-6 mt-2 bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="text-white" /> 
                  <span>กำลังตรวจสอบ...</span>
                </>
              ) : (
                <>
                  <span>เข้าสู่ระบบ</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Access Kiosk Button for Students */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <button
              type="button"
              onClick={() => navigate('/kiosk')}
              className="w-full py-2.5 px-4 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span>สำหรับนักเรียน: เข้าโหมด Kiosk (แตะบัตร/รหัส)</span>
            </button>
          </div>

          {/* Role Badges */}
          <div className="mt-6">
            <p className="text-[11px] font-semibold text-slate-400 text-center mb-2.5 uppercase tracking-wider">
              สิทธิ์การเข้าใช้งานในระบบ
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              {[
                { role: 'ผู้ดูแลระบบ', color: 'bg-primary-500/20 text-primary-300 border-primary-500/30' },
                { role: 'ครูผู้สอน', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                { role: 'นักเรียน', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
                { role: 'Kiosk', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
              ].map(item => (
                <span key={item.role} className={`text-[10px] px-2.5 py-0.5 rounded-full border font-semibold ${item.color}`}>
                  {item.role}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-white/10 text-center mt-6">
          <p className="text-xs text-slate-500">
            มีปัญหาในการเข้าสู่ระบบ? ติดต่อผู้ดูแลระบบสถาบัน
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            EduPoint LMS © {new Date().getFullYear()} — All Rights Reserved
          </p>
        </div>
      </div>
    </div>
  )
}
