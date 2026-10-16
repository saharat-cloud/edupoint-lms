import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Subject, Semester, ClassRoom, GroupMission, IndividualAssignment } from '../../lib/types'

interface StudentRow {
  id: string
  student_code: string
  first_name: string
  last_name: string
  nickname: string
  groupPoints: Record<string, number>
  assignmentScores: Record<string, number | null>
}

function formatSemesterName(name?: string) {
  if (!name) return ''
  const match = name.match(/^(\d{4})\s*(ภาคเรียนที่\s*\d+)$/)
  if (match) {
    return `${match[2]} ปีการศึกษา ${match[1]}`
  }
  return name
}

export default function TeacherGradebookPrint() {
  const [searchParams] = useSearchParams()
  const subject_id = searchParams.get('subject_id')
  const semester_id = searchParams.get('semester_id')
  const class_room_id = searchParams.get('class_room_id')

  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [missions, setMissions] = useState<GroupMission[]>([])
  const [assignments, setAssignments] = useState<IndividualAssignment[]>([])
  const [subject, setSubject] = useState<Subject | null>(null)
  const [semester, setSemester] = useState<Semester | null>(null)
  const [classRoom, setClassRoom] = useState<ClassRoom | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!subject_id || !semester_id || !class_room_id) return

      // Load Metadata
      const [subRes, semRes, roomRes] = await Promise.all([
        supabase.from('subjects').select('*').eq('id', subject_id).single(),
        supabase.from('semesters').select('*').eq('id', semester_id).single(),
        supabase.from('class_rooms').select('*').eq('id', class_room_id).single(),
      ])
      if (subRes.data) setSubject(subRes.data)
      if (semRes.data) setSemester(semRes.data)
      if (roomRes.data) setClassRoom(roomRes.data)

      // Load Students
      const { data: stData } = await supabase.from('students')
        .select('*')
        .eq('class_room_id', class_room_id)
        .order('student_code')
      
      const stRows: StudentRow[] = (stData || []).map(s => ({
        id: s.id, student_code: s.student_code, first_name: s.first_name,
        last_name: s.last_name, nickname: s.nickname || '',
        groupPoints: {}, assignmentScores: {}
      }))

      if (stRows.length > 0) {
        // Load Missions
        const { data: groups } = await supabase.from('student_groups')
          .select('id, name, topic, mission_points, members:student_group_members(student_id)')
          .not('topic', 'is', null)
          .eq('room_id', class_room_id)
        
        const validGroups = (groups || []).filter(g => g.mission_points > 0)
        
        const mList: GroupMission[] = []
        validGroups.forEach(g => {
          let m = mList.find(x => x.topic === g.topic)
          if (!m) { m = { topic: g.topic, mission_points: g.mission_points, groups: [] }; mList.push(m) }
          m.groups.push(g)
        })
        setMissions(mList)

        // Map Mission Points
        const groupMap = new Map()
        validGroups.forEach(g => g.members.forEach((mem: any) => groupMap.set(mem.student_id, g.topic)))
        const { data: txData } = await supabase.from('point_transactions')
          .select('source_id, points')
          .in('source_id', validGroups.map(g => g.id))
          .ilike('note', 'Mission Complete%')

        const completedGroupIds = new Set(txData?.map(tx => tx.source_id) || [])
        stRows.forEach(s => {
          validGroups.forEach(g => {
            if (completedGroupIds.has(g.id) && g.members.some((mem: any) => mem.student_id === s.id)) {
              s.groupPoints[g.topic] = (s.groupPoints[g.topic] || 0) + g.mission_points
            }
          })
        })

        // Load Assignments
        const { data: aData } = await supabase.from('assignments')
          .select('*')
          .eq('subject_id', subject_id)
          .eq('semester_id', semester_id)
          .order('created_at')

        const filteredAsgs = (aData || []).filter(a => {
          if (a.description?.startsWith('QUICK_ROOM:')) {
            return a.description === `QUICK_ROOM:${class_room_id}`
          }
          return true
        })
        setAssignments(filteredAsgs)

        // Load Assignment Scores
        if (filteredAsgs.length > 0) {
          const { data: subms } = await supabase.from('submissions')
            .select('student_id, assignment_id, academic_score')
            .in('assignment_id', filteredAsgs.map(a => a.id))
            .in('student_id', stRows.map(s => s.id))
          
          subms?.forEach(sub => {
            const row = stRows.find(x => x.id === sub.student_id)
            if (row) row.assignmentScores[sub.assignment_id] = sub.academic_score
          })
        }
      }

      setStudents(stRows)
      setLoading(false)

      setTimeout(() => {
        window.print()
      }, 1000)
    }
    loadData()
  }, [subject_id, semester_id, class_room_id])

  if (loading) return <div className="p-8 text-center text-slate-500">กำลังเตรียมข้อมูลพิมพ์...</div>

  const totalMaxPoints = missions.reduce((s, m) => s + m.mission_points, 0) + assignments.reduce((s, a) => s + (a.point_target > 0 ? a.point_target : a.academic_full_score), 0)

  return (
    <div className="bg-white text-black p-8 max-w-full">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">รายงานคะแนนเก็บ</h1>
        <h2 className="text-lg font-semibold">{subject?.name} ({subject?.code})</h2>
        <p className="text-sm mt-1">{formatSemesterName(semester?.name)} | ห้องเรียน {classRoom?.name}</p>
      </div>

      <table className="w-full text-sm border-collapse border border-slate-300">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 p-2 w-12 text-center" rowSpan={2}>ที่</th>
            <th className="border border-slate-300 p-2 w-28 text-center" rowSpan={2}>รหัสประจำตัว</th>
            <th className="border border-slate-300 p-2 text-left" rowSpan={2}>ชื่อ-สกุล</th>
            
            {assignments.length > 0 && (
              <th className="border border-slate-300 p-2 text-center" colSpan={assignments.length}>งานเดี่ยว</th>
            )}
            {missions.length > 0 && (
              <th className="border border-slate-300 p-2 text-center bg-emerald-50" colSpan={missions.length}>งานกลุ่ม</th>
            )}
            
            <th className="border border-slate-300 p-2 text-center w-20" rowSpan={2}>
              <div className="font-bold">รวม</div>
              <div className="text-[10px] text-slate-500 font-normal">/{totalMaxPoints}</div>
            </th>
          </tr>
          <tr className="bg-slate-50">
            {assignments.map(a => (
              <th key={a.id} className="border border-slate-300 p-1 px-2 text-center align-bottom w-20">
                <div className="text-xs truncate max-w-full mx-auto" title={a.title}>{a.title}</div>
                <div className="text-[10px] text-indigo-500">/{a.academic_full_score}</div>
                {a.point_target > 0 && <div className="text-[9px] text-orange-500">{a.point_target}pt</div>}
              </th>
            ))}
            {missions.map(m => (
              <th key={m.topic} className="border border-slate-300 p-1 px-2 text-center align-bottom w-20 bg-emerald-50/50">
                <div className="text-xs truncate max-w-full mx-auto" title={m.topic}>{m.topic}</div>
                <div className="text-[10px] text-emerald-600">/{m.mission_points}pt</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s, idx) => {
            const total = missions.reduce((sum, m) => sum + (s.groupPoints[m.topic] ?? 0), 0) + 
                          assignments.reduce((sum, a) => sum + (s.assignmentScores[a.id] ?? 0), 0)
            return (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-300 p-2 text-center">{s.student_code}</td>
                <td className="border border-slate-300 p-2">{s.first_name} {s.last_name}</td>
                
                {assignments.map(a => (
                  <td key={a.id} className="border border-slate-300 p-2 text-center font-medium">
                    {s.assignmentScores[a.id] !== undefined && s.assignmentScores[a.id] !== null ? s.assignmentScores[a.id] : '-'}
                  </td>
                ))}

                {missions.map(m => (
                  <td key={m.topic} className="border border-slate-300 p-2 text-center text-emerald-600 font-medium bg-emerald-50/20">
                    {s.groupPoints[m.topic] !== undefined ? s.groupPoints[m.topic] : '-'}
                  </td>
                ))}

                <td className="border border-slate-300 p-2 text-center font-bold">{total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: white !important;
            margin: 0;
            padding: 0;
          }
          @page {
            size: landscape;
            margin: 1cm;
          }
        }
      `}} />
    </div>
  )
}
