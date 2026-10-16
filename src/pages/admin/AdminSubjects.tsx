import React, { useEffect, useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Subject } from '../../lib/types'
import { SectionHeader, PageLoading, EmptyState, confirmDelete, showSuccess, showError, Modal, Spinner } from '../../components/ui/index'

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editItem, setEditItem] = useState<Subject | null>(null)
  const [form, setForm] = useState({ code: '', name: '', description: '', credit: 1 })
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('subjects')
      .select('*, teacher_subjects(class_room:class_rooms(name))')
      .order('code')
    
    if (data) setSubjects(data as any)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openAdd() { setEditItem(null); setForm({ code: '', name: '', description: '', credit: 1 }); setErrors({}); setShowModal(true) }
  function openEdit(s: any) { setEditItem(s); setForm({ code: s.code, name: s.name, description: s.description || '', credit: s.credit }); setErrors({}); setShowModal(true) }

  async function handleSave() {
    const errs: Record<string, string> = {}
    if (!form.code.trim()) errs.code = 'กรุณากรอกรหัสวิชา'
    if (!form.name.trim()) errs.name = 'กรุณากรอกชื่อวิชา'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      if (editItem) {
        const { error } = await supabase.from('subjects').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('subjects').insert(form)
        if (error) throw error
      }
      await showSuccess('บันทึกสำเร็จ')
      setShowModal(false)
      load()
    } catch (err: unknown) {
      await showError('เกิดข้อผิดพลาด', err instanceof Error ? err.message : '')
    } finally { setSaving(false) }
  }

  async function handleDelete(s: any) {
    const ok = await confirmDelete(`ลบวิชา ${s.name}?`)
    if (!ok) return
    const { error } = await supabase.from('subjects').delete().eq('id', s.id)
    if (error) { await showError('ลบไม่สำเร็จ', error.message); return }
    load()
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <SectionHeader title="จัดการวิชา" subtitle={`${subjects.length} วิชา`}
        actions={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> เพิ่มวิชา</button>} />

      {subjects.length === 0 ? (
        <div className="card p-8"><EmptyState icon={<span className="text-3xl">📚</span>} title="ยังไม่มีวิชา"
          action={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> เพิ่มวิชา</button>} /></div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>ผู้สอน</th><th>ห้องที่เรียน</th><th>หน่วยกิต</th><th className="text-right">จัดการ</th></tr></thead>
            <tbody>
              {subjects.map((s: any) => {
                // Extract unique classroom names
                const rooms = s.teacher_subjects?.map((ts: any) => ts.class_room?.name).filter(Boolean) || []
                const uniqueRooms = [...new Set(rooms)] as string[]
                
                // Extract unique teacher IDs and find their names
                const tIds = s.teacher_subjects?.map((ts: any) => ts.teacher_id).filter(Boolean) || []
                const uniqueTIds = [...new Set(tIds)] as string[]
                const teacherNames = uniqueTIds.map(id => {
                  const t = teachers.find(t => t.id === id)
                  return t ? (t.full_name || t.email) : 'ไม่ระบุ'
                })

                return (
                  <tr key={s.id}>
                    <td className="font-mono text-sm font-semibold text-primary-600">{s.code}</td>
                    <td className="font-medium text-slate-800">{s.name}</td>
                    <td>
                      {teacherNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {teacherNames.map((name, i) => (
                            <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs border border-indigo-100">{name}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td>
                      {uniqueRooms.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {uniqueRooms.map((r, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">{r}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="text-slate-600">{s.credit}</td>
                    <td><div className="flex justify-end gap-1">
                      <button onClick={() => window.location.href = `/admin/subjects/${s.id}`} className="btn-icon btn-ghost text-indigo-600" title="ตั้งค่าวิชา"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(s)} className="btn-icon btn-ghost text-red-400" title="ลบวิชา"><Trash2 className="w-4 h-4" /></button>
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'แก้ไขวิชา' : 'เพิ่มวิชา'}
        footer={<><button onClick={() => setShowModal(false)} className="btn-secondary">ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'บันทึก'}</button></>}>
        <div className="space-y-4">
          <div><label className="form-label">รหัสวิชา *</label>
            <input className="form-input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="เช่น ICT101" />
            {errors.code && <p className="form-error">{errors.code}</p>}</div>
          <div><label className="form-label">ชื่อวิชา *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อวิชา" />
            {errors.name && <p className="form-error">{errors.name}</p>}</div>
          <div><label className="form-label">รายละเอียด</label>
            <textarea className="form-textarea" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="form-label">หน่วยกิต</label>
            <input type="number" step="0.5" min="0.5" className="form-input" value={form.credit} onChange={e => setForm(f => ({ ...f, credit: parseFloat(e.target.value) || 1 }))} /></div>
        </div>
      </Modal>
    </div>
  )
}
