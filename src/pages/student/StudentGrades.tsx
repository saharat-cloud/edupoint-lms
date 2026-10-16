import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SectionHeader, PageLoading, Badge } from '../../components/ui/index'

interface GradeRow {
  subject_name: string
  subject_code: string
  semester_name: string
  total_score: number
  grade_letter: string
  grade_point: number
  assignment_count: number
}

export default function StudentGrades() {
  const { user } = useAuth()
  const [grades, setGrades] = useState<GradeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [gpa, setGpa] = useState(0)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user!.id).single()
      if (!student) { setLoading(false); return }

      const { data: subs } = await supabase.from('submissions')
        .select(`academic_score, assignment:assignments(subject:subjects(name,code), semester:semesters(name), academic_full_score)`)
        .eq('student_id', student.id).eq('status', 'GRADED')

      // Group by subject + semester
      const grouped: Record<string, { scores: number[]; full: number[]; subject: Record<string, string>; semester: Record<string, string> }> = {}
      ;(subs || []).forEach((s: Record<string, unknown>) => {
        const asgn = s.assignment as Record<string, unknown> | null
        const subj = asgn?.subject as Record<string, string> | null
        const sem = asgn?.semester as Record<string, string> | null
        if (!subj || !sem) return
        const key = `${subj.code}-${sem.name}`
        if (!grouped[key]) grouped[key] = { scores: [], full: [], subject: subj, semester: sem }
        grouped[key].scores.push(s.academic_score as number || 0)
        grouped[key].full.push(asgn?.academic_full_score as number || 100)
      })

      const rows: GradeRow[] = Object.values(grouped).map(g => {
        const totalScore = g.scores.reduce((s, v) => s + v, 0)
        const totalFull = g.full.reduce((s, v) => s + v, 0)
        const pct = totalFull > 0 ? (totalScore / totalFull) * 100 : 0
        let grade = '0', gp = 0
        if (pct >= 80) { grade = '4'; gp = 4 }
        else if (pct >= 75) { grade = '3.5'; gp = 3.5 }
        else if (pct >= 70) { grade = '3'; gp = 3 }
        else if (pct >= 65) { grade = '2.5'; gp = 2.5 }
        else if (pct >= 60) { grade = '2'; gp = 2 }
        else if (pct >= 55) { grade = '1.5'; gp = 1.5 }
        else if (pct >= 50) { grade = '1'; gp = 1 }
        return {
          subject_name: g.subject.name,
          subject_code: g.subject.code,
          semester_name: g.semester.name,
          total_score: parseFloat(pct.toFixed(1)),
          grade_letter: grade,
          grade_point: gp,
          assignment_count: g.scores.length,
        }
      })

      setGrades(rows)
      if (rows.length > 0) {
        setGpa(parseFloat((rows.reduce((s, r) => s + r.grade_point, 0) / rows.length).toFixed(2)))
      }
      setLoading(false)
    }
    load()
  }, [user])

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <SectionHeader title="เกรดและคะแนน" subtitle="สรุปผลการเรียน" />

      {/* GPA Banner */}
      <div className="card p-5 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">GPA เฉลี่ย</p>
            <p className="text-5xl font-black mt-1">{gpa.toFixed(2)}</p>
          </div>
          <div className="text-right opacity-80">
            <p className="text-sm">{grades.length} วิชา</p>
          </div>
        </div>
      </div>

      {grades.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">ยังไม่มีเกรด</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>วิชา</th><th>ภาคเรียน</th><th>% คะแนน</th><th>งาน</th><th className="text-center">เกรด</th><th className="text-center">GP</th></tr></thead>
            <tbody>
              {grades.map((g, i) => (
                <tr key={i}>
                  <td>
                    <p className="font-medium">{g.subject_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{g.subject_code}</p>
                  </td>
                  <td className="text-sm text-slate-600">{g.semester_name}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${g.total_score}%` }} />
                      </div>
                      <span className="text-sm font-medium">{g.total_score}%</span>
                    </div>
                  </td>
                  <td className="text-sm text-slate-600">{g.assignment_count} ชิ้น</td>
                  <td className="text-center">
                    <Badge variant={g.grade_point >= 3.5 ? 'green' : g.grade_point >= 2.5 ? 'blue' : g.grade_point >= 1.5 ? 'yellow' : g.grade_point === 0 ? 'red' : 'gray'}>
                      {g.grade_letter}
                    </Badge>
                  </td>
                  <td className="text-center font-bold text-lg text-slate-800">{g.grade_point}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
