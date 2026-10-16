import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, Upload, Search, Filter, Eye, Edit, CreditCard, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Student, EducationLevel, ClassRoom } from '../../lib/types'
import {
  SectionHeader, SearchInput, PageLoading, EmptyState, ErrorState,
  Avatar, Badge, showToast, showError, confirmDelete, TableSkeleton
} from '../../components/ui/index'
import StudentExcelImportModal from '../../components/admin/StudentExcelImportModal'

export default function AdminStudents() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<Student[]>([])
  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>([])
  const [classRooms, setClassRooms] = useState<ClassRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PER_PAGE = 20

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('students')
        .select(`
          *,
          education_level:education_levels(id, name, code),
          class_room:class_rooms(id, name, room_code),
          student_total_points(total_points)
        `, { count: 'exact' })
        .order('student_code')
        .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,student_code.ilike.%${search}%,card_number.ilike.%${search}%`)
      }
      if (filterLevel) query = query.eq('education_level_id', filterLevel)
      if (filterRoom) query = query.eq('class_room_id', filterRoom)
      if (filterStatus) query = query.eq('status', filterStatus)

      const { data, error: err, count } = await query
      if (err) throw err
      
      const mappedData = (data || []).map((s: any) => {
        let pts = 0
        if (s.student_total_points) {
           pts = Array.isArray(s.student_total_points) 
             ? (s.student_total_points[0]?.total_points || 0) 
             : (s.student_total_points.total_points || 0)
        }
        return { ...s, total_points: pts }
      })

      setStudents(mappedData as Student[])
      setTotal(count || 0)
    } catch {
      setError('ไม่สามารถโหลดข้อมูลนักเรียนได้')
    } finally {
      setLoading(false)
    }
  }, [search, filterLevel, filterRoom, filterStatus, page])

  useEffect(() => {
    supabase.from('education_levels').select('*').order('sort_order').then(({ data }) => {
      if (data) setEducationLevels(data)
    })
    supabase.from('class_rooms').select('*').order('name').then(({ data }) => {
      if (data) setClassRooms(data)
    })
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  async function exportCSV() {
    const { data } = await supabase
      .from('students')
      .select(`*, education_level:education_levels(name), class_room:class_rooms(name), student_total_points(total_points)`)
      .order('student_code')

    if (!data) return
    const headers = ['รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'ชื่อเล่น', 'ระดับ', 'ห้อง', 'หมายเลขบัตร', 'พอยต์สะสม', 'สถานะ']
    const rows = data.map((s: any) => {
      const level = s.education_level as Record<string, unknown> | null
      const room = s.class_room as Record<string, unknown> | null
      let pts = 0
      if (s.student_total_points) {
         pts = Array.isArray(s.student_total_points) 
           ? (s.student_total_points[0]?.total_points || 0) 
           : (s.student_total_points.total_points || 0)
      }
      return [
        s.student_code, s.first_name, s.last_name, s.nickname || '',
        level?.name || '', room?.name || '', s.card_number || '', pts, s.status
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'students.csv'; a.click()
    URL.revokeObjectURL(url)
    showToast('ดาวน์โหลด CSV สำเร็จ')
  }

  const statusMap: Record<string, { label: string; variant: 'green' | 'gray' | 'blue' | 'red' }> = {
    ACTIVE: { label: 'ปกติ', variant: 'green' },
    INACTIVE: { label: 'ไม่ใช้งาน', variant: 'gray' },
    GRADUATED: { label: 'จบการศึกษา', variant: 'blue' },
    TRANSFERRED: { label: 'ย้ายออก', variant: 'red' },
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="จัดการนักเรียน"
        subtitle={`ทั้งหมด ${total.toLocaleString()} คน`}
        actions={
          <div className="flex gap-2">
            <button onClick={exportCSV} className="btn-secondary btn-sm">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={() => setShowImportModal(true)} className="btn-secondary btn-sm">
              <Upload className="w-4 h-4" /> นำเข้า Excel
            </button>
            <button onClick={() => navigate('/admin/students/register')} className="btn-primary">
              <Plus className="w-4 h-4" /> เพิ่มนักเรียน
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="ค้นหาชื่อ, รหัส, หมายเลขบัตร..." className="lg:col-span-1" />
          <select className="form-select" value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setPage(1) }}>
            <option value="">ทุกระดับ</option>
            {educationLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="form-select" value={filterRoom} onChange={e => { setFilterRoom(e.target.value); setPage(1) }}>
            <option value="">ทุกห้อง</option>
            {classRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="form-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">ทุกสถานะ</option>
            <option value="ACTIVE">ปกติ</option>
            <option value="INACTIVE">ไม่ใช้งาน</option>
            <option value="GRADUATED">จบการศึกษา</option>
            <option value="TRANSFERRED">ย้ายออก</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchStudents} />
      ) : students.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<span className="text-3xl">👤</span>}
            title="ไม่พบนักเรียน"
            description="ยังไม่มีนักเรียนในระบบ หรือลองเปลี่ยนตัวกรองใหม่"
            action={
              <button onClick={() => navigate('/admin/students/register')} className="btn-primary">
                <Plus className="w-4 h-4" /> เพิ่มนักเรียนใหม่
              </button>
            }
          />
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>นักเรียน</th>
                <th>รหัสนักเรียน</th>
                <th>ระดับ / ห้อง</th>
                <th>หมายเลขบัตร</th>
                <th>พอยต์สะสม</th>
                <th>สถานะ</th>
                <th className="text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => {
                const status = statusMap[student.status] || { label: student.status, variant: 'gray' as const }
                return (
                  <tr key={student.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={`${student.first_name} ${student.last_name}`} src={student.avatar_url} size="sm" />
                        <div>
                          <p className="font-medium text-slate-800">{student.first_name} {student.last_name}</p>
                          <div className="flex items-center gap-2">
                            {student.nickname && <span className="text-xs text-slate-500">({student.nickname})</span>}
                            {!student.user_id && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">รอลงทะเบียนบัญชี</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-sm text-slate-600">{student.student_code}</td>
                    <td>
                      <div className="text-sm">
                        <p className="text-slate-800">{(student.education_level as EducationLevel | undefined)?.name || '-'}</p>
                        <p className="text-slate-500">{(student.class_room as ClassRoom | undefined)?.name || '-'}</p>
                      </div>
                    </td>
                    <td>
                      {student.card_number ? (
                        <span className="font-mono text-sm text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {student.card_number}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm italic">ยังไม่ลงทะเบียน</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 font-semibold text-amber-500">
                        <span>{student.total_points?.toLocaleString() || 0}</span>
                        <span className="text-xs">pt</span>
                      </div>
                    </td>
                    <td>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/students/register?id=${student.id}`)}
                          className="btn-icon btn-ghost text-slate-500 hover:text-primary-600"
                          title="แก้ไข / ลงทะเบียนบัตร"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/students/register?id=${student.id}`)}
                          className="btn-icon btn-ghost text-slate-500 hover:text-blue-600"
                          title="แก้ไข"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirmDelete('ยืนยันการลบนักเรียน', `คุณต้องการลบ ${student.first_name} ${student.last_name} ใช่หรือไม่? ข้อมูลทั้งหมดที่เกี่ยวข้องจะถูกลบ`)) {
                              // ลบจาก auth.users ก่อน (ถ้ามี user_id)
                              if (student.user_id) {
                                await supabase.rpc('admin_delete_user', { p_user_id: student.user_id })
                              }
                              // ลบจากตาราง students
                              const { error } = await supabase.from('students').delete().eq('id', student.id)
                              if (error) {
                                showError('ลบไม่สำเร็จ', error.message)
                              } else {
                                showToast('ลบนักเรียนเรียบร้อยแล้ว')
                                fetchStudents()
                              }
                            }
                          }}
                          className="btn-icon btn-ghost text-slate-500 hover:text-red-600"
                          title="ลบนักเรียน"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > PER_PAGE && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <p>แสดง {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} จาก {total.toLocaleString()} รายการ</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary btn-sm">ก่อนหน้า</button>
            <button disabled={page * PER_PAGE >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary btn-sm">ถัดไป</button>
          </div>
        </div>
      )}

      {showImportModal && (
        <StudentExcelImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); fetchStudents() }}
          educationLevels={educationLevels}
          classRooms={classRooms}
        />
      )}
    </div>
  )
}
