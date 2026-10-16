import React, { useEffect, useState } from 'react'
import { Users, CheckCircle, Clock, XCircle, Settings, FileText, Printer, Upload, ArrowLeft, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Subject, Semester, ClassRoom } from '../../lib/types'
import { PageLoading, Spinner, showError } from '../../components/ui/index'

// ── Types ────────────────────────────────────────────────
interface GroupMission {
  topic: string
  mission_points: number
}

interface IndividualAssignment {
  id: string
  title: string
  academic_full_score: number
  point_target: number
  description: string | null
}

interface StudentRow {
  id: string
  student_code: string
  first_name: string
  last_name: string
  nickname: string | null
  groupPoints: Record<string, number | null>    // topic -> points earned
  assignmentScores: Record<string, number | null> // assignment_id -> academic_score
  assignmentPoints: Record<string, number | null> // assignment_id -> points_earned
}

// Natural sort for classroom names like "ปวช.1/10", "ปวช.1/2"
function naturalSort(a: ClassRoom, b: ClassRoom) {
  return a.name.localeCompare(b.name, 'th', { numeric: true, sensitivity: 'base' })
}

function formatSemesterName(name?: string) {
  if (!name) return ''
  const match = name.match(/^(\d{4})\s*(ภาคเรียนที่\s*\d+)$/)
  if (match) {
    return `${match[2]} ปีการศึกษา ${match[1]}`
  }
  return name
}

// ── Component ─────────────────────────────────────────────
export default function TeacherGradebook() {
  const { user, profile, role } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [classRooms, setClassRooms] = useState<ClassRoom[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [missions, setMissions] = useState<GroupMission[]>([])
  const [assignments, setAssignments] = useState<IndividualAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [termMaxPoints, setTermMaxPoints] = useState(0)
  const [loadingInit, setLoadingInit] = useState(true)
  const [filter, setFilter] = useState({ subject_id: '', semester_id: '', class_room_id: '' })
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false)
  const [newAssignmentTitle, setNewAssignmentTitle] = useState('')
  const [newAssignmentScore, setNewAssignmentScore] = useState('10')
  const [newAssignmentPoints, setNewAssignmentPoints] = useState('0')
  const [creating, setCreating] = useState(false)
  const [viewMode, setViewMode] = useState<'SCORE' | 'POINTS'>('POINTS')

  // Edit Assignment State
  const [editingAssignment, setEditingAssignment] = useState<IndividualAssignment | null>(null)
  const [editAsgTitle, setEditAsgTitle] = useState('')
  const [editAsgScore, setEditAsgScore] = useState('')

  // Randomizer State
  const [randomStudent, setRandomStudent] = useState<StudentRow | null>(null)
  const [isShuffling, setIsShuffling] = useState(false)

  // ── Init: subjects + semesters ──────────────────────────
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

      // Fetch term max points from point_settings
      const { data: psData } = await supabase.from('point_settings').select('term_max_points').eq('id', 1).single()
      if (psData) setTermMaxPoints(psData.term_max_points)

      const sems = semRes.data || []
      setSubjects(uniqueSubjects)
      setSemesters(sems)
      if (sems.length > 0) setFilter(f => ({ ...f, semester_id: f.semester_id || sems[0].id }))
      setLoadingInit(false)
    }
    if (user && role) loadInit()
  }, [user, role])

  // ── Load classrooms from teacher_subjects config ────────
  useEffect(() => {
    if (!filter.subject_id || !filter.semester_id) { setClassRooms([]); return }

    let query = supabase.from('teacher_subjects')
      .select('class_room:class_rooms(id,name,room_code)')
      .eq('subject_id', filter.subject_id)
      .eq('semester_id', filter.semester_id)

    if (role !== 'SUPER_ADMIN') query = query.eq('teacher_id', user!.id)

    query.then(({ data }) => {
      const rooms = (data || []).map((ts: any) => ts.class_room).filter(Boolean)
      const uniqueRooms = Array.from(new Map(rooms.map((r: any) => [r.id, r])).values()) as ClassRoom[]
      const sorted = uniqueRooms.sort(naturalSort)
      setClassRooms(sorted)
      if (sorted.length > 0 && !filter.class_room_id) {
        setFilter(f => ({ ...f, class_room_id: sorted[0].id }))
      }
    })
  }, [filter.subject_id, filter.semester_id])

  // ── Load gradebook data ─────────────────────────────────
  useEffect(() => {
    if (!filter.subject_id || !filter.semester_id || !filter.class_room_id) {
      setStudents([]); setMissions([]); setAssignments([]); return
    }
    loadGradebook()
  }, [filter.subject_id, filter.semester_id, filter.class_room_id])

  async function loadGradebook() {
    setLoading(true)
    try {
      // 1. Students in this classroom
      const { data: stData, error: stErr } = await supabase
        .from('students')
        .select('id, student_code, first_name, last_name, nickname')
        .eq('class_room_id', filter.class_room_id)
        .eq('status', 'ACTIVE')
        .order('student_code')
      if (stErr) throw stErr

      // 2. Group missions (student_groups with topic) for this classroom
      const { data: groupsData } = await supabase
        .from('student_groups')
        .select(`
          id, name, topic, mission_points,
          members:student_group_members(student_id)
        `)
        .eq('room_id', filter.class_room_id)
        .not('topic', 'is', null)
        .order('created_at')

      // 3. Extract unique missions (by topic)
      const missionMap = new Map<string, GroupMission>()
      for (const g of groupsData || []) {
        if (g.topic && !missionMap.has(g.topic)) {
          missionMap.set(g.topic, { topic: g.topic, mission_points: g.mission_points || 0 })
        }
      }
      const missionList = Array.from(missionMap.values())
      setMissions(missionList)

      // 4. Fetch point_transactions for all these groups
      const groupIds = (groupsData || []).map((g: any) => g.id)
      let txData: any[] = []
      if (groupIds.length > 0) {
        const { data: txs } = await supabase
          .from('point_transactions')
          .select('source_id, points, student_id')
          .in('source_id', groupIds)
          .ilike('note', 'Mission Complete%')
        txData = txs || []
      }

      // 5. Build map: student_id + topic -> points earned
      // First: group_id -> topic
      const groupTopicMap = new Map<string, string>()
      for (const g of groupsData || []) {
        if (g.topic) groupTopicMap.set(g.id, g.topic)
      }
      // student_id -> { topic -> points }
      const studentPointMap = new Map<string, Record<string, number>>()
      for (const tx of txData) {
        const topic = groupTopicMap.get(tx.source_id)
        if (!topic || !tx.student_id) continue
        if (!studentPointMap.has(tx.student_id)) studentPointMap.set(tx.student_id, {})
        studentPointMap.get(tx.student_id)![topic] = tx.points
      }

      // 6. Fetch individual assignments for this subject (all non-draft)
      const studentIdList = (stData || []).map((s: any) => s.id)

      let assignmentList: IndividualAssignment[] = []
      let studentAssignmentScores: Record<string, Record<string, number | null>> = {}
      let studentAssignmentPoints: Record<string, Record<string, number | null>> = {}

      const { data: asgData } = await supabase
        .from('assignments')
        .select('id, title, academic_full_score, point_target, description')
        .eq('subject_id', filter.subject_id)
        .neq('status', 'DRAFT')
        .order('created_at')

      let rawAssignmentList = (asgData || []) as IndividualAssignment[]
      assignmentList = rawAssignmentList.filter(a => {
        if (a.description?.startsWith('QUICK_ROOM:')) {
          const roomId = a.description.split(':')[1]
          return roomId === filter.class_room_id
        }
        return true
      })

      if (assignmentList.length > 0 && studentIdList.length > 0) {
        // Fetch graded submissions for these assignments + students in this room
        const { data: subData } = await supabase
          .from('submissions')
          .select('student_id, assignment_id, academic_score, points_earned')
          .in('assignment_id', assignmentList.map(a => a.id))
          .in('student_id', studentIdList)
          .eq('status', 'GRADED')

        for (const sub of (subData || [])) {
          if (!studentAssignmentScores[sub.student_id]) studentAssignmentScores[sub.student_id] = {}
          if (!studentAssignmentPoints[sub.student_id]) studentAssignmentPoints[sub.student_id] = {}
          studentAssignmentScores[sub.student_id][sub.assignment_id] = sub.academic_score
          studentAssignmentPoints[sub.student_id][sub.assignment_id] = sub.points_earned
        }
      }

      setAssignments(assignmentList)


      // 7. Build student rows
      const rows: StudentRow[] = (stData || []).map(s => ({
        id: s.id,
        student_code: s.student_code,
        first_name: s.first_name,
        last_name: s.last_name,
        nickname: s.nickname,
        groupPoints: Object.fromEntries(missionList.map(m => [
          m.topic,
          studentPointMap.get(s.id)?.[m.topic] ?? null
        ])),
        assignmentScores: Object.fromEntries(assignmentList.map(a => [
          a.id,
          studentAssignmentScores[s.id]?.[a.id] ?? null
        ])),
        assignmentPoints: Object.fromEntries(assignmentList.map(a => [
          a.id,
          studentAssignmentPoints[s.id]?.[a.id] ?? null
        ]))
      }))
      setStudents(rows)
    } catch (err: any) {
      await showError('โหลดข้อมูลไม่สำเร็จ', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateAssignment() {
    if (!newAssignmentTitle.trim() || creating) return

    const score = Number(newAssignmentScore) || 10
    const pts = Number(newAssignmentPoints) || 0

    try {
      setCreating(true)
      const { error } = await supabase.from('assignments').insert({
        subject_id: filter.subject_id,
        semester_id: filter.semester_id,
        teacher_id: profile!.id,
        title: newAssignmentTitle.trim(),
        academic_full_score: score,
        point_target: pts,
        status: 'PUBLISHED',
        description: filter.class_room_id ? `QUICK_ROOM:${filter.class_room_id}` : null
      })
      if (error) throw error
      
      setNewAssignmentTitle('')
      setNewAssignmentScore('10')
      setNewAssignmentPoints('0')
      setIsCreatingAssignment(false)
      loadGradebook()
    } catch (err: any) {
      await showError('เพิ่มงานไม่สำเร็จ', err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdateScore(studentId: string, assignmentId: string, valStr: string, mode: 'SCORE' | 'POINTS', asg: IndividualAssignment) {
    const scoreStr = valStr.trim()
    const numVal = scoreStr === '' ? null : Number(scoreStr)
    if (numVal !== null && isNaN(numVal)) return

    let finalScore = numVal
    let finalPoints = numVal

    if (numVal !== null) {
      if (mode === 'POINTS') {
        let clampedVal = numVal > asg.point_target ? asg.point_target : numVal
        if (clampedVal < 0) clampedVal = 0
        
        if (clampedVal !== numVal) {
          showError('คะแนนเกินขีดจำกัด', 'ระบบได้ปรับลดลงให้เท่ากับพอยต์สูงสุดที่ตั้งไว้')
        }

        finalPoints = clampedVal
        if (asg.point_target > 0) {
          finalScore = Math.ceil((clampedVal / asg.point_target) * asg.academic_full_score)
        } else {
          finalScore = 0
        }
      } else {
        let clampedVal = numVal > asg.academic_full_score ? asg.academic_full_score : numVal
        if (clampedVal < 0) clampedVal = 0
        
        if (clampedVal !== numVal) {
          showError('คะแนนเกินขีดจำกัด', 'ระบบได้ปรับลดลงให้เท่ากับคะแนนสูงสุดที่ตั้งไว้')
        }

        finalScore = Math.round(clampedVal)
        if (asg.academic_full_score > 0) {
          finalPoints = Math.round((finalScore / asg.academic_full_score) * asg.point_target)
        } else {
          finalPoints = asg.point_target
        }
      }
    }

    // Optimistic UI update
    setStudents(prev => prev.map(s => s.id === studentId ? {
      ...s, 
      assignmentScores: { ...s.assignmentScores, [assignmentId]: finalScore },
      assignmentPoints: { ...s.assignmentPoints, [assignmentId]: finalPoints }
    } : s))

    try {
      if (finalScore === null) {
        await supabase.from('submissions').delete().match({ student_id: studentId, assignment_id: assignmentId })
      } else {
        // Upsert approach
        const { data: existing } = await supabase.from('submissions')
          .select('id').match({ student_id: studentId, assignment_id: assignmentId }).maybeSingle()
          
        if (existing) {
          await supabase.from('submissions').update({ academic_score: finalScore, points_earned: finalPoints, status: 'GRADED' }).eq('id', existing.id)
        } else {
          await supabase.from('submissions').insert({
            student_id: studentId,
            assignment_id: assignmentId,
            academic_score: finalScore,
            points_earned: finalPoints,
            status: 'GRADED',
            attempt_number: 1
          })
        }
      }
    } catch (err: any) {
      // Revert on error by reloading
      loadGradebook()
    }
  }

  function openEditAssignment(a: IndividualAssignment) {
    setEditingAssignment(a)
    setEditAsgTitle(a.title)
    setEditAsgScore(a.academic_full_score.toString())
  }

  async function handleSaveAssignment() {
    if (!editingAssignment || !editAsgTitle.trim()) return
    const score = Number(editAsgScore) || 0
    try {
      setLoading(true)
      const { error } = await supabase.from('assignments')
        .update({ title: editAsgTitle.trim(), academic_full_score: score })
        .eq('id', editingAssignment.id)
      if (error) throw error
      setEditingAssignment(null)
      loadGradebook()
    } catch (err: any) {
      await showError('บันทึกไม่สำเร็จ', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAssignment() {
    if (!editingAssignment) return
    const ok = window.confirm('การลบงานจะทำให้คะแนนทั้งหมดของงานนี้หายไปด้วย ยืนยันหรือไม่?')
    if (!ok) return
    try {
      setLoading(true)
      const { error } = await supabase.from('assignments').delete().eq('id', editingAssignment.id)
      if (error) throw error
      setEditingAssignment(null)
      loadGradebook()
    } catch (err: any) {
      await showError('ลบงานไม่สำเร็จ', err.message)
    } finally {
      setLoading(false)
    }
  }

  function exportCSV() {
    if (students.length === 0) return
    const headers = ['ลำดับ', 'รหัส', 'ชื่อ', 'นามสกุล',
      ...missions.map(m => `${m.topic} (/${m.mission_points}pt)`),
      'รวมพอยต์']
    const csvRows = students.map((s, idx) => {
      const total = missions.reduce((sum, m) => sum + (s.groupPoints[m.topic] ?? 0), 0)
      return [idx + 1, s.student_code, s.first_name, s.last_name,
        ...missions.map(m => s.groupPoints[m.topic] ?? '-'), total]
    })
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'gradebook_group.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleRandomStudent() {
    if (students.length === 0) {
      showToast('ไม่มีนักเรียนในห้องนี้', 'error')
      return
    }
    setRandomStudent(students[0])
    setIsShuffling(true)
    let iterations = 0
    const maxIterations = 50 // 50 * 100ms = 5 seconds
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * students.length)
      setRandomStudent(students[randomIdx])
      iterations++
      if (iterations >= maxIterations) {
        clearInterval(interval)
        setIsShuffling(false)
      }
    }, 100)
  }

  function openPrintView() {
    if (!filter.subject_id || !filter.semester_id) return
    const url = `/admin/print/gradebook?subject_id=${filter.subject_id}&semester_id=${filter.semester_id}&class_room_id=${filter.class_room_id}`
    window.open(url, '_blank')
  }

  if (loadingInit) return <PageLoading />

  const selectedSubject = subjects.find(s => s.id === filter.subject_id)
  const selectedSemester = semesters.find(s => s.id === filter.semester_id)

  // ── Subject Selection ────────────────────────────────────
  if (!filter.subject_id) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">สมุดคะแนน (Gradebook)</h1>
            <p className="text-slate-500 text-sm mt-1">เลือกรายวิชาที่ต้องการจัดการคะแนน</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">ภาคเรียน:</label>
            <select className="form-select min-w-[200px]" value={filter.semester_id}
              onChange={e => setFilter(f => ({ ...f, semester_id: e.target.value, class_room_id: '' }))}>
              <option value="">-- เลือกภาคเรียน --</option>
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {filter.semester_id ? (
          subjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {subjects.map(s => (
                <div key={s.id}
                  onClick={() => {
                    setFilter(f => ({ ...f, subject_id: s.id, class_room_id: '' }))
                    setViewMode('POINTS')
                  }}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md border border-slate-200 p-6 cursor-pointer transition-all hover:-translate-y-1 hover:border-indigo-300 group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <FileText className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">{s.code}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors line-clamp-2">{s.name}</h3>
                  <p className="text-sm text-slate-500 mt-4 flex items-center gap-1.5">
                    <Settings className="w-4 h-4" /> จัดการคะแนน
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
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

  // ── Gradebook View ──────────────────────────────────────
  const totalMaxScore = assignments.reduce((s, a) => s + a.academic_full_score, 0)
  const totalMaxPoints = missions.reduce((s, m) => s + m.mission_points, 0) + assignments.reduce((s, a) => s + a.point_target, 0)
  
  const currentMax = viewMode === 'SCORE' ? totalMaxScore : totalMaxPoints

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative">
        <div className="absolute top-6 right-6 z-10">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button onClick={() => setViewMode('SCORE')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'SCORE' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>มุมมองคะแนนจริง</button>
            <button onClick={() => setViewMode('POINTS')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'POINTS' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>มุมมองพอยต์</button>
          </div>
        </div>
        <button onClick={() => {
            setFilter({ subject_id: '', semester_id: filter.semester_id, class_room_id: '' })
            setViewMode('POINTS')
          }}
          className="text-slate-400 hover:text-slate-600 text-sm mb-3 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" /> กลับไปเลือกวิชา
        </button>

        <h1 className="text-2xl font-bold text-slate-800 mb-1">{selectedSubject?.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mb-4">
          <span>สอนโดย: {(profile as any)?.full_name || 'ผู้ดูแลระบบ'}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300 inline-block"></span>
          <span className="flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-blue-500" /> {formatSemesterName(selectedSemester?.name)}
          </span>
        </div>



        {/* Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={openPrintView} className="btn-primary whitespace-nowrap bg-indigo-500 hover:bg-indigo-600 border-indigo-500">
            <Printer className="w-4 h-4" /> ส่งออกคะแนน
          </button>
          <button onClick={handleRandomStudent} className="btn-primary whitespace-nowrap bg-orange-500 hover:bg-orange-600 border-orange-500">
            <Users className="w-4 h-4" /> สุ่มเลือก
          </button>
        </div>
      </div>

      {/* Classroom Tabs */}
      {classRooms.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200">
          {classRooms.map(room => {
            const isActive = filter.class_room_id === room.id
            return (
              <button key={room.id}
                onClick={() => setFilter(f => ({ ...f, class_room_id: room.id }))}
                className={`px-5 py-3 rounded-t-lg font-medium text-sm transition-all whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'bg-white text-indigo-600 border-t border-l border-r border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative z-10 -mb-[1px]'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}>
                <div>{room.name}</div>
                <div className={`text-[10px] mt-0.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>ทุกคน</div>
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden -mt-[1px]">
        {loading ? (
          <div className="py-20 flex justify-center"><Spinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                {/* Row 1: Group header */}
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-2 py-3 font-semibold text-slate-500 border-r border-slate-100 text-center sticky bg-slate-50/95 backdrop-blur z-20 shadow-[1px_0_0_0_#f1f5f9]" style={{ minWidth: 40, maxWidth: 40, width: 40, left: 0 }} rowSpan={2}>#</th>
                  <th className="px-2 py-3 font-semibold text-slate-500 border-r border-slate-100 text-left sticky bg-slate-50/95 backdrop-blur z-20 shadow-[1px_0_0_0_#f1f5f9]" style={{ minWidth: 90, maxWidth: 90, width: 90, left: 40 }} rowSpan={2}>
                    รหัส
                  </th>
                  <th className="px-2 py-3 font-semibold text-slate-500 border-r border-slate-100 text-left sticky bg-slate-50/95 backdrop-blur z-20 shadow-[1px_0_0_0_#f1f5f9]" style={{ minWidth: 180, maxWidth: 180, width: 180, left: 130 }} rowSpan={2}>
                    ชื่อ-นามสกุล
                  </th>
                  <th className="px-2 py-3 font-semibold text-slate-500 border-r border-slate-100 text-left sticky bg-slate-50/95 backdrop-blur z-20 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.05)]" style={{ minWidth: 60, maxWidth: 60, width: 60, left: 310 }} rowSpan={2}>
                    ชื่อเล่น
                  </th>

                  {/* Individual Assignments (blue) */}
                  {(assignments.length > 0 || isCreatingAssignment || true) && (
                    <th className="px-1 py-1.5 text-center text-xs font-semibold text-sky-700 bg-sky-50/80 border-t-2 border-t-sky-400 border-l border-sky-100"
                      colSpan={assignments.length + 1}>
                      งานเดี่ยว
                    </th>
                  )}

                  {/* Group Missions (green) */}
                  {missions.length > 0 && (
                    <th className="px-1 py-1.5 text-center text-xs font-semibold text-emerald-700 bg-emerald-50/80 border-t-2 border-t-emerald-400 border-l border-emerald-100"
                      colSpan={missions.length}>
                      งานกลุ่ม
                    </th>
                  )}

                  {/* Spacer column to absorb remaining width */}
                  <th className="w-full bg-slate-50/50 border-b border-slate-200" rowSpan={2}></th>

                  {/* Total */}
                  <th className="px-2 py-1 text-center bg-amber-50/80 border-t-2 border-t-amber-400 border-l border-amber-100" style={{ minWidth: 75, maxWidth: 75, width: 75 }} rowSpan={2}>
                    <div className="font-bold text-amber-800 text-xs">รวม</div>
                    <div className="text-xs text-amber-600 font-medium">/{currentMax} {viewMode === 'POINTS' && 'pt'}</div>
                  </th>
                </tr>
                {/* Row 2: Individual column names + Mission column names */}
                <tr className="bg-slate-50 border-b border-slate-200">
                  {assignments.map((a, i) => {
                    const isSystem = !a.description?.startsWith('QUICK_ROOM:') && (a.description !== null || a.point_target > 0)
                    return (
                      <th key={i} onClick={() => !isSystem && openEditAssignment(a)} className={`px-1 py-1 text-center border-r border-sky-100 bg-sky-50/60 transition-colors group ${!isSystem ? 'cursor-pointer hover:bg-sky-100/50' : 'cursor-default'}`} style={{ minWidth: 75, maxWidth: 75, width: 75 }} title={isSystem ? "แก้ไขในระบบภาระงาน" : "คลิกเพื่อแก้ไข/ลบ"}>
                        <div className="font-semibold text-xs text-sky-800 truncate leading-tight group-hover:text-sky-600 flex items-center justify-center gap-0.5">
                          {a.title}
                        </div>
                        <div className="text-xs text-sky-500 mt-0.5">
                          {viewMode === 'SCORE' ? `/${a.academic_full_score}` : `/${a.point_target}pt`}
                        </div>
                      </th>
                    )
                  })}
                  
                  <th className="px-1 py-1 text-center border-r border-sky-100 bg-sky-50/60 group cursor-pointer hover:bg-sky-100/80 transition-colors" style={{ minWidth: 40, maxWidth: 40, width: 40 }} onClick={() => setIsCreatingAssignment(true)} title="สร้างงานใหม่">
                    <Plus className="w-4 h-4 mx-auto text-sky-500 group-hover:text-sky-700" />
                  </th>

                  {missions.map((m, i) => (
                    <th key={i} className="px-1 py-1 text-center border-r border-emerald-100 bg-emerald-50/60" style={{ minWidth: 75, maxWidth: 75, width: 75 }}>
                      <div className="font-semibold text-xs text-emerald-700 truncate leading-tight" title={m.topic}>{m.topic}</div>
                      <div className="text-xs text-emerald-500 mt-0.5">{viewMode === 'SCORE' ? '-' : `/${m.mission_points}pt`}</div>
                    </th>
                  ))}
                </tr>

              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={assignments.length + 1 + missions.length + 6} className="px-4 py-12 text-center text-slate-400">
                      {filter.class_room_id ? 'ไม่พบนักเรียนในห้องนี้' : 'กรุณาเลือกห้องเรียนด้านบน'}
                    </td>
                  </tr>
                ) : students.map((s, idx) => {
                  const asgScore = assignments.reduce((sum, a) => sum + (s.assignmentScores[a.id] ?? 0), 0)
                  const asgPoints = assignments.reduce((sum, a) => {
                    const dbPts = s.assignmentPoints[a.id]
                    const score = s.assignmentScores[a.id]
                    if (score === null || score === undefined) return sum
                    // Fallback to proportional if dbPts is missing (legacy data)
                    if (dbPts === null || dbPts === undefined || (dbPts === 0 && score > 0)) {
                      if (a.academic_full_score > 0) {
                        return sum + Math.round((score / a.academic_full_score) * a.point_target)
                      }
                      return sum + a.point_target
                    }
                    return sum + dbPts
                  }, 0)
                  const groupPoints = missions.reduce((sum, m) => sum + (s.groupPoints[m.topic] ?? 0), 0)

                  const totalValue = viewMode === 'SCORE' ? asgScore : (asgPoints + groupPoints)
                  const pct = currentMax > 0 ? (totalValue / currentMax) * 100 : 0

                  return (
                    <tr key={s.id} className={`group border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-2 py-3 text-center text-slate-400 font-medium border-r border-slate-100 sticky bg-white group-hover:bg-indigo-50/40 transition-colors text-xs z-10 shadow-[1px_0_0_0_#f1f5f9]" style={{ minWidth: 40, maxWidth: 40, width: 40, left: 0 }}>{idx + 1}</td>
                      <td className="px-2 py-3 text-left border-r border-slate-100 sticky bg-white group-hover:bg-indigo-50/40 transition-colors text-xs font-mono text-slate-500 z-10 shadow-[1px_0_0_0_#f1f5f9]" style={{ minWidth: 90, maxWidth: 90, width: 90, left: 40 }}>
                        {s.student_code}
                      </td>
                      <td className="px-2 py-3 text-left border-r border-slate-100 sticky bg-white group-hover:bg-indigo-50/40 transition-colors z-10 shadow-[1px_0_0_0_#f1f5f9]" style={{ minWidth: 180, maxWidth: 180, width: 180, left: 130 }}>
                        <div className="font-medium text-slate-700 text-[13px]" title={`${s.first_name} ${s.last_name}`}>
                          {s.first_name} {s.last_name}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-left border-r border-slate-100 sticky bg-white group-hover:bg-indigo-50/40 transition-colors z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.05)]" style={{ minWidth: 60, maxWidth: 60, width: 60, left: 310 }}>
                        {s.nickname
                          ? <span className="text-xs font-medium text-indigo-600 truncate block">{s.nickname}</span>
                          : <span className="text-slate-200 text-xs">-</span>
                        }
                      </td>

                      {/* Individual assignment scores (blue) */}
                      {assignments.map((a, i) => {
                        const score = s.assignmentScores[a.id]
                        const points = s.assignmentPoints[a.id]
                        const isSystem = !a.description?.startsWith('QUICK_ROOM:') && (a.description !== null || a.point_target > 0)
                        
                        let displayValue = null
                        if (score !== null) {
                          if (viewMode === 'SCORE') displayValue = score
                          else {
                            if (points !== null && points !== undefined && !(points === 0 && score > 0)) {
                              displayValue = points
                            } else {
                              // Legacy fallback
                              displayValue = a.academic_full_score > 0 ? Math.round((score / a.academic_full_score) * a.point_target) : a.point_target
                            }
                          }
                        }

                        const inputValue = displayValue !== null ? displayValue : ''

                        return (
                          <td key={i} className="px-1 py-1.5 text-center border-r border-sky-100 bg-sky-50/20" style={{ minWidth: 75, maxWidth: 75, width: 75 }}>
                            {isSystem ? (
                              score !== null ? (
                                <div>
                                  <span className={`font-bold text-[11px] ${
                                    pct !== null && pct >= 80 ? 'text-sky-600' :
                                    pct !== null && pct < 50 ? 'text-red-500' : 'text-slate-700'
                                  }`}>{viewMode === 'POINTS' ? `+${displayValue}` : score}</span>
                                </div>
                              ) : <span className="text-slate-200 text-[10px]">-</span>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full w-full">
                                <input
                                  type="text"
                                  key={`${s.id}-${a.id}-${inputValue}-${viewMode}`} // Force re-render on value or mode change
                                  data-row={idx}
                                  data-col={i}
                                  className={`w-full text-center bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-sky-400 focus:bg-white rounded py-1 font-bold text-[12px] ${score !== null ? (pct !== null && pct < 50 ? 'text-red-500' : 'text-sky-700') : 'text-slate-300'}`}
                                  defaultValue={inputValue}
                                  placeholder="-"
                                  onBlur={(e) => {
                                    const rawVal = e.target.value.trim()
                                    // Always trigger handleUpdateScore, which now clamps internally
                                    if (rawVal !== inputValue.toString()) {
                                      handleUpdateScore(s.id, a.id, rawVal, viewMode, a)
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                      e.preventDefault()
                                      e.currentTarget.blur()
                                      const next = document.querySelector(`[data-row="${idx + 1}"][data-col="${i}"]`) as HTMLElement
                                      next?.focus()
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault()
                                      e.currentTarget.blur()
                                      const prev = document.querySelector(`[data-row="${idx - 1}"][data-col="${i}"]`) as HTMLElement
                                      prev?.focus()
                                    } else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
                                      e.preventDefault()
                                      e.currentTarget.blur()
                                      const next = document.querySelector(`[data-row="${idx}"][data-col="${i + 1}"]`) as HTMLElement
                                      next?.focus()
                                    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionEnd === 0) {
                                      e.preventDefault()
                                      e.currentTarget.blur()
                                      const prev = document.querySelector(`[data-row="${idx}"][data-col="${i - 1}"]`) as HTMLElement
                                      prev?.focus()
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </td>
                        )
                      })}

                      {/* Spacer cell for the '+' column */}
                      <td className="px-1 py-1.5 border-r border-sky-100 bg-sky-50/20" style={{ minWidth: isCreatingAssignment ? 100 : 40, maxWidth: isCreatingAssignment ? 100 : 40, width: isCreatingAssignment ? 100 : 40 }}></td>

                      {/* Group mission points (green) */}
                      {missions.map((m, i) => {
                        const pts = s.groupPoints[m.topic]
                        const pctPts = pts !== null && m.mission_points > 0 ? (pts / m.mission_points) * 100 : null

                        return (
                          <td key={i} className="px-1 py-1.5 text-center border-r border-emerald-100 bg-emerald-50/20" style={{ minWidth: 75, maxWidth: 75, width: 75 }}>
                            {viewMode === 'SCORE' ? (
                              <span className="text-slate-200 text-[10px]">-</span>
                            ) : pts !== null ? (
                              <div>
                                <span className={`font-bold text-[11px] ${
                                  pctPts !== null && pctPts >= 80 ? 'text-emerald-600' :
                                  pctPts !== null && pctPts < 50 ? 'text-red-500' : 'text-slate-700'
                                }`}>+{pts}</span>
                              </div>
                            ) : <span className="text-slate-200 text-[10px]">-</span>}
                          </td>
                        )
                      })}

                      {/* Spacer cell */}
                      <td className="w-full"></td>

                      {/* Total */}
                      <td className="px-1 py-1.5 text-center bg-amber-50/50 border-l border-amber-100" style={{ minWidth: 75, maxWidth: 75, width: 75 }}>
                        <div className="font-bold text-amber-700 text-[12px]">{totalValue > 0 ? (viewMode === 'POINTS' ? `+${totalValue}` : totalValue) : '0'}</div>

                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Assignment Modal */}
      {isCreatingAssignment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">สร้างงานด่วน</h3>
              <button onClick={() => setIsCreatingAssignment(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">ชื่อหัวข้อ</label>
                <input 
                  autoFocus
                  className="form-input" 
                  value={newAssignmentTitle} 
                  onChange={e => setNewAssignmentTitle(e.target.value)} 
                  placeholder="เช่น สอบย่อย 1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">คะแนนจริง (เต็ม)</label>
                  <input 
                    type="number"
                    className="form-input" 
                    value={newAssignmentScore} 
                    onChange={e => setNewAssignmentScore(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="form-label">พอยต์สะสม</label>
                  <input 
                    type="number"
                    className="form-input" 
                    value={newAssignmentPoints} 
                    onChange={e => setNewAssignmentPoints(e.target.value)} 
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setIsCreatingAssignment(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg shadow-sm">
                ยกเลิก
              </button>
              <button onClick={handleCreateAssignment} disabled={creating} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'สร้างงาน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">แก้ไขข้อมูลงาน</h3>
              <button onClick={() => setEditingAssignment(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
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
              <div>
                <label className="form-label">คะแนนเต็ม</label>
                <input 
                  type="number"
                  className="form-input" 
                  value={editAsgScore} 
                  onChange={e => setEditAsgScore(e.target.value)} 
                />
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button className="btn-danger mr-auto" onClick={handleDeleteAssignment} disabled={loading}>
                ลบงาน
              </button>
              <button className="btn-ghost" onClick={() => setEditingAssignment(null)} disabled={loading}>
                ยกเลิก
              </button>
              <button className="btn-primary" onClick={handleSaveAssignment} disabled={loading}>
                {loading ? <Spinner size="sm" /> : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Random Student Modal */}
      {randomStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !isShuffling && setRandomStudent(null)}>
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner transition-colors duration-300 ${isShuffling ? 'bg-slate-100 text-slate-400 animate-pulse' : 'bg-orange-100 text-orange-500'}`}>
              <Users className="w-12 h-12" />
            </div>
            <h3 className="text-sm font-semibold text-slate-500 mb-1">{isShuffling ? 'กำลังสุ่มรายชื่อ...' : 'นักเรียนผู้โชคดี'}</h3>
            <p className={`text-2xl font-bold mb-2 transition-colors duration-300 ${isShuffling ? 'text-slate-400' : 'text-slate-800'}`}>{randomStudent.first_name} {randomStudent.last_name}</p>
            {randomStudent.nickname && (
              <p className={`text-lg font-medium transition-colors duration-300 ${isShuffling ? 'text-slate-300' : 'text-indigo-600'}`}>({randomStudent.nickname})</p>
            )}
            <div className="mt-8">
              <button 
                onClick={() => setRandomStudent(null)} 
                disabled={isShuffling}
                className={`btn-primary w-full text-white transition-colors duration-300 ${isShuffling ? 'bg-slate-300 border-slate-300 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 border-slate-800'}`}>
                {isShuffling ? 'รอสักครู่...' : 'ตกลง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
