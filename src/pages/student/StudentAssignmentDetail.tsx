import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, Send, MessageCircle, X, Paperclip } from 'lucide-react'
import { supabase, uploadFile } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Assignment, AssignmentQuestion, Submission, AssignmentConversation } from '../../lib/types'
import { PageLoading, SubmissionStatusBadge, showSuccess, showError, confirmAction, Spinner, Badge, formatDateTime, formatFileSize, FileTypeIcon } from '../../components/ui/index'

interface QuestionAnswer {
  question_id: string
  answer_text: string
  selected_option: string
}

export default function StudentAssignmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [questions, setQuestions] = useState<AssignmentQuestion[]>([])
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({})
  const [files, setFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [conversation, setConversation] = useState<AssignmentConversation | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [showChat, setShowChat] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user || !id) return
    async function load() {
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user!.id).single()
      if (!student) { setLoading(false); return }
      setStudentId(student.id)

      const [asgnRes, subRes, convRes] = await Promise.all([
        supabase.from('assignments').select('*, questions:assignment_questions(*), subject:subjects(name,code), teacher:profiles(id,full_name)').eq('id', id).single(),
        supabase.from('submissions').select('*').eq('assignment_id', id).eq('student_id', student.id).order('attempt_number', { ascending: false }).limit(1).single(),
        supabase.from('assignment_conversations').select('*').eq('assignment_id', id).eq('student_id', student.id).single(),
      ])
      if (asgnRes.data) {
        setAssignment(asgnRes.data as Assignment)
        setQuestions(((asgnRes.data as Assignment).questions || []).sort((a, b) => a.sort_order - b.sort_order))
      }
      if (subRes.data) setSubmission(subRes.data as Submission)
      if (convRes.data) setConversation(convRes.data as AssignmentConversation)
      setLoading(false)
    }
    load()
  }, [user, id])

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return
    const added = Array.from(newFiles)
    const totalSize = [...files, ...added].reduce((s, f) => s + f.size, 0)
    if (totalSize > 50 * 1024 * 1024) { showError('ขนาดไฟล์รวมเกิน 50MB'); return }
    setFiles(f => [...f, ...added])
  }

  function removeFile(index: number) { setFiles(f => f.filter((_, i) => i !== index)) }

  async function handleSubmit(saveAsDraft = false) {
    if (!studentId || !assignment || !id) return

    // Validate required questions
    if (!saveAsDraft) {
      const missingRequired = questions.filter(q => q.required && !answers[q.id]?.answer_text?.trim() && !answers[q.id]?.selected_option?.trim())
      if (missingRequired.length > 0) {
        await showError(`กรุณาตอบคำถามที่จำเป็น (${missingRequired.length} ข้อ)`)
        return
      }
    }

    const isResubmit = submission?.status === 'RESUBMISSION_REQUIRED' || submission?.status === 'RETURNED'
    if (!saveAsDraft && !isResubmit) {
      const ok = await confirmAction('ส่งงาน?', 'เมื่อส่งแล้วครูจะสามารถตรวจงานได้', 'ส่งงาน')
      if (!ok) return
    }

    setSubmitting(true)
    try {
      let submissionId = submission?.id
      const attempt = submission ? submission.attempt_number + (isResubmit ? 1 : 0) : 1

      if (!submissionId) {
        const { data, error } = await supabase.from('submissions').insert({
          assignment_id: id,
          student_id: studentId,
          status: 'DRAFT',
          attempt_number: attempt,
        }).select('id').single()
        if (error) throw error
        submissionId = data.id
      }

      // Save answers
      if (Object.keys(answers).length > 0) {
        for (const [qId, ans] of Object.entries(answers)) {
          await supabase.from('submission_answers').upsert({
            submission_id: submissionId,
            question_id: qId,
            answer_text: ans.answer_text || ans.selected_option || '',
          }, { onConflict: 'submission_id,question_id' })
        }
      }

      // Upload files
      if (files.length > 0) {
        for (const file of files) {
          const path = `${studentId}/${submissionId}/${Date.now()}_${file.name}`
          const url = await uploadFile('submission-files', path, file)
          if (url) {
            await supabase.from('submission_files').insert({
              submission_id: submissionId,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              storage_path: path,
            })
          }
        }
      }

      // Update submission status
      if (!saveAsDraft) {
        const { error } = await supabase.from('submissions').update({
          status: 'SUBMITTED',
          submitted_at: new Date().toISOString(),
          attempt_number: attempt,
        }).eq('id', submissionId!)
        if (error) throw error

        // Notify teacher
        const teacher = assignment.teacher as Record<string, unknown> | undefined
        if (teacher?.id) {
          await supabase.from('notifications').insert({
            user_id: teacher.id as string,
            type: 'SUBMISSION_RECEIVED',
            title: 'นักเรียนส่งงานแล้ว',
            message: assignment.title,
            reference_type: 'submission',
            reference_id: submissionId,
          })
        }
        await showSuccess('ส่งงานสำเร็จ! 🎉', 'รอครูตรวจงานของคุณ')
      } else {
        await supabase.from('submissions').update({ status: 'DRAFT' }).eq('id', submissionId!)
        await showSuccess('บันทึกร่างแล้ว')
      }

      navigate('/student/assignments')
    } catch (err: unknown) {
      await showError('ส่งงานไม่สำเร็จ', err instanceof Error ? err.message : '')
    } finally { setSubmitting(false) }
  }

  async function startConversation() {
    if (!chatMessage.trim() || !studentId || !assignment || !id) return
    const { data: teacher } = await supabase.from('assignments').select('teacher_id').eq('id', id).single()
    if (!teacher) return

    let convId = conversation?.id
    if (!convId) {
      const { data, error } = await supabase.from('assignment_conversations').insert({
        assignment_id: id,
        student_id: studentId,
        teacher_id: teacher.teacher_id,
        status: 'WAITING_TEACHER',
        last_message_at: new Date().toISOString(),
        last_message_by: user!.id,
      }).select('id').single()
      if (error) { await showError('เริ่มการสนทนาไม่สำเร็จ', error.message); return }
      convId = data.id
      const { data: newConv } = await supabase.from('assignment_conversations').select('*').eq('id', convId).single()
      setConversation(newConv as AssignmentConversation)
    }

    await supabase.from('conversation_messages').insert({
      conversation_id: convId,
      sender_user_id: user!.id,
      sender_role: 'STUDENT',
      message: chatMessage.trim(),
    })

    // Notify teacher
    await supabase.from('notifications').insert({
      user_id: teacher.teacher_id,
      type: 'STUDENT_QUESTION',
      title: 'นักเรียนถามคำถาม',
      message: chatMessage.slice(0, 100),
      reference_type: 'conversation',
      reference_id: convId,
    })

    setChatMessage('')
    await showSuccess('ส่งคำถามถึงครูแล้ว')
    setShowChat(false)
    navigate('/student/messages')
  }

  if (loading) return <PageLoading />
  if (!assignment) return <div className="card p-8 text-center">ไม่พบงาน</div>

  const subject = assignment.subject as Record<string, string> | undefined
  const teacher = assignment.teacher as Record<string, string> | undefined
  const canSubmit = assignment.status === 'PUBLISHED' && (!submission || ['DRAFT', 'RESUBMISSION_REQUIRED', 'RETURNED'].includes(submission.status))

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/student/assignments')} className="btn-icon btn-ghost"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          {subject && <Badge variant="indigo">{subject.code} {subject.name}</Badge>}
          <h1 className="text-xl font-bold text-slate-800 mt-1 truncate">{assignment.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">ครู: {teacher?.full_name || '-'}</p>
        </div>
        {submission && <SubmissionStatusBadge status={submission.status} />}
      </div>

      {/* Info card */}
      <div className="card p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-xl font-bold text-primary-600">{assignment.academic_full_score}</p><p className="text-xs text-slate-500">คะแนนเต็ม</p></div>
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-xl font-bold text-amber-600">{assignment.point_target.toLocaleString()}</p><p className="text-xs text-slate-500">Point Target</p></div>
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-sm font-bold text-slate-700">{assignment.due_at ? formatDateTime(assignment.due_at) : 'ไม่กำหนด'}</p><p className="text-xs text-slate-500">ครบกำหนด</p></div>
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-xl font-bold text-violet-600">{questions.length}</p><p className="text-xs text-slate-500">คำถาม</p></div>
        </div>
        {assignment.description && <p className="text-slate-600 text-sm mt-4">{assignment.description}</p>}
        {assignment.instructions && (
          <div className="mt-3 p-3 bg-blue-50 rounded-xl"><p className="text-xs font-semibold text-blue-700 mb-1">คำสั่ง:</p><p className="text-sm text-blue-700 whitespace-pre-wrap">{assignment.instructions}</p></div>
        )}
      </div>

      {/* Graded result */}
      {submission?.status === 'GRADED' && (
        <div className="card p-5 border-l-4 border-l-emerald-400">
          <h3 className="font-bold text-slate-800 mb-2">ผลการตรวจ</h3>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-4xl font-black text-emerald-600">{submission.academic_score}</div>
            <div>
              <p className="text-slate-500 text-sm">จาก {assignment.academic_full_score} คะแนน</p>
              {submission.points_earned && <p className="text-amber-600 font-semibold">⭐ +{submission.points_earned} Point</p>}
            </div>
          </div>
          {submission.teacher_feedback && (
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500 mb-1">Feedback จากครู:</p><p className="text-sm text-slate-700">{submission.teacher_feedback}</p></div>
          )}
        </div>
      )}

      {/* Questions form */}
      {canSubmit && questions.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800">คำถาม</h3>
          {questions.map((q, i) => (
            <div key={q.id} className="card p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{q.question_text}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{q.points} คะแนน {q.required && '• จำเป็น'}</p>
                </div>
              </div>

              {(q.question_type === 'SHORT_ANSWER' || q.question_type === 'TEXT') && (
                <textarea
                  className="form-textarea"
                  rows={q.question_type === 'TEXT' ? 5 : 2}
                  placeholder="พิมพ์คำตอบ..."
                  value={answers[q.id]?.answer_text || ''}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: { question_id: q.id, answer_text: e.target.value, selected_option: '' } }))}
                />
              )}
              {q.question_type === 'MULTIPLE_CHOICE' && q.options && (
                <div className="space-y-2">
                  {q.options.filter(o => o).map((opt, oi) => (
                    <label key={oi} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${answers[q.id]?.selected_option === opt ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-primary-200'}`}>
                      <input type="radio" name={`q-${q.id}`} value={opt} checked={answers[q.id]?.selected_option === opt}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: { question_id: q.id, answer_text: opt, selected_option: opt } }))}
                        className="text-primary-600" />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.question_type === 'TRUE_FALSE' && (
                <div className="flex gap-3">
                  {['ถูก', 'ผิด'].map(v => (
                    <label key={v} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${answers[q.id]?.selected_option === v ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-primary-200'}`}>
                      <input type="radio" name={`tf-${q.id}`} value={v} checked={answers[q.id]?.selected_option === v}
                        onChange={() => setAnswers(a => ({ ...a, [q.id]: { question_id: q.id, answer_text: v, selected_option: v } }))}
                        className="text-primary-600" />
                      <span className="font-medium">{v}</span>
                    </label>
                  ))}
                </div>
              )}
              {(q.question_type === 'FILE_UPLOAD' || q.question_type === 'IMAGE_UPLOAD') && (
                <p className="text-sm text-slate-500 italic">อัพโหลดไฟล์ด้านล่าง</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* File Upload */}
      {canSubmit && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-slate-600" />
            <h3 className="font-semibold text-slate-700">แนบไฟล์</h3>
          </div>
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-all"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
          >
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">คลิกหรือลากไฟล์มาวางที่นี่</p>
            <p className="text-xs text-slate-400 mt-1">รองรับทุกประเภทไฟล์ • รวมสูงสุด 50MB</p>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} accept="*" />
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <FileTypeIcon fileType={f.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{f.name}</p>
                    <p className="text-xs text-slate-400">{formatFileSize(f.size)}</p>
                  </div>
                  <button onClick={() => removeFile(i)} className="btn-icon btn-ghost text-red-400"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ask teacher */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700">ถามครู</h3>
          {conversation && <Badge variant={conversation.status === 'WAITING_STUDENT' ? 'blue' : conversation.status === 'RESOLVED' ? 'green' : 'orange'}>{conversation.status === 'WAITING_STUDENT' ? 'ครูตอบแล้ว' : conversation.status === 'RESOLVED' ? 'แก้ไขแล้ว' : 'รอครูตอบ'}</Badge>}
        </div>
        {showChat ? (
          <div className="space-y-2">
            <textarea className="form-textarea" rows={3} placeholder="พิมพ์คำถามถึงครู..." value={chatMessage} onChange={e => setChatMessage(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowChat(false)} className="btn-secondary btn-sm">ยกเลิก</button>
              <button onClick={startConversation} className="btn-primary btn-sm"><Send className="w-3.5 h-3.5" /> ส่งคำถาม</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {conversation ? (
              <button onClick={() => navigate('/student/messages')} className="btn-secondary btn-sm"><MessageCircle className="w-4 h-4" /> ดูการสนทนา</button>
            ) : (
              <button onClick={() => setShowChat(true)} className="btn-secondary btn-sm"><MessageCircle className="w-4 h-4" /> ถามครู</button>
            )}
          </div>
        )}
      </div>

      {/* Submit actions */}
      {canSubmit && (
        <div className="flex justify-end gap-3">
          <button onClick={() => handleSubmit(true)} disabled={submitting} className="btn-secondary">
            บันทึกร่าง
          </button>
          <button onClick={() => handleSubmit(false)} disabled={submitting} id="submit-assignment-btn" className="btn-primary">
            {submitting ? <Spinner size="sm" className="text-white" /> : <><Send className="w-4 h-4" /> ส่งงาน</>}
          </button>
        </div>
      )}

      {!canSubmit && submission && (
        <div className="alert-info">
          <span>ℹ️</span>
          <p>งานนี้ถูกส่งแล้ว สถานะ: <strong>{submission.status}</strong> ส่งเมื่อ: {formatDateTime(submission.submitted_at)}</p>
        </div>
      )}
    </div>
  )
}
