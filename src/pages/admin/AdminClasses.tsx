import React, { useEffect, useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { ClassRoom, EducationLevel, AcademicYear } from '../../lib/types'
import { SectionHeader, PageLoading, EmptyState, confirmDelete, showSuccess, showError, Modal, Spinner } from '../../components/ui/index'

export default function AdminClasses() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<ClassRoom[]>([])
  const [levels, setLevels] = useState<EducationLevel[]>([])
  const [years, setYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editItem, setEditItem] = useState<ClassRoom | null>(null)
  const [form, setForm] = useState({ name: '', room_code: '', education_level_id: '', academic_year_id: '', max_students: 40 })
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const [roomsRes, levelsRes, yearsRes] = await Promise.all([
      supabase.from('class_rooms').select('*, education_level:education_levels(name), academic_year:academic_years(name)').order('name'),
      supabase.from('education_levels').select('*').order('sort_order'),
      supabase.from('academic_years').select('*').order('name', { ascending: false }),
    ])
    if (roomsRes.data) setRooms(roomsRes.data as ClassRoom[])
    if (levelsRes.data) setLevels(levelsRes.data)
    if (yearsRes.data) setYears(yearsRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditItem(null)
    setForm({ name: '', room_code: '', education_level_id: '', academic_year_id: '', max_students: 40 })
    setErrors({})
    setShowModal(true)
  }

  function openEdit(room: ClassRoom) {
    setEditItem(room)
    setForm({ name: room.name, room_code: room.room_code, education_level_id: room.education_level_id, academic_year_id: room.academic_year_id, max_students: room.max_students })
    setErrors({})
    setShowModal(true)
  }

  async function handleSave() {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'กรุณากรอกชื่อห้อง'
    if (!form.room_code.trim()) errs.room_code = 'กรุณากรอกรหัสห้อง'
    if (!form.education_level_id) errs.education_level_id = 'กรุณาเลือกระดับ'
    if (!form.academic_year_id) errs.academic_year_id = 'กรุณาเลือกปีการศึกษา'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      if (editItem) {
        const { error } = await supabase.from('class_rooms').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('class_rooms').insert(form)
        if (error) throw error
      }
      await showSuccess('บันทึกสำเร็จ')
      setShowModal(false)
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      await showError('บันทึกไม่สำเร็จ', msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(room: ClassRoom) {
    const ok = await confirmDelete(`ลบห้อง ${room.name}?`, 'การกระทำนี้ไม่สามารถยกเลิกได้')
    if (!ok) return
    const { error } = await supabase.from('class_rooms').delete().eq('id', room.id)
    if (error) { await showError('ลบไม่สำเร็จ', error.message); return }
    await showSuccess('ลบสำเร็จ')
    load()
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <SectionHeader
        title="จัดการห้องเรียน"
        subtitle={`${rooms.length} ห้อง`}
        actions={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> เพิ่มห้องเรียน</button>}
      />

      {rooms.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={<span className="text-3xl">🏫</span>} title="ยังไม่มีห้องเรียน" action={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> เพิ่มห้องเรียน</button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map(room => (
            <div key={room.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-800">{room.name}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{room.room_code}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(room)} className="btn-icon btn-ghost text-slate-400"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(room)} className="btn-icon btn-ghost text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap mb-4">
                <span className="badge-blue">{(room.education_level as Record<string, string> | undefined)?.name}</span>
                <span className="badge-gray">{(room.academic_year as Record<string, string> | undefined)?.name}</span>
                <span className="badge-gray">นักเรียน max {room.max_students}</span>
              </div>
              <button 
                onClick={() => navigate(`/admin/classes/${room.id}`)} 
                className="w-full btn-secondary text-sm justify-center py-2 border-slate-200"
              >
                ดูและจัดการนักเรียนในห้อง
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'แก้ไขห้องเรียน' : 'เพิ่มห้องเรียน'}
        footer={<>
          <button onClick={() => setShowModal(false)} className="btn-secondary">ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Spinner size="sm" className="text-white" /> : 'บันทึก'}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div><label className="form-label">ชื่อห้อง *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น ปวช.1/1" />
            {errors.name && <p className="form-error">{errors.name}</p>}</div>
          <div><label className="form-label">รหัสห้อง *</label>
            <input className="form-input" value={form.room_code} onChange={e => setForm(f => ({ ...f, room_code: e.target.value }))} placeholder="เช่น TVET101" />
            {errors.room_code && <p className="form-error">{errors.room_code}</p>}</div>
          <div><label className="form-label">ระดับการศึกษา *</label>
            <select className="form-select" value={form.education_level_id} onChange={e => setForm(f => ({ ...f, education_level_id: e.target.value }))}>
              <option value="">-- เลือกระดับ --</option>
              {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            {errors.education_level_id && <p className="form-error">{errors.education_level_id}</p>}</div>
          <div><label className="form-label">ปีการศึกษา *</label>
            <select className="form-select" value={form.academic_year_id} onChange={e => setForm(f => ({ ...f, academic_year_id: e.target.value }))}>
              <option value="">-- เลือกปีการศึกษา --</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
            {errors.academic_year_id && <p className="form-error">{errors.academic_year_id}</p>}</div>
          <div><label className="form-label">จำนวนนักเรียนสูงสุด</label>
            <input type="number" className="form-input" value={form.max_students} onChange={e => setForm(f => ({ ...f, max_students: parseInt(e.target.value) || 40 }))}/></div>
        </div>
      </Modal>
    </div>
  )
}
