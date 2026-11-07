import React, { useEffect, useState, useCallback, useRef } from 'react'
import { CheckCircle, Clock, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface CheckinSession {
  id: string
  title: string
  class_room_id: string | null
  start_time: string
  end_time: string | null
  golden_minutes?: number
  golden_bonus?: number
  base_points: number
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
  in_golden?: boolean
  total_points?: number
}

interface MyRecord {
  rank: number
  points_awarded: number
  checked_in_at: string
}

function calcCurrentPoints(session: CheckinSession, now: Date): { pts: number; isGolden: boolean; text: string } {
  const startTime = new Date(session.start_time).getTime()
  const goldenMins = session.golden_minutes ?? 5
  const goldenBonus = session.golden_bonus ?? 5
  const goldenEnd = startTime + goldenMins * 60000

  if (now.getTime() <= goldenEnd) {
    const remainSec = Math.max(0, Math.floor((goldenEnd - now.getTime()) / 1000))
    const m = Math.floor(remainSec / 60)
    const s = remainSec % 60
    return {
      pts: session.base_points + goldenBonus,
      isGolden: true,
      text: `⭐ อยู่ในช่วงเวลาทอง! (เหลือ ${m}:${s.toString().padStart(2, '0')})`,
    }
  }

  // After golden time
  const msAfter = now.getTime() - goldenEnd
  const minsAfter = Math.max(0, msAfter / 60000)
  const decayInterval = session.decay_interval_minutes || 5
  const decayStep = Math.floor(minsAfter / decayInterval)
  const decayPts = decayStep * (session.decay_per_interval || 1)
  const pts = Math.max(session.min_points, session.base_points - decayPts)

  if (decayPts === 0) {
    return { pts, isGolden: false, text: 'เวลาปกติ (ยังไม่หักคะแนน)' }
  }
  return { pts, isGolden: false, text: `เวลาปกติ (สายไป ${Math.floor(minsAfter)} นาที, หัก ${decayPts} pt)` }
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

  // Live timer tick every second
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    const map: Record<string, string> = {}
    sessions.forEach(s => { if (s.end_time) map[s.id] = formatTimeLeft(s.end_time) })
    setTimeLeft(map)
  }, [now, sessions])

  const load = useCallback(async () => {
    if (!user) return
    const { data: stu } = await supabase.from('students').select('id,class_room_id').eq('user_id', user.id).single()
    if (!stu) { setLoading(false); return }
    setStudentId(stu.id)

    // Load open sessions: either for this student's room OR open to everyone (class_room_id is null)
    let query = supabase
      .from('checkin_sessions')
      .select('*, class_rooms(name)')
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })

    if (stu.class_room_id) {
      query = query.or(`class_room_id.is.null,class_room_id.eq.${stu.class_room_id}`)
    } else {
      query = query.is('class_room_id', null)
    }

    const { data: sess } = await query
    setSessions((sess || []) as CheckinSession[])

    // Load existing records for these sessions
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
        <h1 className="text-xl font-bold text-slate-800">เช็คอินเข้าเรียน</h1>
        <p className="text-sm text-slate-500 mt-0.5">กดปุ่มเช็คอินเพื่อรับคะแนนสะสม</p>
      </div>

      {sessions.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">ไม่มี Session เช็คอินที่เปิดอยู่ในขณะนี้</p>
          <p className="text-sm mt-1">รอคุณครูเปิด session เช็คชื่อ</p>
        </div>
      ) : (
        sessions.map(session => {
          const myRecord = myRecords[session.id]
          const isCheckedIn = !!myRecord
          const isExpired = session.end_time ? now > new Date(session.end_time) : false
          const pointState = calcCurrentPoints(session, now)
          const isActive = checkinLoading === session.id
          const thisResult = result?.sessionId === session.id ? result.res : null
          const roomName = (session.class_rooms as { name: string } | undefined)?.name

          return (
            <div key={session.id} className={`card overflow-hidden transition-all ${
              isCheckedIn ? 'border-green-200' : pointState.isGolden ? 'border-amber-300 ring-2 ring-amber-200' : ''
            }`}>
              {/* Header */}
              <div className={`px-5 py-4 ${
                isCheckedIn ? 'bg-green-50' : pointState.isGolden ? 'bg-amber-50/60' : 'bg-white'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-slate-800">{session.title}</h2>
                      {pointState.isGolden && !isCheckedIn && !isExpired && (
                        <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                          <Sparkles className="w-3 h-3 text-amber-500" /> เวลาทอง
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {roomName ? `ห้อง ${roomName}` : '🌐 เช็คอินได้ทุกคน'}
                    </p>
                  </div>

                  {session.end_time && !isCheckedIn && !isExpired && (
                    <div className="flex items-center gap-1 text-xs font-mono font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5" />
                      เหลือเวลา {timeLeft[session.id] || '—'}
                    </div>
                  )}
                </div>

                {/* Point preview */}
                {!isCheckedIn && !isExpired && (
                  <div className="mt-3 p-2.5 bg-white/80 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">คะแนนที่จะได้รับตอนนี้:</span>
                      <span className={`text-base font-bold ${pointState.isGolden ? 'text-amber-600' : 'text-primary-600'}`}>
                        +{pointState.pts} คะแนน
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{pointState.text}</p>
                  </div>
                )}
              </div>

              {/* Error message if any */}
              {thisResult && !thisResult.ok && (
                <div className="mx-4 mb-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {thisResult.error}
                </div>
              )}

              {/* Action Button */}
              <div className="px-5 pb-5 pt-1">
                {isCheckedIn ? (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">{rankLabel(myRecord.rank)}</p>
                      <p className="text-sm text-green-600">
                        เช็คอินสำเร็จ ได้รับ <strong>{myRecord.points_awarded} คะแนน</strong>
                      </p>
                    </div>
                  </div>
                ) : isExpired ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 rounded-xl px-4 py-3">
                    <Clock className="w-4 h-4" />
                    หมดเวลาเช็คอินแล้ว
                  </div>
                ) : (
                  <button
                    className={`w-full py-3.5 rounded-xl text-base font-bold flex items-center justify-center gap-2 text-white shadow-md transition-all active:scale-[0.99] disabled:opacity-60 ${
                      pointState.isGolden
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-200'
                        : 'bg-primary-600 hover:bg-primary-700 shadow-primary-200'
                    }`}
                    onClick={() => doCheckin(session.id)}
                    disabled={isActive}
                  >
                    {isActive ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> กำลังบันทึกการเช็คอิน...</>
                    ) : pointState.isGolden ? (
                      <><Sparkles className="w-5 h-5" /> กดเช็คอินรับโบนัสเวลาทอง (+{pointState.pts} pt)</>
                    ) : (
                      <><CheckCircle className="w-5 h-5" /> กดเช็คอิน (+{pointState.pts} pt)</>
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
