import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { PointTransaction } from '../../lib/types'
import { SectionHeader, PageLoading, formatDateTime, formatRelativeTime } from '../../components/ui/index'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function StudentPoints() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<PointTransaction[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [chartData, setChartData] = useState<Array<{ date: string; cumulative: number }>>([])
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user!.id).single()
      if (!student) { setLoading(false); return }
      setStudentId(student.id)

      const { data: pts } = await supabase.from('student_total_points').select('total_points').eq('student_id', student.id).single()
      setTotalPoints(pts?.total_points || 0)

      const { data: txns } = await supabase.from('point_transactions')
        .select('*').eq('student_id', student.id).order('created_at', { ascending: false })
      setTransactions((txns || []) as PointTransaction[])

      // Build cumulative chart
      const byDay: Record<string, number> = {}
      ;(txns || []).reverse().forEach((t: PointTransaction) => {
        const day = new Date(t.created_at).toLocaleDateString('th-TH')
        byDay[day] = (byDay[day] || 0) + t.points
      })
      let cum = 0
      const chart = Object.entries(byDay).map(([date, pts]) => { cum += pts; return { date, cumulative: cum } })
      setChartData(chart)
      setLoading(false)
    }
    load()
  }, [user])

  const sourceTypeLabel: Record<string, string> = {
    KIOSK: '🏫 Kiosk',
    ASSIGNMENT: '📝 งาน',
    GAME: '🎮 เกม',
    MANUAL: '✋ ครู',
    PURCHASE: '🛒 ใช้แต้ม',
  }

  const filtered = transactions.filter(t => filter === 'ALL' || t.source_type === filter)

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <SectionHeader title="Point ของฉัน" subtitle="ประวัติการได้รับและใช้ Point" />

      {/* Total Points Banner */}
      <div className="card p-6 bg-gradient-to-br from-amber-400 to-orange-500 text-white">
        <p className="text-sm opacity-80">Point สะสมทั้งหมด</p>
        <p className="text-5xl font-black mt-1">{totalPoints.toLocaleString()}</p>
        <p className="text-sm opacity-80 mt-1">⭐ Points</p>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-4">กราฟสะสม Point</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="cumulative" name="Point" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'KIOSK', 'ASSIGNMENT', 'GAME', 'MANUAL', 'PURCHASE'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {f === 'ALL' ? 'ทั้งหมด' : sourceTypeLabel[f] || f}
          </button>
        ))}
      </div>

      {/* Transactions */}
      <div className="card divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">ไม่มีรายการ</div>
        ) : filtered.map(t => (
          <div key={t.id} className="flex items-center gap-4 p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${t.points > 0 ? 'bg-amber-100' : 'bg-red-100'}`}>
              {t.source_type === 'GAME' ? '🎮' : t.source_type === 'ASSIGNMENT' ? '📝' : t.source_type === 'KIOSK' ? '🏫' : t.source_type === 'PURCHASE' ? '🛒' : '⭐'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-slate-800">{sourceTypeLabel[t.source_type] || t.source_type}</p>
              {t.note && <p className="text-xs text-slate-500 truncate">{t.note}</p>}
              <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(t.created_at)}</p>
            </div>
            <span className={`text-base font-bold flex-shrink-0 ${t.points > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {t.points > 0 ? '+' : ''}{t.points.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
