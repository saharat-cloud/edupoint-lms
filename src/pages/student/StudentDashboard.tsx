import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Star, BookOpen, MessageCircle, Gamepad2, Clock, AlertCircle, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { StudentStats, PointTransaction } from '../../lib/types'
import { StatCard, PageLoading, PointDisplay, formatRelativeTime, SubmissionStatusBadge, formatDateTime } from '../../components/ui/index'

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<StudentStats>({ totalPoints: 0, assignmentCount: 0, pendingCount: 0, gradedCount: 0, resubmitCount: 0, nearDueCount: 0, unreadMessages: 0, unreadNotifications: 0 })
  const [recentPoints, setRecentPoints] = useState<PointTransaction[]>([])
  const [pendingAssignments, setPendingAssignments] = useState<Array<Record<string, unknown>>>([])
  const [studentId, setStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      // Get student record
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user!.id).single()
      if (!student) { setLoading(false); return }
      setStudentId(student.id)

      const [pointRes, targetsRes, notifRes, msgRes] = await Promise.all([
        supabase.from('point_transactions').select('*').eq('student_id', student.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('assignment_targets').select(`*, assignment:assignments(id,title,due_at,academic_full_score,status), submission:submissions(status,academic_score)`)
          .eq('student_id', student.id).eq('status', 'ASSIGNED'),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).eq('is_read', false),
        supabase.from('assignment_conversations').select('id', { count: 'exact', head: true }).eq('student_id', student.id).eq('status', 'WAITING_STUDENT'),
      ])

      setRecentPoints((pointRes.data || []) as PointTransaction[])

      const targets = targetsRes.data || []
      const now = new Date()
      const soon = new Date(now.getTime() + 3 * 86400000)

      const pending = targets.filter((t: Record<string, unknown>) => {
        const sub = t.submission as Record<string, unknown> | null
        return !sub || sub.status === 'DRAFT'
      })
      const graded = targets.filter((t: Record<string, unknown>) => {
        const sub = t.submission as Record<string, unknown> | null
        return sub?.status === 'GRADED'
      })
      const resubmit = targets.filter((t: Record<string, unknown>) => {
        const sub = t.submission as Record<string, unknown> | null
        return sub?.status === 'RESUBMISSION_REQUIRED'
      })
      const nearDue = pending.filter((t: Record<string, unknown>) => {
        const asgn = t.assignment as Record<string, unknown> | null
        if (!asgn?.due_at) return false
        const due = new Date(asgn.due_at as string)
        return due > now && due <= soon
      })

      setPendingAssignments(pending.slice(0, 3))
      setStats({
        totalPoints: 0,
        assignmentCount: targets.length,
        pendingCount: pending.length,
        gradedCount: graded.length,
        resubmitCount: resubmit.length,
        nearDueCount: nearDue.length,
        unreadMessages: msgRes.count || 0,
        unreadNotifications: notifRes.count || 0,
      })

      // Get total points
      const { data: pts } = await supabase.from('student_total_points').select('total_points').eq('student_id', student.id).single()
      if (pts) setStats(s => ({ ...s, totalPoints: pts.total_points || 0 }))
      setLoading(false)
    }
    load()
  }, [user])

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800">สวัสดี 👋</h1>
        <p className="text-slate-500 mt-0.5">ยินดีต้อนรับสู่ EduPoint LMS</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Point สะสม" value={stats.totalPoints.toLocaleString()} icon={<Star className="w-5 h-5" />} color="bg-amber-500" onClick={() => navigate('/student/points')} />
        <StatCard title="งานรอส่ง" value={stats.pendingCount} icon={<ClipboardList className="w-5 h-5" />} color="bg-primary-500" onClick={() => navigate('/student/assignments')} />
        <StatCard title="ตรวจแล้ว" value={stats.gradedCount} icon={<BookOpen className="w-5 h-5" />} color="bg-emerald-500" onClick={() => navigate('/student/grades')} />
        <StatCard title="รอแก้ไข" value={stats.resubmitCount} icon={<AlertCircle className="w-5 h-5" />} color="bg-orange-500" onClick={() => navigate('/student/assignments')} />
      </div>

      {/* Alerts */}
      {stats.nearDueCount > 0 && (
        <div className="alert-warning">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <p>มีงาน <strong>{stats.nearDueCount} ชิ้น</strong> ที่ใกล้ครบกำหนดใน 3 วัน!</p>
        </div>
      )}
      {stats.resubmitCount > 0 && (
        <div className="alert-error">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>มีงาน <strong>{stats.resubmitCount} ชิ้น</strong> ที่ครูขอให้แก้ไข</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending Assignments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">งานรอส่ง</h3>
            <button onClick={() => navigate('/student/assignments')} className="text-primary-600 text-sm hover:underline flex items-center gap-1">
              ดูทั้งหมด <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {pendingAssignments.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">🎉 ไม่มีงานค้าง!</p>
          ) : (
            <div className="space-y-3">
              {pendingAssignments.map((t: Record<string, unknown>) => {
                const asgn = t.assignment as Record<string, unknown> | null
                const sub = t.submission as Record<string, unknown> | null
                if (!asgn) return null
                const due = asgn.due_at ? new Date(asgn.due_at as string) : null
                const isNear = due && due <= new Date(Date.now() + 3 * 86400000)
                return (
                  <div key={t.id as string}
                    className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/student/assignments/${asgn.id}`)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-800 truncate">{asgn.title as string}</p>
                        {due && <p className={`text-xs mt-0.5 ${isNear ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
                          ⏰ ครบ {formatDateTime(asgn.due_at as string)}
                        </p>}
                      </div>
                      {sub && <SubmissionStatusBadge status={sub.status as string} />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Points */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Point ล่าสุด</h3>
            <button onClick={() => navigate('/student/points')} className="text-primary-600 text-sm hover:underline flex items-center gap-1">
              ดูทั้งหมด <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentPoints.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">ยังไม่มี Point</p>
          ) : (
            <div className="space-y-3">
              {recentPoints.map(pt => (
                <div key={pt.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${pt.points > 0 ? 'bg-amber-100' : 'bg-red-100'}`}>
                    {pt.source_type === 'GAME' ? '🎮' : pt.source_type === 'ASSIGNMENT' ? '📝' : pt.source_type === 'KIOSK' ? '🏫' : '⭐'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{pt.note || pt.source_type}</p>
                    <p className="text-xs text-slate-400">{formatRelativeTime(pt.created_at)}</p>
                  </div>
                  <span className={`text-sm font-bold ${pt.points > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {pt.points > 0 ? '+' : ''}{pt.points.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h3 className="font-bold text-slate-800 mb-4">ทำอะไรต่อไป?</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: 'งานของฉัน', emoji: '📋', to: '/student/assignments', color: 'bg-primary-50 text-primary-700 border-primary-200' },
            { label: 'ส่งงาน', emoji: '📤', to: '/student/assignments', color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'ถามครู', emoji: '💬', to: '/student/messages', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { label: 'ดู Point', emoji: '⭐', to: '/student/points', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
            { label: 'เล่นเกม', emoji: '🎮', to: '/student/games', color: 'bg-violet-50 text-violet-700 border-violet-200' },
          ].map(a => (
            <button key={a.to} onClick={() => navigate(a.to)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm font-medium ${a.color} hover:shadow-sm`}>
              <span className="text-2xl">{a.emoji}</span>{a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
