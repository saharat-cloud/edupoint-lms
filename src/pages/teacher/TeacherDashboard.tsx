import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, FileCheck, MessageCircle, Users, Star, TrendingUp, Plus, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { StatCard, SectionHeader, PageLoading, SubmissionStatusBadge, formatDateTime } from '../../components/ui/index'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface TeacherStats {
  totalAssignments: number
  activeAssignments: number
  pendingSubmissions: number
  waitingMessages: number
  totalStudents: number
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<TeacherStats>({ totalAssignments: 0, activeAssignments: 0, pendingSubmissions: 0, waitingMessages: 0, totalStudents: 0 })
  const [recentSubmissions, setRecentSubmissions] = useState<Array<Record<string, unknown>>>([])
  const [submissionsByStatus, setSubmissionsByStatus] = useState<Array<{ name: string; value: number; color: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const [assignRes, pendingRes, msgRes] = await Promise.all([
        supabase.from('assignments').select('id, status', { count: 'exact' }).eq('teacher_id', user!.id),
        supabase.from('submissions').select('id, status, submitted_at, student:students(first_name,last_name), assignment:assignments(title)', { count: 'exact' })
          .in('assignment_id', (await supabase.from('assignments').select('id').eq('teacher_id', user!.id)).data?.map((a: Record<string, unknown>) => a.id) || [])
          .eq('status', 'SUBMITTED')
          .order('submitted_at', { ascending: false })
          .limit(5),
        supabase.from('assignment_conversations').select('id', { count: 'exact' })
          .eq('teacher_id', user!.id).eq('status', 'WAITING_TEACHER'),
      ])

      const assignments = assignRes.data || []
      const activeAssignments = assignments.filter((a: Record<string, unknown>) => a.status === 'PUBLISHED').length

      // Count submissions by status
      const subsRes = await supabase.from('submissions').select('status')
        .in('assignment_id', assignments.map((a: Record<string, unknown>) => a.id as string))
      const statusCounts: Record<string, number> = {}
      ;(subsRes.data || []).forEach((s: Record<string, unknown>) => {
        statusCounts[s.status as string] = (statusCounts[s.status as string] || 0) + 1
      })

      setStats({
        totalAssignments: assignments.length,
        activeAssignments,
        pendingSubmissions: pendingRes.count || 0,
        waitingMessages: msgRes.count || 0,
        totalStudents: 0,
      })
      setRecentSubmissions(pendingRes.data || [])
      setSubmissionsByStatus([
        { name: 'รอตรวจ', value: statusCounts['SUBMITTED'] || 0, color: '#3b82f6' },
        { name: 'ตรวจแล้ว', value: statusCounts['GRADED'] || 0, color: '#10b981' },
        { name: 'แก้ไข', value: statusCounts['RESUBMISSION_REQUIRED'] || 0, color: '#f59e0b' },
        { name: 'ร่าง', value: statusCounts['DRAFT'] || 0, color: '#94a3b8' },
      ])
      setLoading(false)
    }
    load()
  }, [user])

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">สวัสดี ครู 👋</h1>
          <p className="text-slate-500 mt-1">ภาพรวมการสอนและการจัดการงาน</p>
        </div>
        <button onClick={() => navigate('/admin/assignments/create')} className="btn-primary">
          <Plus className="w-4 h-4" /> สร้างงานใหม่
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="งานทั้งหมด" value={stats.totalAssignments} icon={<ClipboardList className="w-5 h-5" />} color="bg-primary-500" onClick={() => navigate('/admin/assignments')} />
        <StatCard title="งานที่เปิดอยู่" value={stats.activeAssignments} icon={<TrendingUp className="w-5 h-5" />} color="bg-emerald-500" onClick={() => navigate('/admin/assignments')} />
        <StatCard title="รอตรวจ" value={stats.pendingSubmissions} icon={<FileCheck className="w-5 h-5" />} color="bg-amber-500" onClick={() => navigate('/admin/submissions')} />
        <StatCard title="รอตอบ" value={stats.waitingMessages} icon={<MessageCircle className="w-5 h-5" />} color="bg-rose-500" onClick={() => navigate('/admin/messages')} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent pending submissions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">งานรอตรวจล่าสุด</h3>
            <button onClick={() => navigate('/admin/submissions')} className="text-primary-600 text-sm font-medium hover:underline flex items-center gap-1">
              ดูทั้งหมด <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentSubmissions.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">ไม่มีงานรอตรวจ 🎉</p>
          ) : (
            <div className="space-y-3">
              {recentSubmissions.map((sub: Record<string, unknown>) => {
                const student = sub.student as Record<string, string> | null
                const assignment = sub.assignment as Record<string, string> | null
                return (
                  <div key={sub.id as string}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/submissions/${sub.id}`)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">{student?.first_name} {student?.last_name}</p>
                      <p className="text-xs text-slate-500 truncate">{assignment?.title}</p>
                    </div>
                    <div className="text-right">
                      <SubmissionStatusBadge status={sub.status as string} />
                      <p className="text-xs text-slate-400 mt-1">{formatDateTime(sub.submitted_at as string)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Submission Status Chart */}
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-4">สัดส่วนสถานะงาน</h3>
          {submissionsByStatus.every(s => s.value === 0) ? (
            <p className="text-slate-400 text-sm text-center py-10">ยังไม่มีข้อมูล</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={submissionsByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}>
                  {submissionsByStatus.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {submissionsByStatus.map(s => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name} ({s.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h3 className="font-bold text-slate-800 mb-4">การจัดการด่วน</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'สร้างงาน', emoji: '📝', to: '/admin/assignments/create', color: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100' },
            { label: 'ตรวจงาน', emoji: '✅', to: '/admin/submissions', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
            { label: 'ตอบคำถาม', emoji: '💬', to: '/admin/messages', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
            { label: 'Gradebook', emoji: '📊', to: '/admin/gradebook', color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' },
          ].map(a => (
            <button key={a.to} onClick={() => navigate(a.to)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm font-medium ${a.color}`}>
              <span className="text-2xl">{a.emoji}</span>{a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
