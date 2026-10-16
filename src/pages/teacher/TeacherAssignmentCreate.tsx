import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Subject, Semester, ClassRoom, AssignmentQuestion, QuestionType } from '../../lib/types'
import { SectionHeader, showSuccess, showError, showToast, confirmAction, Spinner, PageLoading } from '../../components/ui/index'

const QUESTION_TYPES: { value: QuestionType; label: string; icon: string }[] = [
  { value: 'SHORT_ANSWER', label: 'คำตอบสั้น', icon: '✏️' },
  { value: 'TEXT', label: 'เรียงความ', icon: '📝' },
  { value: 'MULTIPLE_CHOICE', label: 'หลายตัวเลือก', icon: '🔘' },
  { value: 'TRUE_FALSE', label: 'ถูก/ผิด', icon: '✓✗' },
  { value: 'FILE_UPLOAD', label: 'อัพโหลดไฟล์', icon: '📎' },
  { value: 'IMAGE_UPLOAD', label: 'อัพโหลดรูป', icon: '🖼️' },
]

interface QuestionForm {
  id?: string
  question_type: QuestionType
  question_text: string
  options: string[]
  correct_answer: string
  points: number
  required: boolean
  sort_order: number
}

export default function TeacherAssignmentCreate() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState(1) // 1=Details 2=Questions 3=Targets 4=Review
  const [saving, setSaving] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [classRooms, setClassRooms] = useState<ClassRoom[]>([])
  const [assignmentId, setAssignmentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Step 1: Assignment details
  const [details, setDetails] = useState({
    subject_id: '',
    semester_id: '',
    title: '',
    description: '',
    instructions: '',
    academic_full_score: 100,
    point_target: 1000,
    point_formula: 'LINEAR' as const,
    start_at: '',
    due_at: '',
    allow_late: false,
    late_penalty_type: 'NONE' as const,
    late_penalty_value: 0,
    max_submissions: 1,
  })

  // Step 2: Questions
  const [questions, setQuestions] = useState<QuestionForm[]>([])

  // Step 3: Targets
  const [selectedRooms, setSelectedRooms] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const [subRes, semRes, roomRes] = await Promise.all([
        supabase.from('subjects').select('*').order('code'),
        supabase.from('semesters').select('*').order('start_date', { ascending: false }).limit(10),
        supabase.from('class_rooms').select('*, education_level:education_levels(name)').order('name'),
      ])
      if (subRes.data) setSubjects(subRes.data)
      if (semRes.data) setSemesters(semRes.data)
      if (roomRes.data) setClassRooms(roomRes.data as ClassRoom[])
      setLoading(false)
    }
    load()
  }, [])

  async function saveStep1() {
    if (!details.subject_id || !details.semester_id || !details.title) {
      await showError('กรุณากรอกข้อมูลให้ครบ', 'วิชา, ภาคเรียน, และชื่องาน')
      return false
    }
    setSaving(true)
    try {
      // Convert empty date strings to null (DB rejects '' for TIMESTAMPTZ)
      const payload = {
        ...details,
        teacher_id: user!.id,
        start_at: details.start_at || null,
        due_at: details.due_at || null,
      }

      if (assignmentId) {
        const { error } = await supabase.from('assignments')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', assignmentId)
        if (error) throw error
      } else {
        // Generate ID client-side to avoid RETURNING clause triggering RLS recursion
        const newId = crypto.randomUUID()
        const { error } = await supabase.from('assignments')
          .insert({ ...payload, id: newId, status: 'DRAFT' })
        if (error) throw error
        setAssignmentId(newId)
      }
      return true
    } catch (err: unknown) {
      await showError('บันทึกไม่สำเร็จ', err instanceof Error ? err.message : '')
      return false
    } finally { setSaving(false) }
  }

  async function saveStep2() {
    if (!assignmentId) return false
    setSaving(true)
    try {
      // Delete existing questions and re-insert
      await supabase.from('assignment_questions').delete().eq('assignment_id', assignmentId)
      if (questions.length > 0) {
        const { error } = await supabase.from('assignment_questions').insert(
          questions.map((q, i) => ({
            assignment_id: assignmentId,
            question_type: q.question_type,
            question_text: q.question_text,
            options: q.question_type === 'MULTIPLE_CHOICE' ? q.options : [],
            correct_answer: q.correct_answer || null,
            points: q.points,
            required: q.required,
            sort_order: i,
          }))
        )
        if (error) throw error
      }
      return true
    } catch (err: unknown) {
      await showError('บันทึกคำถามไม่สำเร็จ', err instanceof Error ? err.message : '')
      return false
    } finally { setSaving(false) }
  }

  async function saveStep3() {
    if (!assignmentId || selectedRooms.length === 0) {
      await showError('กรุณาเลือกห้องเรียน')
      return false
    }
    setSaving(true)
    try {
      for (const roomId of selectedRooms) {
        const { error } = await supabase.rpc('assign_to_room', {
          p_assignment_id: assignmentId,
          p_class_room_id: roomId,
        })
        if (error) throw error
      }
      return true
    } catch (err: unknown) {
      await showError('มอบหมายงานไม่สำเร็จ', err instanceof Error ? err.message : '')
      return false
    } finally { setSaving(false) }
  }

  async function handleNext() {
    let ok = false
    if (step === 1) ok = await saveStep1()
    else if (step === 2) ok = await saveStep2()
    else if (step === 3) ok = await saveStep3()
    else if (step === 4) { await handlePublish(); return }
    if (ok) setStep(s => s + 1)
  }

  async function handlePublish() {
    const ok = await confirmAction('เผยแพร่งาน?', 'นักเรียนที่ได้รับมอบหมายจะได้รับการแจ้งเตือน', 'เผยแพร่')
    if (!ok) return
    const { error } = await supabase.from('assignments').update({ status: 'PUBLISHED' }).eq('id', assignmentId)
    if (error) { await showError('เกิดข้อผิดพลาด', error.message); return }
    await showSuccess('เผยแพร่งานสำเร็จ!', 'นักเรียนได้รับการแจ้งเตือนแล้ว')
    navigate('/admin/assignments')
  }

  function addQuestion() {
    setQuestions(q => [...q, {
      question_type: 'SHORT_ANSWER',
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: '',
      points: 1,
      required: true,
      sort_order: q.length,
    }])
  }

  function removeQuestion(index: number) { setQuestions(q => q.filter((_, i) => i !== index)) }
  function updateQuestion(index: number, updates: Partial<QuestionForm>) {
    setQuestions(q => q.map((item, i) => i === index ? { ...item, ...updates } : item))
  }

  if (loading) return <PageLoading />

  const stepLabels = ['รายละเอียด', 'คำถาม', 'มอบหมาย', 'ตรวจสอบ']

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/assignments')} className="btn-icon btn-ghost"><ArrowLeft className="w-5 h-5" /></button>
        <SectionHeader title="สร้างภาระงานใหม่" subtitle="กรอกข้อมูลตามขั้นตอน" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {stepLabels.map((label, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-2 ${i + 1 <= step ? 'text-primary-600' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${i + 1 < step ? 'bg-primary-600 border-primary-600 text-white' : i + 1 === step ? 'border-primary-600 text-primary-600' : 'border-slate-300 text-slate-400'}`}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span className="text-sm font-medium hidden sm:block">{label}</span>
            </div>
            {i < stepLabels.length - 1 && <div className={`flex-1 h-0.5 ${i + 1 < step ? 'bg-primary-600' : 'bg-slate-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <h3 className="font-bold text-slate-800">รายละเอียดงาน</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="form-label">วิชา *</label>
              <select className="form-select" value={details.subject_id} onChange={e => setDetails(d => ({ ...d, subject_id: e.target.value }))}>
                <option value="">-- เลือกวิชา --</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.code} {s.name}</option>)}
              </select></div>
            <div><label className="form-label">ภาคเรียน *</label>
              <select className="form-select" value={details.semester_id} onChange={e => setDetails(d => ({ ...d, semester_id: e.target.value }))}>
                <option value="">-- เลือกภาคเรียน --</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
          </div>
          <div><label className="form-label">ชื่องาน *</label>
            <input className="form-input" value={details.title} onChange={e => setDetails(d => ({ ...d, title: e.target.value }))} placeholder="เช่น Network Lab 01 - การตั้งค่า IP Address" /></div>
          <div><label className="form-label">คำอธิบาย</label>
            <textarea className="form-textarea" rows={3} value={details.description} onChange={e => setDetails(d => ({ ...d, description: e.target.value }))} placeholder="อธิบายภาพรวมของงาน" /></div>
          <div><label className="form-label">คำสั่ง</label>
            <textarea className="form-textarea" rows={4} value={details.instructions} onChange={e => setDetails(d => ({ ...d, instructions: e.target.value }))} placeholder="คำสั่งโดยละเอียดสำหรับนักเรียน" /></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className="form-label">คะแนนเต็ม</label>
              <input type="number" className="form-input" value={details.academic_full_score} onChange={e => setDetails(d => ({ ...d, academic_full_score: parseFloat(e.target.value) || 100 }))} /></div>
            <div><label className="form-label">Point Target</label>
              <input type="number" className="form-input" value={details.point_target} onChange={e => setDetails(d => ({ ...d, point_target: parseInt(e.target.value) || 0 }))} /></div>
            <div><label className="form-label">สูตรคิด Point</label>
              <select className="form-select" value={details.point_formula} onChange={e => setDetails(d => ({ ...d, point_formula: e.target.value as typeof details.point_formula }))}>
                <option value="LINEAR">เส้นตรง (LINEAR)</option>
                <option value="THRESHOLD">ขั้นบันได (THRESHOLD)</option>
              </select></div>
            <div><label className="form-label">ส่งได้สูงสุด</label>
              <input type="number" className="form-input" min="1" value={details.max_submissions} onChange={e => setDetails(d => ({ ...d, max_submissions: parseInt(e.target.value) || 1 }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="form-label">วันเริ่มต้น</label>
              <input type="datetime-local" className="form-input" value={details.start_at} onChange={e => setDetails(d => ({ ...d, start_at: e.target.value }))} /></div>
            <div><label className="form-label">วันครบกำหนด</label>
              <input type="datetime-local" className="form-input" value={details.due_at} onChange={e => setDetails(d => ({ ...d, due_at: e.target.value }))} /></div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="allow_late" checked={details.allow_late} onChange={e => setDetails(d => ({ ...d, allow_late: e.target.checked }))} className="w-4 h-4 rounded text-primary-600" />
            <label htmlFor="allow_late" className="text-sm text-slate-700 cursor-pointer">อนุญาตให้ส่งงานสาย</label>
          </div>
        </div>
      )}

      {/* Step 2: Questions */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">คำถาม ({questions.length} ข้อ)</h3>
              <button onClick={addQuestion} className="btn-primary btn-sm"><Plus className="w-4 h-4" /> เพิ่มคำถาม</button>
            </div>
            {questions.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-4xl mb-2">❓</p>
                <p>ยังไม่มีคำถาม กดเพิ่มคำถามเพื่อเริ่มต้น</p>
                <p className="text-xs mt-1">(ไม่มีคำถามก็ได้ — นักเรียนสามารถอัพโหลดไฟล์รวมได้)</p>
              </div>
            )}
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</span>
                    <select className="form-select flex-1" value={q.question_type} onChange={e => updateQuestion(i, { question_type: e.target.value as QuestionType, options: ['', '', '', ''] })}>
                      {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                    <input type="number" step="0.5" min="0" className="form-input w-24" placeholder="คะแนน" value={q.points} onChange={e => updateQuestion(i, { points: parseFloat(e.target.value) || 0 })} />
                    <button onClick={() => removeQuestion(i)} className="btn-icon btn-ghost text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <textarea className="form-textarea" rows={2} placeholder={`คำถามข้อที่ ${i + 1}`} value={q.question_text} onChange={e => updateQuestion(i, { question_text: e.target.value })} />
                  {q.question_type === 'MULTIPLE_CHOICE' && (
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" name={`correct-${i}`} checked={q.correct_answer === opt} onChange={() => updateQuestion(i, { correct_answer: opt })} className="text-primary-600" />
                          <input className="form-input flex-1" placeholder={`ตัวเลือก ${oi + 1}`} value={opt}
                            onChange={e => { const newOpts = [...q.options]; newOpts[oi] = e.target.value; updateQuestion(i, { options: newOpts }) }} />
                        </div>
                      ))}
                      <p className="text-xs text-slate-500">เลือก radio ที่คำตอบที่ถูกต้อง</p>
                    </div>
                  )}
                  {q.question_type === 'TRUE_FALSE' && (
                    <div className="flex gap-3">
                      {['ถูก', 'ผิด'].map(v => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name={`tf-${i}`} value={v} checked={q.correct_answer === v} onChange={() => updateQuestion(i, { correct_answer: v })} />
                          <span className="text-sm font-medium">{v}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`req-${i}`} checked={q.required} onChange={e => updateQuestion(i, { required: e.target.checked })} className="w-4 h-4 rounded" />
                    <label htmlFor={`req-${i}`} className="text-xs text-slate-600 cursor-pointer">จำเป็นต้องตอบ</label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Targets */}
      {step === 3 && (
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-slate-800">มอบหมายให้ห้องเรียน</h3>
          <p className="text-sm text-slate-500">เลือกห้องที่จะได้รับงานนี้ (สามารถเลือกได้หลายห้อง)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {classRooms.map(room => {
              const level = room.education_level as Record<string, string> | undefined
              const selected = selectedRooms.includes(room.id)
              return (
                <label key={room.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-primary-200'}`}>
                  <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" checked={selected}
                    onChange={e => setSelectedRooms(r => e.target.checked ? [...r, room.id] : r.filter(id => id !== room.id))} />
                  <div>
                    <p className="font-semibold text-sm">{room.name}</p>
                    <p className="text-xs text-slate-500">{level?.name} • {room.room_code}</p>
                  </div>
                </label>
              )
            })}
          </div>
          {selectedRooms.length > 0 && (
            <div className="alert-info">
              <span>✅</span>
              <p>เลือก {selectedRooms.length} ห้อง — นักเรียนทุกคนในห้องที่เลือกจะได้รับการแจ้งเตือน</p>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="card p-6 space-y-4">
          <h3 className="font-bold text-slate-800">ตรวจสอบก่อนเผยแพร่</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-slate-500">ชื่องาน</p><p className="font-semibold">{details.title}</p></div>
            <div><p className="text-slate-500">คะแนนเต็ม</p><p className="font-semibold">{details.academic_full_score}</p></div>
            <div><p className="text-slate-500">Point Target</p><p className="font-semibold">{details.point_target.toLocaleString()}</p></div>
            <div><p className="text-slate-500">จำนวนคำถาม</p><p className="font-semibold">{questions.length} ข้อ</p></div>
            <div><p className="text-slate-500">ห้องที่มอบหมาย</p><p className="font-semibold">{selectedRooms.length} ห้อง</p></div>
            <div><p className="text-slate-500">ส่งสาย</p><p className="font-semibold">{details.allow_late ? 'อนุญาต' : 'ไม่อนุญาต'}</p></div>
          </div>
          <div className="alert-warning">
            <span>⚠️</span>
            <p>เมื่อเผยแพร่แล้ว นักเรียนจะเห็นงานทันที และจะได้รับการแจ้งเตือน</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/admin/assignments')} className="btn-secondary">
          {step === 1 ? 'ยกเลิก' : '← ย้อนกลับ'}
        </button>
        <button onClick={handleNext} disabled={saving} className={step === 4 ? 'btn-success' : 'btn-primary'}>
          {saving ? <Spinner size="sm" className="text-white" /> : step === 4 ? <><Send className="w-4 h-4" /> เผยแพร่งาน</> : <>ถัดไป →</>}
        </button>
      </div>
    </div>
  )
}
