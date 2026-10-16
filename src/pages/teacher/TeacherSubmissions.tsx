import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Submission } from '../../lib/types'
import { SectionHeader, PageLoading, EmptyState, SubmissionStatusBadge, SearchInput, formatDateTime, Avatar, Badge } from '../../components/ui/index'

export default function TeacherSubmissions() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [submissions, setSubmissions] = useState<Array<Submission & Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('SUBMITTED')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // Get teacher's assignment IDs
    const { data: myAssignments } = await supabase.from('assignments').select('id').eq('teacher_id', user.id)
    const assignmentIds = (myAssignments || []).map((a: Record<string, string>) => a.id)
    if (assignmentIds.length === 0) { setSubmissions([]); setLoading(false); return }

    let query = supabase.from('submissions')
      .select(`*, assignment:assignments(title, academic_full_score), student:students(first_name, last_name, student_code, avatar_url, class_room:class_rooms(name))`)
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false })
      .limit(50)

    if (filterStatus) query = query.eq('status', filterStatus)

    const { data } = await query
    let items = (data || []) as Array<Submission & Record<string, unknown>>
    if (search) {
      const s = search.toLowerCase()
      items = items.filter(sub => {
        const student = sub.student as Record<string, string> | undefined
        const assignment = sub.assignment as Record<string, string> | undefined
        return (
          `${student?.first_name} ${student?.last_name}`.toLowerCase().includes(s) ||
          student?.student_code?.toLowerCase().includes(s) ||
          assignment?.title?.toLowerCase().includes(s)
        )
      })
    }
    setSubmissions(items)
    setLoading(false)
  }, [user, search, filterStatus])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <SectionHeader title="ตรวจงาน" subtitle="รายการงานที่นักเรียนส่งมา" />

      <div className="flex gap-3 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="ค้นหานักเรียน, งาน..." className="flex-1 min-w-[200px]" />
        <select className="form-select w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="SUBMITTED">รอตรวจ</option>
          <option value="REVIEWING">กำลังตรวจ</option>
          <option value="GRADED">ตรวจแล้ว</option>
          <option value="RESUBMISSION_REQUIRED">แก้ไข</option>
          <option value="RETURNED">คืนงาน</option>
        </select>
      </div>

      {loading ? <PageLoading /> : submissions.length === 0 ? (
        <div className="card p-8">
          <EmptyState icon={<span className="text-3xl">📋</span>} title="ไม่มีงานรอตรวจ" description="เยี่ยม! ไม่มีงานค้าง" />
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => {
            const student = sub.student as Record<string, unknown> | undefined
            const assignment = sub.assignment as Record<string, unknown> | undefined
            const classRoom = (student?.class_room as Record<string, string> | undefined)
            return (
              <div key={sub.id}
                className="card p-5 hover:shadow-card-hover cursor-pointer transition-shadow"
                onClick={() => navigate(`/admin/submissions/${sub.id}`)}>
                <div className="flex items-center gap-4">
                  <Avatar name={`${student?.first_name} ${student?.last_name}`} src={student?.avatar_url as string} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-slate-800">{student?.first_name as string} {student?.last_name as string}</p>
                      {classRoom && <Badge variant="gray">{classRoom.name}</Badge>}
                      {sub.is_late && <Badge variant="red">ส่งสาย</Badge>}
                    </div>
                    <p className="text-sm text-slate-600 truncate">{assignment?.title as string}</p>
                    <p className="text-xs text-slate-400 mt-0.5">ส่งเมื่อ {formatDateTime(sub.submitted_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <SubmissionStatusBadge status={sub.status} />
                    {sub.academic_score != null && (
                      <span className="text-sm font-semibold text-slate-700">{sub.academic_score}/{assignment?.academic_full_score}</span>
                    )}
                    <span className="text-xs text-slate-400">ครั้งที่ {sub.attempt_number}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
