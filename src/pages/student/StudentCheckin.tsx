import React, { useEffect, useState, useCallback, useRef } from 'react'
import { CheckCircle, Clock, Trophy, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface CheckinSession {
  id: string
  title: string
  start_time: string
  end_time: string | null
  base_points: number
  bonus_1st: number
  bonus_2nd: number
  bonus_3rd: number
  decay_per_interval: number
  decay_interval_minutes: number
  min_points: number
  status: 'OPEN' | 'CLOSED'
  class_rooms?: { name: string }
}

interface CheckinResult {
  ok: boolean
  error?: string
  rank?: number
  base_points?: number
  bonus?: number
  total_points?: number
}

interface MyRecord {
  rank: number
  points_awarded: number
  checked_in_at: string
}

function calcPoints(session: CheckinSession, now: Date): { base: number; note: string } {
  const minutesLate = Math.max(0, (now.getTime() - new Date(session.start_time).getTime()) / 60000)
  const decay = Math.floor(minutesLate / (session.decay_interval_minutes || 1)) * session.decay_per_interval
  const base = Math.max(session.min_points, session.base_points - decay)
  if (decay === 0) return { base, note: 'มาตรงเวลา!' }
  return { base, note: `สาย ${Math.floor(minutesLate)} นาที (-${decay} pt)` }
}

function formatTimeLeft(endTime: string): string {
  const diff = Math.max(0, new Date(endTime).getTime() - Date.now())
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function StudentCheckin() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<CheckinSession[]>([])
  const [studentId, setStudentId] = useState<string | null>(null)
  const [myRecords, setMyRecords] = useState<Record<string, MyRecord>>({})
  const [loading, setLoading] = useState(true)
  const [checkinLoading, setCheckinLoading] = useState<string | null>(null)
  const [result, setResult] = useState<{ sessionId: string; res: CheckinResult } | null>(null)
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({})
  const [now, setNow] = useState(new Date())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Live clock
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Update time-left display
  useEffect(() => {
    const map: Record<string, string> = {}
    sessions.forEach(s => { if (s.end_time) map[s.id] = formatTimeLeft(s.end_time) })
    setTimeLeft(map)
  }, [now, sessions])

  const load = useCallback(async () => {
    if (!user) return
    // Get student
    const { data: stu } = await supabase.from('students').select('id,class_room_id').eq('user_id', user.id).single()
    if (!stu) { setLoading(false); return }
    setStudentId(stu.id)

    // Get open sessions for this room
    const { data: sess } = await supabase
      .from('checkin_sessions')
      .select('*, class_rooms(name)')
      .eq('class_room_id', stu.class_room_id)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })

    setSessions((sess || []) as CheckinSession[])

    // Get my records
    if (sess && sess.length > 0) {
      const ids = sess.map((s: CheckinSession) => s.id)
      const { data: recs } = await supabase
        .from('checkin_records')
        .select('session_id,rank,points_awarded,checked_in_at')
        .eq('student_id', stu.id)
        .in('session_id', ids)
      const map: Record<string, MyRecord> = {}
      ;(recs || []).forEach((r: { session_id: string; rank: number; points_awarded: number; checked_in_at: string }) => {
        map[r.session_id] = r
      })
      setMyRecords(map)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function doCheckin(sessionId: string) {
    if (!studentId) return
    setCheckinLoading(sessionId)
    setResult(null)
    const { data, error } = await supabase.rpc('perform_checkin', {
      p_session_id: sessionId,
      p_student_id: studentId,
    })
    setCheckinLoading(null)
    if (error) {
      setResult({ sessionId, res: { ok: false, error: error.message } })
      return
    }
    const res = data as CheckinResult
    setResult({ sessionId, res })
    if (res.ok) {
      // Refresh records
      setMyRecords(m => ({
        ...m,
        [sessionId]: {
          rank: res.rank!,
          points_awarded: res.total_points!,
          checked_in_at: new Date().toISOString(),
        }
      }))
    }
  }

  const rankLabel = (rank: number) => {
    if (rank === 1) return '🥇 อันดับ 1'
    if (rank === 2) return '🥈 อันดับ 2'
    if (rank === 3) return '🥉 อันดับ 3'
    return `อันดับที่ ${rank}`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">เช็คอิน</h1>
        <p className="text-sm text-slate-500 mt-0.5">กดปุ่มเช็คอินเพื่อรับคะแนน</p>
      </div>

      {sessions.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">ไม่มี Session เช็คอินที่เปิดอยู่</p>
          <p className="text-sm mt-1">รอครูเปิด session เช็คชื่อ</p>
        </div>
      ) : (
        sessions.map(session => {
          const myRecord = myRecords[session.id]
          const isCheckedIn = !!myRecord
          const isExpired = session.end_time ? now > new Date(session.end_time) : false
          const preview = calcPoints(session, now)
          const isActive = checkinLoading === session.id
          const thisResult = result?.sessionId === session.id ? result.res : null

          return (
            <div key={session.id} className={`card overflow-hidden ${isCheckedIn ? 'border-green-200' : ''}`}>
              {/* Header */}
              <div className={`px-5 py-4 ${isCheckedIn ? 'bg-green-50' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-800">{session.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(session.class_rooms as { name: string } | undefined)?.name}
                    </p>
                  </div>
                  {session.end_time && !isCheckedIn && !isExpired && (
                    <div className="flex items-center gap-1 text-sm font-mono font-bold text-orange-500 bg-orange-50 px-2.5 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5" />
                      {timeLeft[session.id] || '—'}
                    </div>
                  )}
                </div>

                {/* Point preview */}
                {!isCheckedIn && !isExpired && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="bg-primary-50 text-primary-700 px-2 py-1 rounded-lg font-medium">
                      🎯 ตอนนี้ได้ {preview.base} + โบนัสอันดับ pt
                    </span>
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{preview.note}</span>
                  </div>
                )}

                {/* Bonuses info */}
                <div className="mt-2 flex gap-2 text-xs text-slate-500">
                  <span>🥇 +{session.bonus_1st}</span>
                  <span>🥈 +{session.bonus_2nd}</span>
                  <span>🥉 +{session.bonus_3rd}</span>
                  <span className="ml-auto">📉 -{session.decay_per_interval}pt / {session.decay_interval_minutes}นาที</span>
                </div>
              </div>

              {/* Result Banner */}
              {thisResult && !thisResult.ok && (
                <div className="mx-4 mb-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {thisResult.error}
                </div>
              )}

              {/* Action / Status */}
              <div className="px-5 pb-5">
                {isCheckedIn ? (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">{rankLabel(myRecord.rank)}</p>
                      <p className="text-sm text-green-600">ได้รับ <strong>{myRecord.points_awarded} คะแนน</strong></p>
                    </div>
                  </div>
                ) : isExpired ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 rounded-xl px-4 py-3">
                    <Clock className="w-4 h-4" />
                    หมดเวลาเช็คอินแล้ว
                  </div>
                ) : (
                  <button
                    className="w-full btn-primary py-3 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                    onClick={() => doCheckin(session.id)}
                    disabled={isActive}
                  >
                    {isActive ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> กำลังเช็คอิน...</>
                    ) : (
                      <><CheckCircle className="w-5 h-5" /> เช็คอิน</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
