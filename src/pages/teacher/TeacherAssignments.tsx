import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Archive, Send, FileText, Settings, ArrowLeft, Users, DoorOpen, CheckCircle, RotateCcw, X, Download, ClipboardCheck } from 'lucide-react'
import { supabase, getSignedUrl } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Assignment, Subject, Semester } from '../../lib/types'
import {
  SearchInput, PageLoading, EmptyState, AssignmentStatusBadge, SubmissionStatusBadge,
  formatDateTime, confirmAction, showSuccess, showError, showToast, Badge, Spinner,
  FileTypeIcon, formatFileSize
} from '../../components/ui/index'

// ── Inline Review Modal ────────────────────────────────────────────────────
function ReviewModal({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [answers, setAnswers] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [overallScore, setOverallScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [questionScores, setQuestionScores] = useState<Record<string, { score: string; feedback: string }>>({})

  useEffect(() => {
    async function loadSubmissions() {
      setLoading(true)
      const { data } = await supabase
        .from('submissions')
        .select('*, student:students(first_name,last_name,student_code,nickname)')
        .eq('assignment_id', assignment.id)
        .order('submitted_at', { ascending: false })
      setSubmissions(data || [])

      // Load questions
      const { data: qs } = await supabase.from('assignment_questions')
        .select('*').eq('assignment_id', assignment.id).order('sort_order')
      setQuestions(qs || [])
      setLoading(false)
    }
    loadSubmissions()
  }, [assignment.id])

  async function selectSubmission(sub: any) {
    setSelected(sub)
    setOverallScore(sub.academic_score?.toString() || '')
    setFeedback(sub.teacher_feedback || '')

    const [ansRes, fileRes] = await Promise.all([
      supabase.from('submission_answers').select('*').eq('submission_id', sub.id),
      supabase.from('submission_files').select('*').eq('submission_id', sub.id),
    ])
    setAnswers(ansRes.data || [])

    // Sign file URLs
    const withUrls = await Promise.all((fileRes.data || []).map(async (f: any) => ({
      ...f, signed_url: await getSignedUrl('submission-files', f.storage_path)
    })))
    setFiles(withUrls)

    const scores: Record<string, { score: string; feedback: string }> = {}
    ;(ansRes.data || []).forEach((a: any) => {
      scores[a.question_id] = { score: a.teacher_score?.toString() || '', feedback: a.teacher_feedback || '' }
    })
    setQuestionScores(scores)
  }

  async function handleGrade(newStatus: 'GRADED' | 'RESUBMISSION_REQUIRED') {
    if (!overallScore && newStatus === 'GRADED') { await showError('กรุณากรอกคะแนน'); return }
    const ok = await confirmAction(
      newStatus === 'GRADED' ? 'ให้คะแนนและอนุมัติ?' : 'ส่งกลับให้แก้ไข?',
      newStatus === 'GRADED' ? `คะแนน: ${overallScore}/${assignment.academic_full_score}` : 'นักเรียนจะได้รับการแจ้งเตือน',
      newStatus === 'GRADED' ? 'อนุมัติ' : 'ส่งกลับ'
    )
    if (!ok) return
    setSaving(true)
    try {
      const qScores: Record<string, { score: number; feedback: string }> = {}
      Object.entries(questionScores).forEach(([qId, v]) => {
        qScores[qId] = { score: parseFloat(v.score) || 0, feedback: v.feedback }
      })
      const { data, error } = await supabase.rpc('award_assignment_point', {
        p_submission_id: selected.id,
        p_academic_score: parseFloat(overallScore) || 0,
        p_teacher_feedback: feedback,
        p_question_scores: qScores,
        p_new_status: newStatus,
      })
      if (error) throw error
      const result = data as { success: boolean; message?: string }
      if (!result.success) throw new Error(result.message || 'เกิดข้อผิดพลาด')
      await showSuccess(newStatus === 'GRADED' ? 'ให้คะแนนสำเร็จ!' : 'ส่งกลับแล้ว')
      // Refresh submission list
      const updated = submissions.map(s => s.id === selected.id ? { ...s, status: newStatus, academic_score: parseFloat(overallScore) } : s)
      setSubmissions(updated)
      setSelected({ ...selected, status: newStatus, academic_score: parseFloat(overallScore) })
    } catch (err: any) {
      await showError('เกิดข้อผิดพลาด', err.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" /> ตรวจงาน
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{assignment.title}</p>
          </div>
          <button onClick={onClose} className="btn-icon btn-ghost"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Submission list */}
          <div className="w-64 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
            <div className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
              งานที่ส่ง ({submissions.length})
            </div>
            {loading ? (
              <div className="p-6 flex justify-center"><Spinner /></div>
            ) : submissions.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">ยังไม่มีนักเรียนส่งงาน</div>
            ) : (
              submissions.map(sub => {
                const st = sub.student as any
                const isSelected = selected?.id === sub.id
                return (
                  <button key={sub.id} onClick={() => selectSubmission(sub)}
                    className={`w-full text-left p-3 border-b border-slate-100 hover:bg-white transition-colors ${isSelected ? 'bg-white border-l-2 border-l-indigo-500' : ''}`}>
                    <div className="font-medium text-sm text-slate-700">{st?.first_name} {st?.last_name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{st?.student_code}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <SubmissionStatusBadge status={sub.status} />
                      {sub.academic_score !== null && (
                        <span className="text-xs font-bold text-indigo-600">{sub.academic_score}/{assignment.academic_full_score}</span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Right: Grading area */}
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50">
              <div className="text-center">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>เลือกนักเรียนด้านซ้ายเพื่อตรวจงาน</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto flex gap-0">
              {/* Content area */}
              <div className="flex-1 p-5 space-y-4 overflow-y-auto">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800">{(selected.student as any)?.first_name} {(selected.student as any)?.last_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <SubmissionStatusBadge status={selected.status} />
                      {selected.is_late && <span className="badge-red text-xs">ส่งสาย</span>}
                      <span className="text-xs text-slate-500">ส่งเมื่อ {formatDateTime(selected.submitted_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Files */}
                {files.length > 0 && (
                  <div className="card p-4">
                    <h4 className="font-semibold text-slate-700 text-sm mb-3">ไฟล์ที่แนบ ({files.length})</h4>
                    <div className="space-y-2">
                      {files.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
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

                {/* Q&A */}
                {questions.map((q, i) => {
                  const ans = answers.find(a => a.question_id === q.id)
                  const qScore = questionScores[q.id] || { score: '', feedback: '' }
                  return (
                    <div key={q.id} className="card p-4">
                      <p className="text-xs text-slate-500 mb-1">ข้อ {i+1} • {q.points} คะแนน</p>
                      <p className="font-semibold text-slate-800 text-sm mb-2">{q.question_text}</p>
                      <div className="bg-slate-50 rounded-lg p-3 mb-3">
                        <p className="text-xs font-medium text-slate-500 mb-1">คำตอบนักเรียน:</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{ans?.answer_text || <span className="italic text-slate-400">ไม่มีคำตอบ</span>}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
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

                {questions.length === 0 && files.length === 0 && answers.length === 0 && (
                  <div className="card p-6 text-center text-slate-400 text-sm">นักเรียนยังไม่ได้ส่งคำตอบหรือไฟล์</div>
                )}
              </div>

              {/* Grading panel */}
              <div className="w-56 flex-shrink-0 border-l border-slate-200 p-4 space-y-4 overflow-y-auto bg-slate-50/50">
                <h4 className="font-bold text-slate-800 text-sm">ให้คะแนน</h4>
                <div>
                  <label className="form-label text-xs">คะแนนรวม * <span className="text-slate-400">(/{assignment.academic_full_score})</span></label>
                  <input type="number" step="0.5" min="0" max={assignment.academic_full_score}
                    className="form-input text-base font-bold"
                    value={overallScore} onChange={e => setOverallScore(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="form-label text-xs">Feedback รวม</label>
                  <textarea className="form-textarea text-sm" rows={4} value={feedback}
                    onChange={e => setFeedback(e.target.value)} placeholder="ความคิดเห็น..." />
                </div>
                <div className="space-y-2">
                  <button onClick={() => handleGrade('GRADED')} disabled={saving} className="btn-success w-full text-sm">
                    {saving ? <Spinner size="sm" className="text-white" /> : <><CheckCircle className="w-4 h-4" /> อนุมัติ / ให้คะแนน</>}
                  </button>
                  <button onClick={() => handleGrade('RESUBMISSION_REQUIRED')} disabled={saving} className="btn-warning w-full text-sm">
                    <RotateCcw className="w-4 h-4" /> ส่งกลับให้แก้ไข
                  </button>
                </div>
                <div className="pt-3 border-t border-slate-200 text-xs text-slate-400 space-y-1">
                  <p>ส่งเมื่อ: {formatDateTime(selected.submitted_at)}</p>
                  <p>ครั้งที่: {selected.attempt_number}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TeacherAssignments() {
  const { user, role } = useAuth()
  const navigate = useNavigate()

  // ── Navigation state (3 levels) ─────────────────────────
  // Level 0: Subject cards
  // Level 1: Classroom cards
  // Level 2: Assignment list
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedSemesterId, setSelectedSemesterId] = useState('')

  // ── Data ────────────────────────────────────────────────
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [classRooms, setClassRooms] = useState<any[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [groupMissions, setGroupMissions] = useState<any[]>([])

  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [mode, setMode] = useState<'INDIVIDUAL' | 'GROUP'>('INDIVIDUAL')

  const [editingAssignment, setEditingAssignment] = useState<any | null>(null)
  const [editAsgTitle, setEditAsgTitle] = useState('')
  const [editAsgScore, setEditAsgScore] = useState('')
  const [editAsgPoints, setEditAsgPoints] = useState('')
  const [savingAsg, setSavingAsg] = useState(false)

  // ── Init: load subjects + semesters ─────────────────────
  useEffect(() => {
    async function loadInit() {
      const [subRes, semRes] = await Promise.all([
        role === 'SUPER_ADMIN'
          ? supabase.from('subjects').select('id,name,code').order('code')
          : supabase.from('teacher_subjects').select('subject:subjects(id,name,code)').eq('teacher_id', user!.id),
        supabase.from('semesters').select('*').order('start_date', { ascending: false }),
      ])

      let uniqueSubjects: Subject[] = []
      if (role === 'SUPER_ADMIN') {
        uniqueSubjects = (subRes.data || []) as Subject[]
      } else {
        uniqueSubjects = Array.from(
          new Map((subRes.data || []).map((ts: any) => {
            const s = ts.subject as Subject
            return [s.id, s]
          })).values()
        )
      }

      const sems = semRes.data || []
      setSubjects(uniqueSubjects)
      setSemesters(sems)
      if (sems.length > 0) setSelectedSemesterId(sems[0].id)
      setLoadingInit(false)
    }
    if (user && role) loadInit()
  }, [user, role])

  // ── Load classrooms when subject selected ────────────────
  useEffect(() => {
    if (!selectedSubjectId || !selectedSemesterId) { setClassRooms([]); return }
    setLoadingRooms(true)

    let query = supabase.from('teacher_subjects')
      .select('class_room:class_rooms(id,name,room_code)')
      .eq('subject_id', selectedSubjectId)
      .eq('semester_id', selectedSemesterId)
    if (role !== 'SUPER_ADMIN') query = query.eq('teacher_id', user!.id)

    query.then(({ data }) => {
      const rooms = (data || []).map((ts: any) => ts.class_room).filter(Boolean)
      const unique = Array.from(new Map(rooms.map((r: any) => [r.id, r])).values()) as any[]
      const sorted = unique.sort((a, b) => a.name.localeCompare(b.name, 'th', { numeric: true }))
      setClassRooms(sorted)
      setLoadingRooms(false)
    })
  }, [selectedSubjectId, selectedSemesterId])

  // ── Load assignments when room selected ──────────────────
  const load = useCallback(async () => {
    if (!user || !selectedSubjectId || !selectedSemesterId || !selectedRoomId) return
    setLoading(true)

    if (mode === 'INDIVIDUAL') {
      // Fetch students in this room → find their assignment targets
      const { data: stData } = await supabase
        .from('students')
        .select('id')
        .eq('class_room_id', selectedRoomId)

      const studentIds = (stData || []).map(s => s.id)
      let items: Assignment[] = []

      if (studentIds.length > 0) {
        const { data: targets } = await supabase
          .from('assignment_targets')
          .select('assignment_id')
          .in('student_id', studentIds)

        const assignmentIds = Array.from(new Set((targets || []).map(t => t.assignment_id)))

        if (assignmentIds.length > 0) {
          let q = supabase
            .from('assignments')
            .select('*, semester:semesters(name)')
            .in('id', assignmentIds)
            .eq('subject_id', selectedSubjectId)
            .order('created_at', { ascending: false })
          if (filterStatus) q = q.eq('status', filterStatus as any)
          const { data } = await q
          items = (data || []) as Assignment[]
        }
      }

      if (search) {
        const s = search.toLowerCase()
        items = items.filter(a => a.title.toLowerCase().includes(s))
      }
      setAssignments(items)
    } else {
      // Group missions
      const { data: groupsData } = await supabase
        .from('student_groups')
        .select('*, members:student_group_members(student:students(first_name, last_name, nickname))')
        .not('topic', 'is', null)
        .eq('room_id', selectedRoomId)
        .order('created_at', { ascending: false })

      if (groupsData) {
        const groupIds = groupsData.map((g: any) => g.id)
        const { data: txData } = await supabase
          .from('point_transactions')
          .select('source_id, points, created_at, note')
          .in('source_id', groupIds)
          .ilike('note', 'Mission Complete%')

        const missionsMap = new Map<string, any>()
        groupsData.forEach((g: any) => {
          const groupTxs = txData?.filter((tx: any) => tx.source_id === g.id) || []
          if (groupTxs.length > 0) {
            const uniqueTxs = new Map<string, any>()
            groupTxs.forEach((tx: any) => uniqueTxs.set(tx.created_at, tx))
            uniqueTxs.forEach((tx: any) => {
              const membersList = g.members.map((m: any) => m.student ? (m.student.nickname || m.student.first_name) : '').filter(Boolean).join(', ')
              const topicKey = g.topic || 'ไม่มีชื่อภารกิจ'
              if (!missionsMap.has(topicKey)) {
                missionsMap.set(topicKey, { id: topicKey, topic: topicKey, date: tx.created_at, maxPoints: g.mission_points || 0, groups: [] })
              }
              missionsMap.get(topicKey).groups.push({
                id: `${g.id}_${tx.created_at}`, groupName: g.name,
                date: tx.created_at, earnedPoints: tx.points,
                note: `ประกอบด้วย: ${membersList}`
              })
            })
          }
        })

        let items = Array.from(missionsMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        if (search) items = items.filter(a => a.topic.toLowerCase().includes(search.toLowerCase()))
        setGroupMissions(items)
      }
    }
    setLoading(false)
  }, [user, selectedSubjectId, selectedSemesterId, selectedRoomId, search, filterStatus, mode])

  useEffect(() => { if (selectedRoomId) load() }, [load])

  async function publishAssignment(id: string) {
    const ok = await confirmAction('เผยแพร่งาน?', 'นักเรียนจะได้รับการแจ้งเตือน', 'เผยแพร่')
    if (!ok) return
    const { error } = await supabase.from('assignments').update({ status: 'PUBLISHED' }).eq('id', id)
    if (error) { await showError('เกิดข้อผิดพลาด', error.message); return }
    await showSuccess('เผยแพร่สำเร็จ'); load()
  }

  async function closeAssignment(id: string) {
    const ok = await confirmAction('ปิดงาน?', 'นักเรียนจะไม่สามารถส่งงานได้อีก', 'ปิดงาน')
    if (!ok) return
    await supabase.from('assignments').update({ status: 'CLOSED' }).eq('id', id)
    showToast('ปิดงานแล้ว', 'success'); load()
  }

  function openEditModal(a: any) {
    setEditingAssignment(a)
    setEditAsgTitle(a.title)
    setEditAsgScore(a.academic_full_score?.toString() || '0')
    setEditAsgPoints(a.point_target?.toString() || '0')
  }

  async function handleSaveEditAssignment() {
    if (!editingAssignment || !editAsgTitle.trim()) return
    setSavingAsg(true)
    try {
      const { error } = await supabase.from('assignments').update({
        title: editAsgTitle.trim(),
        academic_full_score: Number(editAsgScore) || 0,
        point_target: Number(editAsgPoints) || 0
      }).eq('id', editingAssignment.id)
      if (error) throw error
      setEditingAssignment(null)
      load()
      showToast('บันทึกสำเร็จ', 'success')
    } catch (err: any) {
      await showError('บันทึกไม่สำเร็จ', err.message)
    } finally {
      setSavingAsg(false)
    }
  }

  async function handleDeleteAssignment(id: string) {
    const ok = window.confirm('การลบงานจะทำให้คะแนนทั้งหมดของงานนี้หายไปด้วย ยืนยันหรือไม่?')
    if (!ok) return
    try {
      setLoading(true)
      const { error } = await supabase.from('assignments').delete().eq('id', id)
      if (error) throw error
      load()
      showToast('ลบงานแล้ว', 'success')
    } catch (err: any) {
      await showError('ลบงานไม่สำเร็จ', err.message)
    } finally {
      setLoading(false)
    }
  }

  const openTopicModal = (m: any) => {
    const groupsHtml = m.groups.map((g: any) => `
      <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3 mb-2 text-left">
        <div class="flex-1 min-w-0">
          <h4 class="font-bold text-slate-700 text-sm">${g.groupName}</h4>
          <p class="text-xs text-slate-500 mb-1">${new Date(g.date).toLocaleString('th-TH')}</p>
          <p class="text-xs text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">${g.note}</p>
        </div>
        <div class="flex flex-col items-end flex-shrink-0 text-right">
          <span class="text-lg font-black text-emerald-600">+${g.earnedPoints}</span>
          <span class="text-[10px] text-slate-400">จาก ${m.maxPoints}</span>
        </div>
      </div>
    `).join('')
    import('sweetalert2').then(Swal => {
      Swal.default.fire({
        title: m.topic,
        html: `<div class="text-left mb-2 mt-4"><div class="text-sm font-medium text-slate-700 mb-2">กลุ่มที่ทำสำเร็จ (${m.groups.length} กลุ่ม):</div><div class="max-h-[60vh] overflow-y-auto pr-1 bg-slate-50/50 p-2 rounded-lg border border-slate-100">${groupsHtml}</div></div>`,
        width: 600, showConfirmButton: true, confirmButtonText: 'ปิดหน้าต่าง', confirmButtonColor: '#4f46e5'
      })
    })
  }

  if (loadingInit) return <PageLoading />

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId)
  const selectedRoom = classRooms.find(r => r.id === selectedRoomId)

  // ─────────────────────────────────────────────────────────
  // LEVEL 0: Subject Selection
  // ─────────────────────────────────────────────────────────
  if (!selectedSubjectId) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">ภาระงาน</h1>
            <p className="text-slate-500 text-sm mt-1">เลือกวิชาที่ต้องการจัดการภาระงาน</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">ภาคเรียน:</label>
            <select className="form-select min-w-[200px]" value={selectedSemesterId}
              onChange={e => setSelectedSemesterId(e.target.value)}>
              <option value="">-- เลือกภาคเรียน --</option>
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => navigate('/admin/assignments/create')} className="btn-primary whitespace-nowrap">
              <Plus className="w-4 h-4" /> สร้างงานใหม่
            </button>
          </div>
        </div>

        {selectedSemesterId ? (
          subjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {subjects.map(s => (
                <div key={s.id}
                  onClick={() => { setSelectedSubjectId(s.id); setSelectedRoomId('') }}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md border border-slate-200 p-6 cursor-pointer transition-all hover:-translate-y-1 hover:border-indigo-300 group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <FileText className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">{s.code}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors line-clamp-2">{s.name}</h3>
                  <p className="text-sm text-slate-400 mt-3 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5" /> จัดการภาระงาน
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">ไม่พบรายวิชา</p>
            </div>
          )
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500">กรุณาเลือกภาคเรียนด้านบนก่อน</p>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────
  // LEVEL 1+2: Classrooms as buttons + Assignment list below
  // ─────────────────────────────────────────────────────────
  return (
    <>
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <button onClick={() => setSelectedSubjectId('')}
              className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-1 mb-1 transition-colors">
              <ArrowLeft className="w-4 h-4" /> กลับไปเลือกวิชา
            </button>
            <h1 className="text-xl font-bold text-slate-800">{selectedSubject?.name}
              <span className="ml-2 text-sm font-normal text-slate-400">{selectedSubject?.code}</span>
            </h1>
          </div>
          <button onClick={() => navigate('/admin/assignments/create')} className="btn-primary whitespace-nowrap">
            <Plus className="w-4 h-4" /> สร้างงานใหม่
          </button>
        </div>

        {/* Classroom selector buttons */}
        {loadingRooms ? (
          <div className="flex gap-3">
            {[1,2,3].map(i => <div key={i} className="h-14 w-24 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : classRooms.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {classRooms.map(room => {
              const isActive = selectedRoomId === room.id
              return (
                <button key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`flex flex-col items-center px-5 py-2.5 rounded-xl border-2 transition-all font-medium text-sm ${
                    isActive
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
                  <DoorOpen className={`w-4 h-4 mb-0.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {room.name}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 rounded-lg p-3">
            <DoorOpen className="w-4 h-4" />
            ยังไม่มีห้องเรียนที่ผูกกับวิชานี้ — กรุณาตั้งค่าวิชาในเมนูวิชาก่อน
          </div>
        )}

        {/* Filters (only when room selected) */}
        {selectedRoomId && (
          <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-slate-100">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setMode('INDIVIDUAL')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${mode === 'INDIVIDUAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                งานเดี่ยว
              </button>
              <button onClick={() => setMode('GROUP')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${mode === 'GROUP' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                งานกลุ่ม
              </button>
            </div>
            <SearchInput value={search} onChange={setSearch}
              placeholder={mode === 'INDIVIDUAL' ? 'ค้นหางาน...' : 'ค้นหาภารกิจ...'} className="flex-1 min-w-[160px]" />
            {mode === 'INDIVIDUAL' && (
              <select className="form-select w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">ทุกสถานะ</option>
                <option value="DRAFT">ร่าง</option>
                <option value="PUBLISHED">เผยแพร่</option>
                <option value="CLOSED">ปิด</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {!selectedRoomId ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
          <DoorOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">เลือกห้องเรียนด้านบนเพื่อดูภาระงาน</p>
        </div>
      ) : loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : mode === 'INDIVIDUAL' ? (
        assignments.length === 0 ? (
          <div className="card p-8">
            <EmptyState icon={<span className="text-3xl">📝</span>} title="ยังไม่มีภาระงานในห้องนี้"
              description="สร้างงานและมอบหมายให้นักเรียนในห้องนี้"
              action={<button onClick={() => navigate('/admin/assignments/create')} className="btn-primary"><Plus className="w-4 h-4" /> สร้างงาน</button>} />
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map(a => {
              const semester = a.semester as any
              return (
                <div key={a.id} className="card p-5 hover:shadow-card-hover transition-shadow group">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <AssignmentStatusBadge status={a.status} />
                        {semester && <Badge variant="gray">{semester.name}</Badge>}
                      </div>
                        <h3 className="font-bold text-slate-800 text-base">{a.title}</h3>
                      {a.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{a.description}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                        <span>📅 ครบ: {a.due_at ? formatDateTime(a.due_at) : 'ไม่กำหนด'}</span>
                        <span>📊 เต็ม: {a.academic_full_score} คะแนน</span>
                        <span>⭐ Point Target: {a.point_target.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => navigate(`/admin/assignments/${a.id}`)} className="btn-primary btn-sm">
                        <ClipboardCheck className="w-3.5 h-3.5" /> ตรวจงาน
                      </button>
                      {a.status === 'DRAFT' && (
                        <button onClick={() => publishAssignment(a.id)} className="btn-ghost btn-sm">
                          <Send className="w-3.5 h-3.5" /> เผยแพร่
                        </button>
                      )}
                      {a.status === 'PUBLISHED' && (
                        <button onClick={() => closeAssignment(a.id)} className="btn-secondary btn-sm">
                          <Archive className="w-3.5 h-3.5" /> ปิดรับงาน
                        </button>
                      )}
                      <div className="flex gap-2 pt-1 border-t border-slate-100">
                        <button onClick={() => openEditModal(a)} className="flex-1 btn-ghost btn-sm text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50" title="แก้ไข">
                          <Settings className="w-4 h-4 mx-auto" />
                        </button>
                        <button onClick={() => handleDeleteAssignment(a.id)} className="flex-1 btn-ghost btn-sm text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50" title="ลบ">
                          <X className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        groupMissions.length === 0 ? (
          <div className="card p-8">
            <EmptyState icon={<span className="text-3xl">👥</span>} title="ยังไม่มีภารกิจกลุ่มที่สำเร็จ"
              description="กลุ่มที่ทำภารกิจสำเร็จจากหน้าห้องเรียนจะแสดงที่นี่" />
          </div>
        ) : (
          <div className="space-y-3">
            {groupMissions.map(m => (
              <div key={m.id} className="card overflow-hidden hover:shadow-card-hover transition-shadow border-l-[3px] border-l-emerald-500 cursor-pointer"
                onClick={() => openTopicModal(m)}>
                <div className="p-4 flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="indigo">งานกลุ่ม</Badge>
                      <span className="text-[11px] text-slate-500">{formatDateTime(m.date)}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm truncate pr-2">{m.topic}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Users className="w-3 h-3" /> สำเร็จแล้ว {m.groups.length} กลุ่ม
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">คะแนนเต็ม</div>
                      <div className="text-sm font-black text-emerald-600">{m.maxPoints} pt</div>
                    </div>
                    <Eye className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">แก้ไขข้อมูลงาน</h3>
              <button onClick={() => setEditingAssignment(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">ชื่อหัวข้อ</label>
                <input 
                  autoFocus
                  className="form-input" 
                  value={editAsgTitle} 
                  onChange={e => setEditAsgTitle(e.target.value)} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">คะแนนจริง (เต็ม)</label>
                  <input 
                    type="number"
                    className="form-input" 
                    value={editAsgScore} 
                    onChange={e => setEditAsgScore(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="form-label">พอยต์สะสม</label>
                  <input 
                    type="number"
                    className="form-input" 
                    value={editAsgPoints} 
                    onChange={e => setEditAsgPoints(e.target.value)} 
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setEditingAssignment(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg shadow-sm">
                ยกเลิก
              </button>
              <button onClick={handleSaveEditAssignment} disabled={savingAsg} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-2">
                {savingAsg ? <Spinner size="sm" className="text-white" /> : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
