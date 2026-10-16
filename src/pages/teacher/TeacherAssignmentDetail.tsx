import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Users, FileText, Eye, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Assignment, AssignmentTarget, Submission } from '../../lib/types'
import { SectionHeader, PageLoading, AssignmentStatusBadge, SubmissionStatusBadge, Badge, formatDateTime, Avatar } from '../../components/ui/index'

export default function TeacherAssignmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [targets, setTargets] = useState<Array<AssignmentTarget & { submission?: Submission }>>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'students' | 'submitted'>('submitted')

  useEffect(() => {
    if (!id) return
    async function load() {
      const [aRes, tRes] = await Promise.all([
        supabase.from('assignments').select(`*, subject:subjects(name,code), semester:semesters(name), questions:assignment_questions(*)`).eq('id', id).single(),
        supabase.from('assignment_targets').select(`*, student:students(first_name,last_name,student_code,avatar_url)`).eq('assignment_id', id),
      ])
      if (aRes.data) setAssignment(aRes.data as Assignment)

      // Get latest submissions for each student
      const studentIds = (tRes.data || []).map((t: Record<string, unknown>) => t.student_id)
      let submissions: Submission[] = []
      if (studentIds.length > 0) {
        const { data } = await supabase.from('submissions')
          .select('*').eq('assignment_id', id).in('student_id', studentIds)
          .order('attempt_number', { ascending: false })
        submissions = data || []
      }

      const merged = (tRes.data || []).map((t: Record<string, unknown>) => {
        const latestSub = submissions.find((s: Submission) => s.student_id === t.student_id)
        return { ...t, submission: latestSub }
      })
      setTargets(merged as Array<AssignmentTarget & { submission?: Submission }>)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <PageLoading />
  if (!assignment) return <div className="card p-8 text-center text-slate-500">ไม่พบงาน</div>

  const subject = assignment.subject as Record<string, string> | undefined
  const submittedCount = targets.filter(t => t.submission && t.submission.status !== 'DRAFT').length
  const gradedCount = targets.filter(t => t.submission?.status === 'GRADED').length
  const pendingReview = targets.filter(t => t.submission && t.submission.status === 'SUBMITTED').length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/assignments')} className="btn-icon btn-ghost"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AssignmentStatusBadge status={assignment.status} />
            {subject && <Badge variant="indigo">{subject.code} {subject.name}</Badge>}
          </div>
          <h1 className="text-xl font-bold text-slate-800">{assignment.title}</h1>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'นักเรียนทั้งหมด', value: targets.length, color: 'text-slate-800' },
          { label: 'ส่งงานแล้ว', value: submittedCount, color: 'text-blue-600' },
          { label: 'ตรวจแล้ว', value: gradedCount, color: 'text-emerald-600' },
          { label: 'ยังไม่ส่ง', value: targets.length - submittedCount, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: 'submitted', label: `ส่งงานแล้ว`, count: submittedCount, badge: pendingReview > 0 ? pendingReview : null },
          { id: 'students', label: `นักเรียนทั้งหมด`, count: targets.length, badge: null },
          { id: 'info', label: 'ข้อมูลงาน', count: null, badge: null },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
            {t.count !== null && <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              tab === t.id ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
            }`}>{t.count}</span>}
            {t.badge !== null && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">รอ {t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="space-y-4">
          {assignment.description && (
            <div className="card p-5"><h3 className="font-semibold text-slate-700 mb-2">คำอธิบาย</h3><p className="text-slate-600 text-sm">{assignment.description}</p></div>
          )}
          {assignment.instructions && (
            <div className="card p-5"><h3 className="font-semibold text-slate-700 mb-2">คำสั่ง</h3><p className="text-slate-600 text-sm whitespace-pre-wrap">{assignment.instructions}</p></div>
          )}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 mb-3">คำถาม ({(assignment.questions || []).length} ข้อ)</h3>
            <div className="space-y-3">
              {(assignment.questions || []).sort((a, b) => a.sort_order - b.sort_order).map((q, i) => (
                <div key={q.id} className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                  <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{q.question_text}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{q.question_type} • {q.points} คะแนน</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Submitted Tab */}
      {tab === 'submitted' && (
        <div className="card overflow-hidden">
          {submittedCount === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <p className="text-4xl mb-3">📤</p>
              <p className="font-medium">ยังไม่มีนักเรียนส่งงาน</p>
            </div>
          ) : (
            <table className="table">
              <thead><tr>
                <th>#</th>
                <th>นักเรียน</th>
                <th>รหัส</th>
                <th>สถานะ</th>
                <th>คะแนน</th>
                <th>ส่งเมื่อ</th>
                <th className="text-right">จัดการ</th>
              </tr></thead>
              <tbody>
                {targets
                  .filter(t => t.submission && t.submission.status !== 'DRAFT')
                  .sort((a, b) => {
                    // SUBMITTED (รอตรวจ) ขึ้นก่อน, GRADED ทีหลัง
                    const order = { SUBMITTED: 0, RESUBMISSION_REQUIRED: 1, GRADED: 2 }
                    return (order[a.submission!.status as keyof typeof order] ?? 9) - (order[b.submission!.status as keyof typeof order] ?? 9)
                  })
                  .map((t, i) => {
                    const student = t.student as Record<string, string> | undefined
                    const sub = t.submission!
                    const isGraded = sub.status === 'GRADED'
                    return (
                      <tr key={t.id} className={isGraded ? 'opacity-70' : 'bg-amber-50/50'}>
                        <td className="text-slate-400 text-xs w-8">{i + 1}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Avatar name={`${student?.first_name} ${student?.last_name}`} src={student?.avatar_url} size="sm" />
                            <div>
                              <p className="text-sm font-semibold">{student?.first_name} {student?.last_name}</p>
                              {sub.is_late && <span className="text-[10px] text-red-500 font-medium">• ส่งสาย</span>}
                            </div>
                          </div>
                        </td>
                        <td className="font-mono text-xs text-slate-500">{student?.student_code}</td>
                        <td><SubmissionStatusBadge status={sub.status} /></td>
                        <td className="text-sm font-bold">
                          {sub.academic_score != null
                            ? <span className={isGraded ? 'text-emerald-600' : 'text-slate-700'}>{sub.academic_score}/{assignment.academic_full_score}</span>
                            : <span className="text-slate-300">-</span>
                          }
                        </td>
                        <td className="text-xs text-slate-500">{formatDateTime(sub.submitted_at)}</td>
                        <td><div className="flex justify-end">
                          <button
                            onClick={() => navigate(`/admin/submissions/${sub.id}`)}
                            className={`btn-sm ${isGraded ? 'btn-ghost' : 'btn-warning'}`}>
                            {isGraded ? <><Eye className="w-3.5 h-3.5" /> ดูได้</> : <><CheckCircle className="w-3.5 h-3.5" /> ตรวจงาน</>}
                          </button>
                        </div></td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}


      {tab === 'students' && (
        <div className="card">
          <table className="table">
            <thead><tr><th>นักเรียน</th><th>รหัส</th><th>สถานะ</th><th>คะแนน</th><th>ครั้งที่ส่ง</th><th className="text-right">จัดการ</th></tr></thead>
            <tbody>
              {targets.map(t => {
                const student = t.student as Record<string, string> | undefined
                const sub = t.submission
                return (
                  <tr key={t.id}>
                    <td><div className="flex items-center gap-2">
                      <Avatar name={`${student?.first_name} ${student?.last_name}`} src={student?.avatar_url} size="sm" />
                      <span className="text-sm font-medium">{student?.first_name} {student?.last_name}</span>
                    </div></td>
                    <td className="font-mono text-xs text-slate-500">{student?.student_code}</td>
                    <td>{sub ? <SubmissionStatusBadge status={sub.status} /> : <Badge variant="gray">ยังไม่ส่ง</Badge>}</td>
                    <td className="text-sm">{sub?.academic_score != null ? `${sub.academic_score}/${assignment.academic_full_score}` : '-'}</td>
                    <td className="text-sm">{sub ? `ครั้งที่ ${sub.attempt_number}` : '-'}</td>
                    <td><div className="flex justify-end">
                      {sub && sub.status !== 'DRAFT' && (
                        <button onClick={() => navigate(`/admin/submissions/${sub.id}`)} className="btn-primary btn-sm">ตรวจ</button>
                      )}
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
