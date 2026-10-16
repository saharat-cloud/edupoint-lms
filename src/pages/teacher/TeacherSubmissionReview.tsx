import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Star, CheckCircle, RotateCcw, Download } from 'lucide-react'
import { supabase, getSignedUrl } from '../../lib/supabase'
import type { Submission, Assignment, AssignmentQuestion, SubmissionAnswer, SubmissionFile } from '../../lib/types'
import { PageLoading, SubmissionStatusBadge, showSuccess, showError, confirmAction, formatDateTime, Avatar, Spinner, FileTypeIcon, formatFileSize } from '../../components/ui/index'

export default function TeacherSubmissionReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [questions, setQuestions] = useState<AssignmentQuestion[]>([])
  const [answers, setAnswers] = useState<SubmissionAnswer[]>([])
  const [files, setFiles] = useState<SubmissionFile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Grading state
  const [overallScore, setOverallScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [questionScores, setQuestionScores] = useState<Record<string, { score: string; feedback: string }>>({})

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data: sub } = await supabase.from('submissions')
        .select(`*, student:students(first_name,last_name,student_code,avatar_url)`)
        .eq('id', id).single()
      if (!sub) { setLoading(false); return }
      setSubmission(sub as Submission)
      setFeedback(sub.teacher_feedback || '')
      setOverallScore(sub.academic_score?.toString() || '')

      const { data: asgn } = await supabase.from('assignments').select('*, questions:assignment_questions(*)').eq('id', sub.assignment_id).single()
      if (asgn) {
        setAssignment(asgn as Assignment)
        setQuestions(((asgn as Assignment).questions || []).sort((a: AssignmentQuestion, b: AssignmentQuestion) => a.sort_order - b.sort_order))
      }

      const { data: ans } = await supabase.from('submission_answers').select('*').eq('submission_id', id)
      if (ans) {
        setAnswers(ans as SubmissionAnswer[])
        const scores: Record<string, { score: string; feedback: string }> = {}
        ;(ans as SubmissionAnswer[]).forEach(a => {
          scores[a.question_id] = { score: a.teacher_score?.toString() || '', feedback: a.teacher_feedback || '' }
        })
        setQuestionScores(scores)
      }

      const { data: fs } = await supabase.from('submission_files').select('*').eq('submission_id', id)
      if (fs) {
        // Get signed URLs for files
        const withUrls = await Promise.all((fs as SubmissionFile[]).map(async f => ({
          ...f,
          signed_url: await getSignedUrl('submission-files', f.storage_path),
        })))
        setFiles(withUrls)
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function handleGrade(newStatus: 'GRADED' | 'RESUBMISSION_REQUIRED') {
    if (!overallScore && newStatus === 'GRADED') {
      await showError('กรุณากรอกคะแนน')
      return
    }
    const actionLabel = newStatus === 'GRADED' ? 'ให้คะแนนและอนุมัติ' : 'ส่งกลับให้แก้ไข'
    const ok = await confirmAction(`${actionLabel}?`, newStatus === 'GRADED' ? `คะแนน: ${overallScore}/${assignment?.academic_full_score}` : 'นักเรียนจะได้รับการแจ้งเตือนให้แก้ไข', actionLabel)
    if (!ok) return

    setSaving(true)
    try {
      const qScoresForRPC: Record<string, { score: number; feedback: string }> = {}
      Object.entries(questionScores).forEach(([qId, v]) => {
        qScoresForRPC[qId] = { score: parseFloat(v.score) || 0, feedback: v.feedback }
      })

      const { data, error } = await supabase.rpc('award_assignment_point', {
        p_submission_id: id,
        p_academic_score: parseFloat(overallScore) || 0,
        p_teacher_feedback: feedback,
        p_question_scores: qScoresForRPC,
        p_new_status: newStatus,
      })
      if (error) throw error
      const result = data as { success: boolean; message?: string }
      if (!result.success) throw new Error(result.message || 'เกิดข้อผิดพลาด')
      await showSuccess(newStatus === 'GRADED' ? 'ให้คะแนนสำเร็จ!' : 'ส่งกลับให้แก้ไขแล้ว')
      navigate('/admin/submissions')
    } catch (err: unknown) {
      await showError('เกิดข้อผิดพลาด', err instanceof Error ? err.message : '')
    } finally { setSaving(false) }
  }

  if (loading) return <PageLoading />
  if (!submission || !assignment) return <div className="card p-8 text-center">ไม่พบข้อมูล</div>

  const student = submission.student as Record<string, string> | undefined
  const totalQuestionScore = Object.values(questionScores).reduce((s, v) => s + (parseFloat(v.score) || 0), 0)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/submissions')} className="btn-icon btn-ghost"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <p className="text-sm text-slate-500">{assignment.title}</p>
          <h1 className="text-xl font-bold text-slate-800">{student?.first_name} {student?.last_name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <SubmissionStatusBadge status={submission.status} />
          {submission.is_late && <span className="badge-red">ส่งสาย</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Submission content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Files */}
          {files.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-700 mb-3">ไฟล์ที่แนบ ({files.length})</h3>
              <div className="space-y-2">
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <FileTypeIcon fileType={f.file_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.file_name}</p>
                      <p className="text-xs text-slate-500">{f.file_size ? formatFileSize(f.file_size) : ''}</p>
                    </div>
                    {f.signed_url && (
                      <a href={f.signed_url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                        <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions & Answers */}
          {questions.map((q, i) => {
            const answer = answers.find(a => a.question_id === q.id)
            const qScore = questionScores[q.id] || { score: '', feedback: '' }
            return (
              <div key={q.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">ข้อ {i + 1} • {q.question_type} • {q.points} คะแนน</p>
                    <p className="font-semibold text-slate-800">{q.question_text}</p>
                  </div>
                </div>
                {/* Student's answer */}
                <div className="bg-slate-50 rounded-xl p-3 mb-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">คำตอบนักเรียน:</p>
                  {answer?.answer_text ? (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{answer.answer_text}</p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">ไม่มีคำตอบ</p>
                  )}
                </div>
                {/* Teacher scoring for this question */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label text-xs">คะแนน (/{q.points})</label>
                    <input type="number" step="0.5" min="0" max={q.points} className="form-input"
                      value={qScore.score}
                      onChange={e => setQuestionScores(s => ({ ...s, [q.id]: { ...s[q.id], score: e.target.value } }))}
                      placeholder="0" />
                  </div>
                  <div>
                    <label className="form-label text-xs">Feedback ข้อนี้</label>
                    <input className="form-input" value={qScore.feedback}
                      onChange={e => setQuestionScores(s => ({ ...s, [q.id]: { ...s[q.id], feedback: e.target.value } }))}
                      placeholder="ความคิดเห็น..." />
                  </div>
                </div>
              </div>
            )
          })}

          {/* If no structured questions, show overall answer area */}
          {questions.length === 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-700 mb-3">คำตอบ/ไฟล์</h3>
              {answers.length === 0 && files.length === 0 && (
                <p className="text-slate-400 text-sm">นักเรียนยังไม่ได้ตอบหรืออัพโหลดไฟล์</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Grading panel */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4 sticky top-6">
            <h3 className="font-bold text-slate-800">ให้คะแนน</h3>

            {/* Auto-calculated from questions */}
            {questions.length > 0 && (
              <div className="bg-primary-50 rounded-xl p-3">
                <p className="text-xs text-primary-600">รวมจากคำถาม: {totalQuestionScore.toFixed(1)} / {questions.reduce((s, q) => s + q.points, 0)}</p>
              </div>
            )}

            <div>
              <label className="form-label">คะแนนรวม *<span className="text-slate-400"> (/{assignment.academic_full_score})</span></label>
              <input
                type="number"
                step="0.5"
                min="0"
                max={assignment.academic_full_score}
                className="form-input text-lg font-bold"
                value={overallScore}
                onChange={e => setOverallScore(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <label className="form-label">Feedback รวม</label>
              <textarea className="form-textarea" rows={4} value={feedback} onChange={e => setFeedback(e.target.value)}
                placeholder="ความคิดเห็นและข้อแนะนำสำหรับนักเรียน..." />
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleGrade('GRADED')}
                disabled={saving}
                id="grade-submit-btn"
                className="btn-success w-full"
              >
                {saving ? <Spinner size="sm" className="text-white" /> : <><CheckCircle className="w-4 h-4" /> อนุมัติ / ให้คะแนน</>}
              </button>
              <button
                onClick={() => handleGrade('RESUBMISSION_REQUIRED')}
                disabled={saving}
                className="btn-warning w-full"
              >
                <RotateCcw className="w-4 h-4" /> ส่งกลับให้แก้ไข
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
              <p>ส่งเมื่อ: {formatDateTime(submission.submitted_at)}</p>
              <p>ครั้งที่: {submission.attempt_number}</p>
              {submission.reviewed_at && <p>ตรวจเมื่อ: {formatDateTime(submission.reviewed_at)}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
