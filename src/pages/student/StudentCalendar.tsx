import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SectionHeader, PageLoading, Badge, formatDate } from '../../components/ui/index'

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: 'ASSIGNMENT' | 'ACTIVITY' | 'GAME'
  status?: string
}

export default function StudentCalendar() {
  const { user } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user!.id).single()
      if (!student) { setLoading(false); return }

      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString()
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString()

      const { data: targets } = await supabase.from('assignment_targets')
        .select('assignment:assignments(id,title,due_at,status)')
        .eq('student_id', student.id)
        .gte('assignment.due_at', startOfMonth)
        .lte('assignment.due_at', endOfMonth)

      const evts: CalendarEvent[] = []
      ;(targets || []).forEach((t: Record<string, unknown>) => {
        const a = t.assignment as Record<string, unknown> | null
        if (a?.due_at) {
          evts.push({ id: a.id as string, title: a.title as string, date: a.due_at as string, type: 'ASSIGNMENT', status: a.status as string })
        }
      })
      setEvents(evts)
      setLoading(false)
    }
    load()
  }, [user, currentMonth])

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const monthName = currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  function getEventsForDay(day: number) {
    return events.filter(e => {
      const d = new Date(e.date)
      return d.getDate() === day && d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear()
    })
  }

  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <SectionHeader title="ปฏิทิน" subtitle="กำหนดส่งงานและกิจกรรม" />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 card p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="btn-icon btn-ghost">◀</button>
            <h3 className="font-bold text-slate-800">{monthName}</h3>
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="btn-icon btn-ghost">▶</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayEvents = getEventsForDay(day)
              const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth.getMonth() && new Date().getFullYear() === currentMonth.getFullYear()
              return (
                <div key={day} className={`min-h-[52px] p-1 rounded-xl border ${isToday ? 'border-primary-400 bg-primary-50' : 'border-transparent hover:bg-slate-50'} transition-colors`}>
                  <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary-700' : 'text-slate-700'}`}>{day}</p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className="text-xs bg-amber-400 text-white px-1 rounded truncate" title={e.title}>
                        {e.title.slice(0, 8)}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-xs text-slate-400">+{dayEvents.length - 2}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-4">กำหนดส่งที่กำลังมา</h3>
          {upcomingEvents.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">ไม่มีงานที่กำลังจะถึง</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.slice(0, 8).map(e => {
                const due = new Date(e.date)
                const today = new Date()
                const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000)
                return (
                  <div key={e.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${daysLeft <= 1 ? 'bg-red-500' : daysLeft <= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{e.title}</p>
                      <p className={`text-xs mt-0.5 ${daysLeft <= 1 ? 'text-red-500 font-semibold' : daysLeft <= 3 ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                        {daysLeft === 0 ? 'วันนี้!' : daysLeft === 1 ? 'พรุ่งนี้!' : `อีก ${daysLeft} วัน`}
                      </p>
                      <p className="text-xs text-slate-400">{formatDate(e.date)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
