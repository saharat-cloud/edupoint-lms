import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Save, User, Camera } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Student, EducationLevel, ClassRoom } from '../../lib/types'
import { SectionHeader, PageLoading, showSuccess, showError, showToast, Spinner, Avatar } from '../../components/ui/index'

export default function AdminStudentRegister() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('id')

  const [form, setForm] = useState({
    student_code: '',
    first_name: '',
    last_name: '',
    nickname: '',
    card_number: '',
    education_level_id: '',
    class_room_id: '',
    status: 'ACTIVE' as const,
    email: '',
    password: '',
    user_id: '',
    avatar_url: '',
  })
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>([])
  const [classRooms, setClassRooms] = useState<ClassRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Card reader input buffer
  const cardBuffer = useRef('')
  const cardTimeout = useRef<ReturnType<typeof setTimeout>>()
  const [cardReaderActive, setCardReaderActive] = useState(false)
  const [cardReadStatus, setCardReadStatus] = useState('')

  useEffect(() => {
    async function loadData() {
      const [levelsRes, roomsRes] = await Promise.all([
        supabase.from('education_levels').select('*').order('sort_order'),
        supabase.from('class_rooms').select('*, education_level:education_levels(name)').order('name'),
      ])
      if (levelsRes.data) setEducationLevels(levelsRes.data)
      if (roomsRes.data) setClassRooms(roomsRes.data)

      if (editId) {
        const { data } = await supabase.from('students').select('*').eq('id', editId).single()
        if (data) {
          let userEmail = ''
          if (data.user_id) {
            const { data: eData, error } = await supabase.rpc('admin_get_user_email', { p_user_id: data.user_id })
            if (eData) {
              userEmail = eData
            } else {
              // Fallback to profiles table if RPC is missing
              const { data: pData } = await supabase.from('profiles').select('email').eq('id', data.user_id).single()
              if (pData?.email) userEmail = pData.email
            }
          }
          setForm({
            student_code: data.student_code || '',
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            nickname: data.nickname || '',
            card_number: data.card_number || '',
            education_level_id: data.education_level_id || '',
            class_room_id: data.class_room_id || '',
            status: data.status || 'ACTIVE',
            email: userEmail,
            password: '',
            user_id: data.user_id || '',
            avatar_url: data.avatar_url || '',
          })
        }
      }
      setPageLoading(false)
    }
    loadData()
  }, [editId])

  // Card reader keyboard emulation handler
  useEffect(() => {
    if (!cardReaderActive) return

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        const cardNum = cardBuffer.current.trim()
        if (/^\d+$/.test(cardNum) && cardNum.length >= 6) {
          setForm(f => ({ ...f, card_number: cardNum }))
          setCardReadStatus(`✅ อ่านบัตรสำเร็จ: ${cardNum}`)
          setTimeout(() => setCardReaderActive(false), 1000)
        }
        cardBuffer.current = ''
        clearTimeout(cardTimeout.current)
        return
      }
      if (/^\d$/.test(e.key)) {
        cardBuffer.current += e.key
        clearTimeout(cardTimeout.current)
        cardTimeout.current = setTimeout(() => { cardBuffer.current = '' }, 2000)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [cardReaderActive])

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.student_code.trim()) errs.student_code = 'กรุณากรอกรหัสนักเรียน'
    if (!form.first_name.trim()) errs.first_name = 'กรุณากรอกชื่อ'
    if (!form.last_name.trim()) errs.last_name = 'กรุณากรอกนามสกุล'
    if (!form.email.trim() && !editId) errs.email = 'กรุณากรอกอีเมล'
    if (!editId && !form.password.trim()) errs.password = 'กรุณากรอกรหัสผ่านเริ่มต้น'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploadingAvatar(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `students/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)
        
      if (uploadError) throw uploadError
      
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      setForm(f => ({ ...f, avatar_url: data.publicUrl }))
      await showSuccess('อัปโหลดรูปโปรไฟล์สำเร็จ')
    } catch (err: any) {
      await showError('อัปโหลดล้มเหลว', err.message || 'กรุณาตรวจสอบว่ามี Bucket "avatars" และสิทธิ์ถูกต้องหรือไม่')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    const payload = {
      student_code: form.student_code.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      nickname: form.nickname.trim() || null,
      card_number: form.card_number.trim() || null,
      education_level_id: form.education_level_id || null,
      class_room_id: form.class_room_id || null,
      status: form.status,
      avatar_url: form.avatar_url || null,
    }

    try {
      if (editId) {
        const { error } = await supabase.from('students').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
        if (error) throw error

        if (form.user_id) {
          if (form.email.trim() !== '') {
            const { error: authErr } = await supabase.rpc('admin_update_user_auth', {
              p_user_id: form.user_id,
              p_email: form.email.trim(),
              p_password: form.password.trim() || null
            })
            if (authErr) {
              console.error(authErr)
              // We won't block the UI with an error here if they just changed the name, 
              // but we should notify them.
            }
          }
        } else if (form.email.trim() && form.password.trim()) {
          // Student doesn't have an account yet, but email/password are provided in edit mode
          // We will use admin_create_teacher to create the user, then change role to STUDENT
          const { data: newUserId, error: createAuthErr } = await supabase.rpc('admin_create_teacher', {
            p_email: form.email.trim(),
            p_password: form.password.trim(),
            p_full_name: `${payload.first_name} ${payload.last_name}`
          })
          
          if (createAuthErr) {
            await showError('ไม่สามารถสร้างบัญชีได้', createAuthErr.message)
            return
          }
          
          if (newUserId) {
            // Update profile role to STUDENT
            await supabase.from('profiles').update({ role: 'STUDENT' }).eq('id', newUserId)
            // Link new user to the existing student
            await supabase.from('students').update({ user_id: newUserId }).eq('id', editId)
          }
        }
        await showSuccess('บันทึกสำเร็จ', 'แก้ไขข้อมูลนักเรียนแล้ว')
        navigate('/admin/students')
      } else {
        const { error } = await supabase.rpc('admin_create_student', {
          p_student_code: payload.student_code,
          p_first_name: payload.first_name,
          p_last_name: payload.last_name,
          p_nickname: payload.nickname,
          p_card_number: payload.card_number,
          p_education_level_id: payload.education_level_id,
          p_class_room_id: payload.class_room_id,
          p_status: payload.status,
          p_email: form.email.trim(),
          p_password: form.password.trim()
        })
        
        if (!error && data && payload.avatar_url) {
          await supabase.from('students').update({ avatar_url: payload.avatar_url }).eq('id', data)
        }
        
        if (error) {
          if (error.message.includes('student_code')) {
            setErrors({ student_code: 'รหัสนักเรียนนี้มีอยู่แล้ว' })
          } else if (error.message.includes('card_number')) {
            setErrors({ card_number: 'หมายเลขบัตรนี้มีอยู่แล้ว' })
          } else {
            await showError('เกิดข้อผิดพลาด', error.message || 'ข้อมูลซ้ำในระบบ')
          }
          return
        }
        await showSuccess('เพิ่มนักเรียนสำเร็จ', `${payload.first_name} ${payload.last_name} ถูกเพิ่มในระบบแล้ว สามารถเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ตั้งไว้`)
        navigate('/admin/students')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      await showError('บันทึกไม่สำเร็จ', msg)
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) return <PageLoading />

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/students')} className="btn-icon btn-ghost">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <SectionHeader
          title={editId ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียน / ลงทะเบียนบัตร'}
          subtitle={editId ? 'แก้ไขข้อมูลและลงทะเบียนบัตรนักเรียน' : 'กรอกข้อมูลนักเรียนใหม่'}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Personal Info */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-primary-600" />
            <h3 className="font-semibold text-slate-700">ข้อมูลส่วนตัว</h3>
          </div>

          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div 
                onClick={() => { if (form.avatar_url) window.open(form.avatar_url, '_blank') }} 
                className={form.avatar_url ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                title={form.avatar_url ? "คลิกเพื่อดูรูปขนาดเต็ม" : ""}
              >
                <Avatar name={form.first_name || 'Student'} src={form.avatar_url} size="xl" />
              </div>
              <label className="absolute bottom-0 right-0 p-1.5 bg-primary-600 rounded-full text-white cursor-pointer shadow-lg hover:bg-primary-700 transition-colors" title="อัปโหลดรูปใหม่">
                <Camera className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
              </label>
            </div>
            {uploadingAvatar && <p className="text-xs text-primary-600 mt-2 animate-pulse">กำลังอัปโหลด...</p>}
          </div>

          <div>
            <label className="form-label" htmlFor="student_code">รหัสนักเรียน *</label>
            <input id="student_code" className="form-input" value={form.student_code}
              onChange={e => setForm(f => ({ ...f, student_code: e.target.value }))}
              placeholder="เช่น 6501001" />
            {errors.student_code && <p className="form-error">{errors.student_code}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="first_name">ชื่อ *</label>
              <input id="first_name" className="form-input" value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="ชื่อจริง" />
              {errors.first_name && <p className="form-error">{errors.first_name}</p>}
            </div>
            <div>
              <label className="form-label" htmlFor="last_name">นามสกุล *</label>
              <input id="last_name" className="form-input" value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="นามสกุล" />
              {errors.last_name && <p className="form-error">{errors.last_name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-4">
            <div>
              <label className="form-label" htmlFor="email">อีเมลสำหรับล็อกอิน {editId && '(เว้นว่างหากไม่ต้องการเปลี่ยน)'}</label>
              <input id="email" type="email" className="form-input" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder={editId ? "ไม่เปลี่ยนให้ปล่อยว่าง" : "อีเมลนักเรียน"} />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>
            <div>
              <label className="form-label" htmlFor="password">รหัสผ่าน {editId && '(เว้นว่างหากไม่ต้องการเปลี่ยน)'}</label>
              <input id="password" type="password" className="form-input" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editId ? "เว้นว่างไว้หากไม่เปลี่ยน" : "ตั้งรหัสผ่าน"} />
              {errors.password && <p className="form-error">{errors.password}</p>}
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="nickname">ชื่อเล่น</label>
            <input id="nickname" className="form-input" value={form.nickname}
              onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
              placeholder="ชื่อเล่น (ไม่บังคับ)" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">ระดับการศึกษา</label>
              <select className="form-select" value={form.education_level_id}
                onChange={e => setForm(f => ({ ...f, education_level_id: e.target.value }))}>
                <option value="">-- เลือกระดับ --</option>
                {educationLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">ห้องเรียน</label>
              <select className="form-select" value={form.class_room_id}
                onChange={e => setForm(f => ({ ...f, class_room_id: e.target.value }))}>
                <option value="">-- เลือกห้อง --</option>
                {classRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">สถานะ</label>
            <select className="form-select" value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as typeof form.status }))}>
              <option value="ACTIVE">ปกติ</option>
              <option value="INACTIVE">ไม่ใช้งาน</option>
              <option value="GRADUATED">จบการศึกษา</option>
              <option value="TRANSFERRED">ย้ายออก</option>
            </select>
          </div>
        </div>

        {/* Card Registration */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-slate-700">ลงทะเบียนบัตรนักเรียน</h3>
          </div>

          <div>
            <label className="form-label" htmlFor="card_number">หมายเลขบัตร</label>
            <input
              id="card_number"
              className="form-input font-mono"
              value={form.card_number}
              onChange={e => setForm(f => ({ ...f, card_number: e.target.value.replace(/\D/g, '') }))}
              placeholder="เช่น 100001 (ตัวเลขเท่านั้น)"
              inputMode="numeric"
            />
            {errors.card_number && <p className="form-error">{errors.card_number}</p>}
          </div>

          <div>
            <p className="text-sm text-slate-600 mb-3">หรือใช้ Card Reader แตะบัตรเพื่อรับค่าอัตโนมัติ:</p>
            {cardReaderActive ? (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border-2 border-amber-400 rounded-xl animate-pulse-ring">
                <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800">กรุณาแตะบัตรนักเรียน...</p>
                  {cardReadStatus && <p className="text-sm text-amber-700 mt-1">{cardReadStatus}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => { setCardReaderActive(false); setCardReadStatus('') }}
                  className="ml-auto btn-secondary btn-sm"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setCardReaderActive(true); setCardReadStatus('') }}
                id="activate-card-reader"
                className="btn-warning"
              >
                <CreditCard className="w-4 h-4" /> เปิดใช้ Card Reader
              </button>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/admin/students')} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" id="save-student-btn" disabled={loading} className="btn-primary">
            {loading ? <><Spinner size="sm" className="text-white" /> กำลังบันทึก...</> : <><Save className="w-4 h-4" /> {editId ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มนักเรียน'}</>}
          </button>
        </div>
      </form>
    </div>
  )
}
