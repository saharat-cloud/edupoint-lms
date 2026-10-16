import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, CheckCircle, AlertCircle, FileText, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SectionHeader, PageLoading, EmptyState, SubmissionStatusBadge, formatDateTime, Badge, Tabs } from '../../components/ui/index'

const FILTERS = [
  { id: 'ALL', label: 'ทั้งหมด' },
  { id: 'PENDING', label: 'รอส่ง' },
  { id: 'SUBMITTED', label: 'รอตรวจ' },
  { id: 'GRADED', label: 'ตรวจแล้ว' },
  { id: 'RESUBMISSION_REQUIRED', label: 'แก้ไข' },
  { id: 'NEAR_DUE', label: 'ใกล้ครบกำหนด' },
]

export default function StudentAssignments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [targets, setTargets] = useState<Array<Record<string, unknown>>>([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('students').select('id').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setStudentId(data.id)
    })
  }, [user])

  useEffect(() => {
    if (!studentId) return
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('assignment_targets')
        .select(`
          *,
          assignment:assignments(id, title, description, due_at, academic_full_score, point_target, status, subject:subjects(name, code), teacher:profiles(full_name)),
          submission:submissions(id, status, academic_score, submitted_at, attempt_number)
        `)
        .eq('student_id', studentId)
        .order('assigned_at', { ascending: false })
      // For each target, get the latest submission
      const items = (data || []).map((t: Record<string, unknown>) => {
        const subs = Array.isArray(t.submission) ? t.submission : (t.submission ? [t.submission] : [])
        const latestSub = subs.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.attempt_number as number) - (a.attempt_number as number))[0]
        return { ...t, submission: latestSub || null }
      })
      setTargets(items)
      setLoading(false)
    }
    load()
  }, [studentId])

  const filtered = targets.filter(t => {
    const asgn = t.assignment as Record<string, unknown> | null
    const sub = t.submission as Record<string, unknown> | null
    const due = asgn?.due_at ? new Date(asgn.due_at as string) : null
    const now = new Date()

    if (filter === 'ALL') return true
    if (filter === 'PENDING') return !sub || sub.status === 'DRAFT'
    if (filter === 'SUBMITTED') return sub?.status === 'SUBMITTED' || sub?.status === 'REVIEWING'
    if (filter === 'GRADED') return sub?.status === 'GRADED'
    if (filter === 'RESUBMISSION_REQUIRED') return sub?.status === 'RESUBMISSION_REQUIRED'
    if (filter === 'NEAR_DUE') return due && due > now && due <= new Date(now.getTime() + 3 * 86400000) && (!sub || sub.status === 'DRAFT')
    return true
  })

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <SectionHeader title="งานของฉัน" subtitle={`${targets.length} รายการ`} />

      <Tabs tabs={FILTERS.map(f => ({ id: f.id, label: f.label }))} activeTab={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={<span className="text-3xl">📋</span>} title="ไม่พบงาน" description={filter === 'ALL' ? 'ยังไม่มีงานที่ได้รับมอบหมาย' : 'ไม่มีงานในหมวดนี้'} />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const asgn = t.assignment as Record<string, unknown> | null
            const sub = t.submission as Record<string, unknown> | null
            const subject = asgn?.subject as Record<string, string> | undefined
            const teacher = asgn?.teacher as Record<string, string> | undefined
            const due = asgn?.due_at ? new Date(asgn.due_at as string) : null
            const now = new Date()
            const isLate = due && now > due && (!sub || sub.status === 'DRAFT')
            const isNear = due && due > now && due <= new Date(now.getTime() + 3 * 86400000)

            if (!asgn) return null
            return (
              <div
                key={t.id as string}
                className={`card p-5 cursor-pointer hover:shadow-card-hover transition-shadow border-l-4 ${
                  sub?.status === 'RESUBMISSION_REQUIRED' ? 'border-l-orange-400' :
                  isLate ? 'border-l-red-400' :
                  isNear ? 'border-l-amber-400' :
                  sub?.status === 'GRADED' ? 'border-l-emerald-400' :
                  'border-l-transparent'
                }`}
                onClick={() => navigate(`/student/assignments/${asgn.id}`)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {subject && <Badge variant="indigo">{subject.code} {subject.name}</Badge>}
                      {sub ? <SubmissionStatusBadge status={sub.status as string} /> : <Badge variant="gray">รอส่ง</Badge>}
                      {isLate && <Badge variant="red">เลยกำหนด</Badge>}
                      {isNear && !isLate && <Badge variant="yellow">ใกล้ครบกำหนด</Badge>}
                    </div>
                    <h3 className="font-bold text-slate-800">{asgn.title as string}</h3>
                    <p className="text-xs text-slate-500 mt-1">ครู: {teacher?.full_name || '-'}</p>
                    <div className="flex gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                      <span>📊 เต็ม {asgn.academic_full_score as number} คะแนน</span>
                      <span>⭐ Point Target: {(asgn.point_target as number).toLocaleString()}</span>
                      {due && <span className={isLate ? 'text-red-500 font-medium' : isNear ? 'text-amber-500 font-medium' : ''}>
                        ⏰ {formatDateTime(asgn.due_at as string)}
                      </span>}
                    </div>
                    {sub?.academic_score != null && (
                      <p className="text-sm font-semibold text-emerald-600 mt-1">
                        คะแนน: {sub.academic_score as number} / {asgn.academic_full_score as number}
                      </p>
                    )}
                  </div>
                  <div className="text-primary-600 flex-shrink-0">›</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
