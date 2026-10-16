import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Subject, ClassRoom, Profile, Semester } from '../../lib/types'
import { SectionHeader, PageLoading, Spinner, showError, showSuccess, Modal, confirmDelete } from '../../components/ui/index'
import { Plus, Trash2, BookOpen, Clock, FileText, Upload } from 'lucide-react'

type Tab = 'rooms' | 'syllabus'

export default function AdminSubjectDetail() {
  const { id } = useParams()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('rooms')

  // Rooms Data
  const [teacherSubjects, setTeacherSubjects] = useState<any[]>([])
  const [showAddRoom, setShowAddRoom] = useState(false)
  
  // Lookups
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [classRooms, setClassRooms] = useState<ClassRoom[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])

  // Form for adding room
  const [roomForm, setRoomForm] = useState({ class_room_ids: [] as string[], teacher_id: '', semester_id: '', schedule_day: 'จันทร์', schedule_time: '', study_dates: '' })
  const [savingRoom, setSavingRoom] = useState(false)

  // Syllabus
  const [syllabusContent, setSyllabusContent] = useState('')
  const [savingSyllabus, setSavingSyllabus] = useState(false)

  useEffect(() => {
    if (id) loadAll()
  }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: subData } = await supabase.from('subjects').select('*').eq('id', id).single()
      if (subData) {
        setSubject(subData)
        setSyllabusContent(subData.syllabus || '')
      }

      const { data: tsData } = await supabase.from('teacher_subjects')
        .select('*, class_room:class_rooms(id,name), semester:semesters(id,name)')
        .eq('subject_id', id)
      setTeacherSubjects(tsData || [])

      const [tRes, cRes, sRes] = await Promise.all([
        supabase.rpc('get_teachers_and_admins'),
        supabase.from('class_rooms').select('*').order('name'),
        supabase.from('semesters').select('*').order('start_date', { ascending: false })
      ])
      
      const allProfs = tRes.data || []
      
      setTeachers(allProfs)
      setClassRooms(cRes.data || [])
      setSemesters(sRes.data || [])
      
      if (sRes.data && sRes.data.length > 0) {
        setRoomForm(f => ({ ...f, semester_id: sRes.data![0].id }))
      }
    } catch (err: any) {
      showError('โหลดข้อมูลไม่สำเร็จ', err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleClassRoom(cId: string) {
    setRoomForm(f => {
      if (f.class_room_ids.includes(cId)) return { ...f, class_room_ids: f.class_room_ids.filter(id => id !== cId) }
      return { ...f, class_room_ids: [...f.class_room_ids, cId] }
    })
  }

  async function handleAddRoom() {
    if (roomForm.class_room_ids.length === 0 || !roomForm.teacher_id || !roomForm.semester_id) {
      await showError('กรุณาเลือกข้อมูลให้ครบ')
      return
    }
    setSavingRoom(true)
    try {
      const newClassRoomIds = roomForm.class_room_ids.filter(cId => {
        return !teacherSubjects.some(ts => 
          ts.class_room_id === cId && 
          ts.teacher_id === roomForm.teacher_id && 
          ts.semester_id === roomForm.semester_id
        )
      })

      if (newClassRoomIds.length === 0) {
        await showSuccess('ห้องและครูผู้สอนที่เลือก ถูกกำหนดไว้ก่อนแล้ว')
        setShowAddRoom(false)
        return
      }

      const inserts = newClassRoomIds.map(cId => ({
        subject_id: id,
        class_room_id: cId,
        teacher_id: roomForm.teacher_id,
        semester_id: roomForm.semester_id,
        schedule_day: roomForm.schedule_day,
        schedule_time: roomForm.schedule_time,
        study_dates: roomForm.study_dates
      }))
      const { error } = await supabase.from('teacher_subjects').insert(inserts)
      if (error) throw error
      await showSuccess('เพิ่มห้องเรียนสำเร็จ')
      setShowAddRoom(false)
      loadAll()
    } catch (err: any) {
      await showError('เพิ่มห้องเรียนไม่สำเร็จ', err.message)
    } finally {
      setSavingRoom(false)
    }
  }

  async function handleRemoveRoom(tsId: string) {
    const ok = await confirmDelete('ยกเลิกการสอนห้องนี้?')
    if (!ok) return
    const { error } = await supabase.from('teacher_subjects').delete().eq('id', tsId)
    if (error) showError('ลบไม่สำเร็จ', error.message)
    else loadAll()
  }

  async function handleSaveSyllabus() {
    setSavingSyllabus(true)
    try {
      const { error } = await supabase.from('subjects').update({ syllabus: syllabusContent }).eq('id', id)
      if (error) throw error
      await showSuccess('บันทึก Course Syllabus สำเร็จ')
      loadAll()
    } catch (err: any) {
      await showError('บันทึกไม่สำเร็จ', err.message)
    } finally {
      setSavingSyllabus(false)
    }
  }

  if (loading) return <PageLoading />
  if (!subject) return <div className="p-8 text-center text-slate-500">ไม่พบข้อมูลรายวิชา</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
        <Link to="/admin/subjects" className="hover:text-indigo-600 transition-colors">รายวิชาทั้งหมด</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">{subject.code}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-800">{subject.code} {subject.name}</h1>
        <p className="text-slate-500 mt-2">{subject.description || 'ไม่มีคำอธิบาย'}</p>
        <div className="mt-4 flex gap-4 text-sm font-medium">
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg">{subject.credit} หน่วยกิต</span>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('rooms')} 
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'rooms' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Clock className="w-4 h-4" /> ห้องที่เรียนและเวลา
        </button>
        <button 
          onClick={() => setActiveTab('syllabus')} 
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'syllabus' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <FileText className="w-4 h-4" /> Course Syllabus
        </button>
      </div>

      {activeTab === 'rooms' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddRoom(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> กำหนดห้องและเวลาเรียน
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="table w-full">
              <thead className="bg-slate-50 text-slate-600 text-sm">
                <tr>
                  <th className="px-4 py-3 text-left">ภาคเรียน</th>
                  <th className="px-4 py-3 text-left">ห้องเรียน</th>
                  <th className="px-4 py-3 text-left">ครูผู้สอน</th>
                  <th className="px-4 py-3 text-left">วัน / เวลา</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teacherSubjects.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">ยังไม่มีการกำหนดห้องเรียน</td></tr>
                ) : (
                  teacherSubjects.map(ts => {
                    const teacher = teachers.find(t => t.id === ts.teacher_id)
                    return (
                      <tr key={ts.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">{ts.semester?.name}</td>
                        <td className="px-4 py-3 text-indigo-600">{ts.class_room?.name}</td>
                        <td className="px-4 py-3">{teacher?.full_name || teacher?.email || 'ไม่ระบุชื่อ'}</td>
                        <td className="px-4 py-3 text-slate-600">
                        {ts.schedule_day ? `${ts.schedule_day} ${ts.schedule_time || ''}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleRemoveRoom(ts.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'syllabus' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-600" /> Course Syllabus</h2>
            <div className="flex items-center gap-2">
              <label className="btn-secondary cursor-pointer">
                <input 
                  type="file" 
                  accept="application/pdf" 
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setSavingSyllabus(true)
                    try {
                      // Using supabase storage directly. User needs a 'materials' bucket.
                      const ext = file.name.split('.').pop()
                      const path = `syllabus/${id}_${Date.now()}.${ext}`
                      const { data, error } = await supabase.storage.from('materials').upload(path, file, { upsert: true })
                      if (error) {
                        // Fallback to submission-files if materials doesn't exist
                        const fallback = await supabase.storage.from('submission-files').upload(path, file, { upsert: true })
                        if (fallback.error) throw fallback.error
                        const url = supabase.storage.from('submission-files').getPublicUrl(path).data.publicUrl
                        setSyllabusContent(url)
                      } else {
                        const url = supabase.storage.from('materials').getPublicUrl(path).data.publicUrl
                        setSyllabusContent(url)
                      }
                      await showSuccess('อัปโหลดไฟล์ PDF สำเร็จ')
                    } catch (err: any) {
                      showError('อัปโหลดไม่สำเร็จ', 'กรุณาสร้าง Bucket ชื่อ materials หรือ submission-files ก่อน')
                    } finally {
                      setSavingSyllabus(false)
                    }
                  }} 
                />
                <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> อัปโหลด PDF</span>
              </label>
              <button onClick={handleSaveSyllabus} disabled={savingSyllabus} className="btn-primary">
                {savingSyllabus ? <Spinner size="sm" className="text-white" /> : 'บันทึก Syllabus'}
              </button>
            </div>
          </div>
          
          {syllabusContent && syllabusContent.startsWith('http') && syllabusContent.endsWith('.pdf') ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden h-[600px] relative">
              <div className="absolute top-2 right-2 flex gap-2">
                <button onClick={() => setSyllabusContent('')} className="btn-secondary btn-sm bg-white/90 backdrop-blur">
                  <Trash2 className="w-4 h-4 text-red-500" /> ลบไฟล์นี้
                </button>
              </div>
              <iframe src={syllabusContent} className="w-full h-full" title="Course Syllabus PDF" />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">คุณสามารถกรอกรายละเอียดเนื้อหาแบบข้อความธรรมดา หรืออัปโหลดเป็นไฟล์ PDF ด้านบนได้</p>
              <textarea 
                className="form-textarea w-full min-h-[400px] font-sans text-sm p-4 leading-relaxed" 
                placeholder="พิมพ์เนื้อหารายวิชา, จุดประสงค์, และเกณฑ์การให้คะแนนที่นี่... หรือกดอัปโหลดไฟล์ PDF"
                value={syllabusContent}
                onChange={e => setSyllabusContent(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal Add Room */}
      <Modal isOpen={showAddRoom} onClose={() => setShowAddRoom(false)} title="กำหนดห้องและเวลาเรียน" size="xl" footer={
        <>
          <button onClick={() => setShowAddRoom(false)} className="btn-secondary">ยกเลิก</button>
          <button onClick={handleAddRoom} disabled={savingRoom} className="btn-primary">
            {savingRoom ? <Spinner size="sm" className="text-white" /> : 'บันทึก'}
          </button>
        </>
      }>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">ภาคเรียน *</label>
              <select className="form-select" value={roomForm.semester_id} onChange={e => setRoomForm(f => ({ ...f, semester_id: e.target.value }))}>
                <option value="">-- เลือกภาคเรียน --</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">ครูผู้สอน (ครู/แอดมิน) *</label>
              <select className="form-select" value={roomForm.teacher_id} onChange={e => setRoomForm(f => ({ ...f, teacher_id: e.target.value }))}>
                <option value="">-- เลือกผู้สอน --</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.full_name ? t.full_name : (t.role === 'SUPER_ADMIN' ? 'ผู้ดูแลระบบ (Admin)' : 'ไม่ระบุชื่อ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label mb-2 block">เลือกห้องเรียน (เลือกได้หลายห้อง) *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1">
              {classRooms.map(c => (
                <label 
                  key={c.id} 
                  className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${roomForm.class_room_ids.includes(c.id) ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}
                >
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    checked={roomForm.class_room_ids.includes(c.id)}
                    onChange={() => toggleClassRoom(c.id)}
                  />
                  <span className={`text-sm font-medium ${roomForm.class_room_ids.includes(c.id) ? 'text-indigo-700' : 'text-slate-700'}`}>{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <label className="form-label text-slate-700">วันในสัปดาห์</label>
              <select className="form-select" value={roomForm.schedule_day} onChange={e => setRoomForm(f => ({ ...f, schedule_day: e.target.value }))}>
                {['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label text-slate-700">เวลาเรียน</label>
              <input type="text" className="form-input" placeholder="เช่น 08:30 - 10:30" value={roomForm.schedule_time} onChange={e => setRoomForm(f => ({ ...f, schedule_time: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label text-slate-700">วันที่เรียนในเทอม (เช่น 1, 8, 15 ส.ค.)</label>
              <textarea 
                className="form-textarea w-full text-sm" 
                rows={2}
                placeholder="ระบุวันที่ที่เรียนตลอดทั้งเทอม (ถ้ามี)"
                value={roomForm.study_dates} 
                onChange={e => setRoomForm(f => ({ ...f, study_dates: e.target.value }))} 
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
