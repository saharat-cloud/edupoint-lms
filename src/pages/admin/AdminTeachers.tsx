import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Edit } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'
import { SectionHeader, PageLoading, Avatar, Badge, Modal, showSuccess, showError, Spinner } from '../../components/ui/index'

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', is_active: true, role: 'TEACHER' as 'TEACHER' | 'SUPER_ADMIN' })

  const loadTeachers = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').in('role', ['TEACHER', 'SUPER_ADMIN']).order('full_name')
    if (data) setTeachers(data as Profile[])
    setLoading(false)
  }

  useEffect(() => {
    loadTeachers()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editId) {
      if (!form.full_name) {
        await showError('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อ-สกุล')
        return
      }
      setSaving(true)
      try {
        // Update profile
        const { error } = await supabase.from('profiles').update({
          full_name: form.full_name,
          email: form.email,
          is_active: form.is_active,
          role: form.role,
          updated_at: new Date().toISOString()
        }).eq('id', editId)
        
        if (error) throw error

        // Update auth info
        const { error: authErr } = await supabase.rpc('admin_update_user_auth', {
          p_user_id: editId,
          p_email: form.email,
          p_password: form.password || null
        })
        if (authErr) throw authErr
        
        await showSuccess('สำเร็จ', 'แก้ไขข้อมูลครูเรียบร้อยแล้ว')
        setIsModalOpen(false)
        setEditId(null)
        setForm({ email: '', password: '', full_name: '', is_active: true, role: 'TEACHER' })
        loadTeachers()
      } catch (err: any) {
        console.error(err)
        await showError('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถแก้ไขข้อมูลได้')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!form.email || !form.password || !form.full_name) {
      await showError('ข้อมูลไม่ครบ', 'กรุณากรอกอีเมล รหัสผ่าน และชื่อ-สกุล')
      return
    }
    if (form.password.length < 6) {
      await showError('รหัสผ่านสั้นเกินไป', 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.rpc('admin_create_teacher', {
        p_email: form.email,
        p_password: form.password,
        p_full_name: form.full_name,
        p_role: form.role
      })

      if (error) throw error

      await showSuccess('สำเร็จ', 'เพิ่มครูใหม่เรียบร้อยแล้ว')
      setIsModalOpen(false)
      setEditId(null)
      setForm({ email: '', password: '', full_name: '', is_active: true, role: 'TEACHER' })
      loadTeachers()
    } catch (err: any) {
      console.error(err)
      await showError('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถเพิ่มครูได้')
    } finally {
      setSaving(false)
    }
  }

  const handleEditClick = (t: Profile) => {
    setEditId(t.id)
    setForm({ email: t.email || '', password: '', full_name: t.full_name || '', is_active: t.is_active ?? true, role: (t.role as 'TEACHER' | 'SUPER_ADMIN') || 'TEACHER' })
    setIsModalOpen(true)
  }

  if (loading && teachers.length === 0) return <PageLoading />

  return (
    <div className="space-y-6">
      <SectionHeader 
        title="จัดการครู" 
        subtitle={`${teachers.length} คน`} 
        actions={
          <button onClick={() => {
            setEditId(null)
            setForm({ email: '', password: '', full_name: '', is_active: true, role: 'TEACHER' })
            setIsModalOpen(true)
          }} className="btn-primary">
            <Plus className="w-4 h-4" /> เพิ่มครูใหม่
          </button>
        }
      />
      
      <div className="card p-2">
        <table className="table">
          <thead><tr><th>ครู</th><th>อีเมล</th><th>บทบาท</th><th>สถานะ</th><th className="text-right">จัดการ</th></tr></thead>
          <tbody>
            {teachers.map(t => (
              <tr key={t.id}>
                <td><div className="flex items-center gap-3"><Avatar name={t.full_name || 'ครู'} src={t.avatar_url} size="sm" /><span className="font-medium">{t.full_name || '-'}</span></div></td>
                <td className="text-slate-600 text-sm">{t.email}</td>
                <td><Badge variant={t.role === 'SUPER_ADMIN' ? 'purple' : 'blue'}>{t.role === 'SUPER_ADMIN' ? 'ผู้ดูแลระบบ' : 'ครู'}</Badge></td>
                <td><Badge variant={t.is_active ? 'green' : 'gray'}>{t.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</Badge></td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => handleEditClick(t)}
                      className="btn-icon btn-ghost text-slate-500 hover:text-blue-600"
                      title="แก้ไขข้อมูลครู"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {t.role !== 'SUPER_ADMIN' && (
                      <button
                        onClick={async () => {
                          if (confirm(`คุณต้องการลบครู ${t.full_name} ใช่หรือไม่? ข้อมูลทั้งหมดที่เกี่ยวข้องจะถูกลบ`)) {
                            // ลบจาก auth.users
                            await supabase.rpc('admin_delete_user', { p_user_id: t.id })
                            // ลบจากตาราง profiles 
                            const { error } = await supabase.from('profiles').delete().eq('id', t.id)
                            if (error) {
                              showError('ลบไม่สำเร็จ', error.message)
                            } else {
                              showSuccess('ลบครูเรียบร้อยแล้ว', '')
                              loadTeachers()
                            }
                          }
                        }}
                        className="btn-icon btn-ghost text-slate-500 hover:text-red-600"
                        title="ลบครู"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title={editId ? "แก้ไขข้อมูลครู" : "เพิ่มครูใหม่"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ-สกุล</label>
            <input
              type="text"
              required
              disabled={saving}
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="form-input"
              placeholder="เช่น นายใจดี สอนเก่ง"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
            <input
              type="email"
              required
              disabled={saving}
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="form-input"
              placeholder="เช่น teacher@school.ac.th"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน {editId && '(เว้นว่างหากไม่เปลี่ยน)'}</label>
            <input
              type="password"
              required={!editId}
              minLength={editId ? 0 : 6}
              disabled={saving}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="form-input"
              placeholder={editId ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยน" : "อย่างน้อย 6 ตัวอักษร"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">สิทธิ์การใช้งาน (Role)</label>
            <select
              disabled={saving}
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value as 'TEACHER' | 'SUPER_ADMIN' })}
              className="form-select"
            >
              <option value="TEACHER">ครูผู้สอน (TEACHER)</option>
              <option value="SUPER_ADMIN">ผู้ดูแลระบบ (SUPER_ADMIN)</option>
            </select>
          </div>
          {editId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">สถานะการใช้งาน</label>
              <select
                disabled={saving}
                value={form.is_active ? 'true' : 'false'}
                onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })}
                className="form-select"
              >
                <option value="true">ใช้งานปกติ</option>
                <option value="false">ระงับการใช้งาน</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setIsModalOpen(false)} disabled={saving} className="btn-ghost">ยกเลิก</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <><Spinner size="sm" className="text-white" /> กำลังบันทึก...</> : 'บันทึก'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
