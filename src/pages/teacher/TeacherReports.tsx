import React, { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SectionHeader, PageLoading, formatDate } from '../../components/ui/index'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function TeacherReports() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'assignments' | 'points' | 'games'>('assignments')
  const [assignmentStats, setAssignmentStats] = useState<Array<{ title: string; submitted: number; graded: number; total: number }>>([])
  const [pointHistory, setPointHistory] = useState<Array<{ date: string; total: number }>>([])
  const [gameStats, setGameStats] = useState<Array<{ title: string; attempts: number; passed: number }>>([])

  useEffect(() => {
    if (!user) return
    async function load() {
      // Assignment stats
      const { data: assignments } = await supabase.from('assignments')
        .select('id, title').eq('teacher_id', user!.id).eq('status', 'PUBLISHED')
      if (assignments?.length) {
        const stats = await Promise.all(assignments.map(async a => {
          const [totalRes, submittedRes, gradedRes] = await Promise.all([
            supabase.from('assignment_targets').select('id', { count: 'exact', head: true }).eq('assignment_id', a.id),
            supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('assignment_id', a.id).neq('status', 'DRAFT'),
            supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('assignment_id', a.id).eq('status', 'GRADED'),
          ])
          return { title: a.title.slice(0, 20), submitted: submittedRes.count || 0, graded: gradedRes.count || 0, total: totalRes.count || 0 }
        }))
        setAssignmentStats(stats)
      }

      // Point history (by day, last 14 days)
      const { data: pts } = await supabase.from('point_transactions')
        .select('points, created_at')
        .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
        .order('created_at')
      if (pts) {
        const byDay: Record<string, number> = {}
        pts.forEach((p: Record<string, unknown>) => {
          const day = new Date(p.created_at as string).toLocaleDateString('th-TH')
          byDay[day] = (byDay[day] || 0) + (p.points as number)
        })
        setPointHistory(Object.entries(byDay).map(([date, total]) => ({ date, total })))
      }

      // Game stats
      const { data: myGames } = await supabase.from('games').select('id, title').eq('created_by', user!.id)
      if (myGames?.length) {
        const gStats = await Promise.all(myGames.map(async g => {
          const [attRes, passRes] = await Promise.all([
            supabase.from('game_attempts').select('id', { count: 'exact', head: true }).eq('game_id', g.id),
            supabase.from('game_attempts').select('id', { count: 'exact', head: true }).eq('game_id', g.id).eq('passed', true),
          ])
          return { title: g.title.slice(0, 20), attempts: attRes.count || 0, passed: passRes.count || 0 }
        }))
        setGameStats(gStats)
      }
      setLoading(false)
    }
    load()
  }, [user])

  function exportPointsCSV() {
    const csv = ['วันที่,Point รวม', ...pointHistory.map(p => `"${p.date}",${p.total}`)].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'point_report.csv'; a.click()
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <SectionHeader title="รายงาน" subtitle="สรุปข้อมูลการสอนและนักเรียน" />

      <div className="flex gap-2 border-b border-slate-200">
        {[{ id: 'assignments', label: '📋 งาน' }, { id: 'points', label: '⭐ Point' }, { id: 'games', label: '🎮 เกม' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'assignments' && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-4">สถานะการส่งงาน</h3>
          {assignmentStats.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">ยังไม่มีข้อมูล</p> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={assignmentStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="title" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" name="ทั้งหมด" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="submitted" name="ส่งแล้ว" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="graded" name="ตรวจแล้ว" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {activeTab === 'points' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Point รายวัน (14 วันล่าสุด)</h3>
            <button onClick={exportPointsCSV} className="btn-secondary btn-sm"><Download className="w-4 h-4" /> Export</button>
          </div>
          {pointHistory.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">ยังไม่มีข้อมูล</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={pointHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" name="Point" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {activeTab === 'games' && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-4">ผลการเล่นเกม</h3>
          {gameStats.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">ยังไม่มีข้อมูล</p> : (
            <div className="space-y-3">
              {gameStats.map(g => (
                <div key={g.title} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{g.title}</p>
                    <p className="text-xs text-slate-500">{g.attempts} ครั้งที่เล่น • ผ่าน {g.passed} ครั้ง</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">{g.attempts > 0 ? Math.round(g.passed / g.attempts * 100) : 0}%</p>
                    <p className="text-xs text-slate-500">อัตราผ่าน</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
