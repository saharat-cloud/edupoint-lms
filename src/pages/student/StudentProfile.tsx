import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SectionHeader, PageLoading } from '../../components/ui/index'

export default function StudentProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const [student, setStudent] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '' })

  useEffect(() => {
    if (!user) return
    supabase.from('students').select(`*, education_level:education_levels(name), class_room:class_rooms(name)`)
      .eq('user_id', user.id).single().then(({ data }) => {
        if (data) setStudent(data as Record<string, unknown>)
        setLoading(false)
      })
    if (profile) setForm({ full_name: profile.full_name || '' })
  }, [user, profile])

  if (loading) return <PageLoading />

  const level = student?.education_level as Record<string, string> | undefined
  const room = student?.class_room as Record<string, string> | undefined

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader title="โปรไฟล์" subtitle="ข้อมูลส่วนตัวของคุณ" />
      <div className="card p-6 space-y-4">
        {student && (
          <div className="space-y-3">
            {[
              { label: 'รหัสนักเรียน', value: student.student_code as string },
              { label: 'ชื่อ-นามสกุล', value: `${student.first_name} ${student.last_name}` },
              { label: 'ชื่อเล่น', value: student.nickname as string || '-' },
              { label: 'ระดับการศึกษา', value: level?.name || '-' },
              { label: 'ห้องเรียน', value: room?.name || '-' },
              { label: 'หมายเลขบัตร', value: student.card_number as string || 'ยังไม่ลงทะเบียน' },
              { label: 'อีเมล', value: user?.email || '-' },
            ].map(item => (
              <div key={item.label} className="flex justify-between py-2 border-b border-slate-100">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="text-sm font-medium text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="alert-info">
        <span>ℹ️</span>
        <p>หากต้องการเปลี่ยนแปลงข้อมูล กรุณาติดต่อครูหรือผู้ดูแลระบบ</p>
      </div>
    </div>
  )
}

// Remaining student pages (stubs that are functional enough)
export { StudentProfile }
