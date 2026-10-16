import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type KioskState = 'IDLE' | 'READING' | 'FOUND' | 'SUCCESS' | 'ERROR' | 'ALREADY'

interface StudentInfo {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
  student_code: string
  avatar_url: string | null
  education_level: { name: string } | null
  class_room: { name: string } | null
}

interface CheckInResult {
  success: boolean
  message: string
  points_awarded: number
  total_points: number
  student: StudentInfo | null
  streak?: number
}

export default function KioskPage() {
  const [state, setState] = useState<KioskState>('IDLE')
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cardBuffer, setCardBuffer] = useState('')
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)

  // Clock
  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(clock)
  }, [])

  // Focus invisible input to capture card reader
  useEffect(() => {
    inputRef.current?.focus()
  }, [state])

  // Card reader keyboard capture
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (state === 'SUCCESS' || state === 'ALREADY' || state === 'ERROR') return

      if (e.key === 'Enter') {
        const cardNum = bufferRef.current.trim()
        if (cardNum.length >= 4) {
          processCard(cardNum)
        }
        bufferRef.current = ''
        clearTimeout(timerRef.current)
        return
      }

      if (/^[0-9A-Za-z]$/.test(e.key)) {
        bufferRef.current += e.key
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          if (bufferRef.current.length >= 4) {
            processCard(bufferRef.current)
          }
          bufferRef.current = ''
        }, 1500)

        if (state === 'IDLE') {
          setState('READING')
        }
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [state])

  async function processCard(cardNumber: string) {
    setState('READING')
    bufferRef.current = ''

    try {
      // Look up student by card number
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .select('id, first_name, last_name, nickname, student_code, avatar_url, education_level:education_levels(name), class_room:class_rooms(name)')
        .eq('card_number', cardNumber)
        .eq('status', 'ACTIVE')
        .single()

      if (studentErr || !studentData) {
        setState('ERROR')
        setResult({ success: false, message: `ไม่พบบัตร: ${cardNumber}`, points_awarded: 0, total_points: 0, student: null })
        scheduleReset(4000)
        return
      }

      const s = studentData as StudentInfo
      setStudent(s)
      setState('FOUND')

      // Short delay for visual feedback
      await new Promise(res => setTimeout(res, 500))

      // Call RPC to award kiosk point
      const { data: rpcData, error: rpcErr } = await supabase.rpc('award_kiosk_point', {
        p_student_id: s.id,
        p_card_number: cardNumber,
      })

      if (rpcErr) throw rpcErr

      const rpcResult = rpcData as { success: boolean; message: string; points_awarded: number; total_points: number; streak?: number }

      if (!rpcResult.success && rpcResult.message?.includes('already')) {
        setState('ALREADY')
        setResult({ ...rpcResult, student: s })
        scheduleReset(5000)
        return
      }

      if (!rpcResult.success) {
        setState('ERROR')
        setResult({ ...rpcResult, student: s, message: rpcResult.message || 'เกิดข้อผิดพลาด' })
        scheduleReset(5000)
        return
      }

      setState('SUCCESS')
      setResult({ ...rpcResult, student: s })
      scheduleReset(6000)

    } catch (err: unknown) {
      setState('ERROR')
      setResult({ success: false, message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ', points_awarded: 0, total_points: 0, student: null })
      scheduleReset(5000)
    }
  }

  function scheduleReset(ms: number) {
    clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      setState('IDLE')
      setStudent(null)
      setResult(null)
      bufferRef.current = ''
    }, ms)
  }

  // Manual card number entry (for testing)
  const [manualCard, setManualCard] = useState('')
  const [showManual, setShowManual] = useState(false)

  const timeStr = currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = currentTime.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 flex flex-col items-center justify-center p-6 select-none"
      onClick={() => inputRef.current?.focus()}>

      {/* Invisible capture input */}
      <input
        ref={inputRef}
        className="opacity-0 absolute w-0 h-0 pointer-events-none"
        readOnly
        aria-label="card reader input"
        id="card-reader-input"
      />

      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-2">
          <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center">
            <span className="text-white font-black text-2xl">EP</span>
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-black text-white">EduPoint</h1>
            <p className="text-slate-400 text-sm">Kiosk Station</p>
          </div>
        </div>
      </div>

      {/* Clock */}
      <div className="text-center mb-8">
        <p className="text-7xl font-black text-white font-mono tracking-tight">{timeStr}</p>
        <p className="text-slate-400 mt-2">{dateStr}</p>
      </div>

      {/* State Card */}
      <div className="w-full max-w-md">
        {/* IDLE */}
        {state === 'IDLE' && (
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 text-center animate-bounce-in">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-ring">
              <span className="text-5xl">💳</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">แตะบัตรนักเรียน</h2>
            <p className="text-slate-400">Touch your student card to check in</p>
            <p className="text-slate-500 text-sm mt-3">สะสม Point ทุกวันที่มาเรียน</p>
          </div>
        )}

        {/* READING */}
        {state === 'READING' && (
          <div className="bg-white/10 backdrop-blur-xl border border-primary-500/40 rounded-3xl p-8 text-center animate-bounce-in">
            <div className="w-24 h-24 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-12 h-12 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white">กำลังอ่านบัตร...</h2>
            <p className="text-slate-400 mt-2">Reading card...</p>
          </div>
        )}

        {/* FOUND */}
        {state === 'FOUND' && student && (
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 text-center animate-bounce-in">
            <div className="w-24 h-24 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">👤</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{student.first_name} {student.last_name}</h2>
            <p className="text-slate-400">{student.student_code}</p>
            <div className="w-16 h-1 bg-primary-500 mx-auto rounded-full mt-3 animate-pulse" />
          </div>
        )}

        {/* SUCCESS */}
        {state === 'SUCCESS' && result && student && (
          <div className="bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/40 rounded-3xl p-8 text-center animate-bounce-in">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">✅</span>
            </div>
            <h2 className="text-3xl font-black text-white mb-1">{student.first_name}</h2>
            <p className="text-emerald-300 text-sm mb-4">{student.class_room?.name} • {student.education_level?.name}</p>

            <div className="bg-white/10 rounded-2xl p-4 mb-4">
              <p className="text-emerald-300 text-sm">รับ Point</p>
              <p className="text-5xl font-black text-emerald-400">+{result.points_awarded}</p>
              <p className="text-slate-300 text-sm mt-1">รวม: {result.total_points.toLocaleString()} ⭐</p>
              {result.streak && result.streak > 1 && (
                <p className="text-amber-400 font-semibold mt-1">🔥 มาต่อเนื่อง {result.streak} วัน!</p>
              )}
            </div>

            <p className="text-emerald-300 text-sm font-semibold">Check-in สำเร็จ! 🎉</p>
          </div>
        )}

        {/* ALREADY */}
        {state === 'ALREADY' && result && student && (
          <div className="bg-amber-500/20 backdrop-blur-xl border border-amber-500/40 rounded-3xl p-8 text-center animate-bounce-in">
            <div className="w-24 h-24 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">{student.first_name} {student.last_name}</h2>
            <p className="text-amber-300 font-semibold mt-3">Check-in แล้วในวันนี้</p>
            <p className="text-slate-400 text-sm mt-1">Already checked in today</p>
            <div className="bg-white/10 rounded-2xl p-4 mt-4">
              <p className="text-slate-300 text-sm">Point สะสมทั้งหมด</p>
              <p className="text-4xl font-black text-white mt-1">{result.total_points.toLocaleString()} ⭐</p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {state === 'ERROR' && result && (
          <div className="bg-red-500/20 backdrop-blur-xl border border-red-500/40 rounded-3xl p-8 text-center animate-bounce-in">
            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">ไม่พบบัตร</h2>
            <p className="text-red-300 text-sm">{result.message}</p>
            <p className="text-slate-400 text-sm mt-2">กรุณาติดต่อครูหรือผู้ดูแลระบบ</p>
          </div>
        )}
      </div>

      {/* Manual entry button (for testing) */}
      <div className="mt-8">
        {!showManual ? (
          <button onClick={() => setShowManual(true)} className="text-slate-700 text-xs hover:text-slate-500 transition-colors">
            ⌨ Manual Entry (Test)
          </button>
        ) : (
          <div className="flex gap-2 items-center bg-white/10 rounded-2xl p-3">
            <input
              type="text"
              value={manualCard}
              onChange={e => setManualCard(e.target.value)}
              placeholder="Card number..."
              className="bg-white/10 text-white placeholder-slate-500 text-sm px-3 py-2 rounded-xl border border-white/20 focus:outline-none focus:border-primary-400 w-40"
              onKeyDown={e => { if (e.key === 'Enter') { processCard(manualCard); setManualCard(''); setShowManual(false) } }}
            />
            <button
              onClick={() => { processCard(manualCard); setManualCard(''); setShowManual(false) }}
              id="manual-checkin-btn"
              className="bg-primary-600 text-white text-sm px-3 py-2 rounded-xl font-medium hover:bg-primary-500 transition-colors"
            >
              ตรวจสอบ
            </button>
            <button onClick={() => setShowManual(false)} className="text-slate-400 text-sm px-2">ยกเลิก</button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-slate-700 text-xs mt-4">EduPoint LMS Kiosk © {new Date().getFullYear()}</p>
    </div>
  )
}
