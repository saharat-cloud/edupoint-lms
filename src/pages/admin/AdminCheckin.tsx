import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Clock, Users, XCircle, ChevronDown, ChevronUp, Loader2, Copy, Edit2, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateTime, confirmAction } from '../../components/ui/index'

interface ClassRoom { id: string; name: string }
interface CheckinSession {
  id: string
  title: string
  class_room_id: string | null
  class_rooms?: { name: string }
  start_time: string
  end_time: string | null
  golden_minutes?: number
  golden_bonus?: number
  base_points: number
  decay_per_interval: number
  decay_interval_minutes: number
  min_points: number
  status: 'OPEN' | 'CLOSED'
  created_at: string
}
interface CheckinRecord {
  id: string
  student_id: string
  checked_in_at: string
  rank: number
  points_awarded: number
  students?: { first_name: string; last_name: string; student_code: string }
}

const defaultForm = {
  title: 'เช็คชื่อ',
  class_room_id: '', // empty means all classrooms / everyone
  start_time: '',
  end_time: '',
  golden_minutes: 5,
  golden_bonus: 5,
  base_points: 10,
  decay_per_interval: 1,
  decay_interval_minutes: 5,
  min_points: 1,
}

export default function AdminCheckin() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<CheckinSession[]>([])
  const [rooms, setRooms] = useState<ClassRoom[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...defaultForm })
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [recordsMap, setRecordsMap] = useState<Record<string, CheckinRecord[]>>({})
  const [loadingRecords, setLoadingRecords] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('checkin_sessions')
      .select('*, class_rooms(name)')
      .order('created_at', { ascending: false })
    setSessions((data || []) as CheckinSession[])
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: roomData } = await supabase.from('class_rooms').select('id,name').order('name')
      setRooms(roomData || [])
      const now = new Date()
      now.setSeconds(0, 0)
      setForm(f => ({ ...f, start_time: now.toISOString().slice(0, 16) }))
      await loadSessions()
    }
    init()
  }, [loadSessions])

  async function loadRecords(sessionId: string) {
    if (recordsMap[sessionId]) { setExpandedId(sessionId); return }
    setLoadingRecords(sessionId)
    const { data } = await supabase
      .from('checkin_records')
      .select('*, students(first_name,last_name,student_code)')
      .eq('session_id', sessionId)
      .order('rank')
    setRecordsMap(m => ({ ...m, [sessionId]: (data || []) as CheckinRecord[] }))
    setExpandedId(sessionId)
    setLoadingRecords(null)
  }

  function handleOpenCreate() {
    setEditingId(null)
    const now = new Date()
    now.setSeconds(0, 0)
    setForm({ ...defaultForm, start_time: now.toISOString().slice(0, 16) })
    setShowForm(true)
  }

  function handleEdit(s: CheckinSession) {
    setEditingId(s.id)
    setForm({
      title: s.title,
      class_room_id: s.class_room_id || '',
      start_time: s.start_time ? new Date(s.start_time).toISOString().slice(0, 16) : '',
      end_time: s.end_time ? new Date(s.end_time).toISOString().slice(0, 16) : '',
      golden_minutes: s.golden_minutes ?? 5,
      golden_bonus: s.golden_bonus ?? 5,
      base_points: s.base_points,
      decay_per_interval: s.decay_per_interval,
      decay_interval_minutes: s.decay_interval_minutes,
      min_points: s.min_points,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleDuplicate(s: CheckinSession) {
    setEditingId(null)
    const now = new Date()
    now.setSeconds(0, 0)
    setForm({
      title: s.title,
      class_room_id: s.class_room_id || '',
      start_time: now.toISOString().slice(0, 16),
      end_time: '',
      golden_minutes: s.golden_minutes ?? 5,
      golden_bonus: s.golden_bonus ?? 5,
      base_points: s.base_points,
      decay_per_interval: s.decay_per_interval,
      decay_interval_minutes: s.decay_interval_minutes,
      min_points: s.min_points,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    if (!form.start_time) return alert('กรุณาระบุเวลาเริ่ม')
    setSaving(true)
    const payload = {
      title: form.title,
      class_room_id: form.class_room_id ? form.class_room_id : null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      golden_minutes: Number(form.golden_minutes) || 0,
      golden_bonus: Number(form.golden_bonus) || 0,
      base_points: Number(form.base_points),
      decay_per_interval: Number(form.decay_per_interval),
      decay_interval_minutes: Number(form.decay_interval_minutes),
      min_points: Number(form.min_points),
    }

    if (editingId) {
      const { error } = await supabase.from('checkin_sessions').update(payload).eq('id', editingId)
      setSaving(false)
      if (error) { alert('เกิดข้อผิดพลาดในการแก้ไข: ' + error.message); return }
    } else {
      const { error } = await supabase.from('checkin_sessions').insert({
        ...payload,
        created_by: user?.id,
      })
      setSaving(false)
      if (error) { alert('เกิดข้อผิดพลาดในการสร้าง: ' + error.message); return }
    }

    setShowForm(false)
    setEditingId(null)
    await loadSessions()
  }

  async function handleClose(id: string) {
    const ok = await confirmAction('ปิด Session', 'ต้องการปิด session เช็คอินนี้หรือไม่?', 'ปิด')
    if (!ok) return
    await supabase.from('checkin_sessions').update({ status: 'CLOSED' }).eq('id', id)
    setSessions(s => s.map(x => x.id === id ? { ...x, status: 'CLOSED' } : x))
  }

  async function handleDelete(id: string) {
    const ok = await confirmAction('ลบ Session', 'ต้องการลบ session นี้? ข้อมูลเช็คอินทั้งหมดจะหายไป', 'ลบ')
    if (!ok) return
    await supabase.from('checkin_sessions').delete().eq('id', id)
    setSessions(s => s.filter(x => x.id !== id))
  }

  function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    loadRecords(id)
  }

  const rankIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ระบบเช็คอิน</h1>
          <p className="text-sm text-slate-500 mt-0.5">จัดการ session เช็คชื่อ โบนัสเวลาทอง และคะแนนการมาเรียน</p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4" />
          สร้าง Session
        </button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="card p-5 space-y-4 border-primary-200 bg-primary-50/30">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">
              {editingId ? 'แก้ไข Session เช็คอิน' : 'สร้าง Session เช็คอินใหม่'}
            </h2>
            <button className="text-slate-400 hover:text-slate-600 text-sm" onClick={() => setShowForm(false)}>✕</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="form-label">ชื่อ Session</label>
              <input className="form-input" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="เช่น เช็คชื่อคาบเช้า" />
            </div>

            {/* Classroom */}
            <div>
              <label className="form-label">ห้องเรียนที่อนุญาต</label>
              <select className="form-select" value={form.class_room_id}
                onChange={e => setForm(f => ({ ...f, class_room_id: e.target.value }))}>
                <option value="">🌐 ทุกคนเช็คอินได้ (ไม่จำกัดห้อง)</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            {/* Start Time */}
            <div>
              <label className="form-label">เวลาเริ่ม</label>
              <input type="datetime-local" className="form-input" value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>

            {/* Golden Time Section */}
            <div className="sm:col-span-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>กำหนดเวลาทอง (Golden Time Bonus)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">ช่วงเวลาทอง (นาทีแรกหลังจากเริ่ม)</label>
                  <input type="number" min={0} className="form-input text-sm" value={form.golden_minutes}
                    onChange={e => setForm(f => ({ ...f, golden_minutes: +e.target.value }))} placeholder="เช่น 5 นาทีแรก" />
                </div>
                <div>
                  <label className="form-label text-xs">โบนัสคะแนนพิเศษเวลาทอง (+pt)</label>
                  <input type="number" min={0} className="form-input text-sm" value={form.golden_bonus}
                    onChange={e => setForm(f => ({ ...f, golden_bonus: +e.target.value }))} placeholder="เช่น +5 คะแนน" />
                </div>
              </div>
            </div>

            {/* Base Points */}
            <div>
              <label className="form-label">คะแนนปกติ (เมื่อเช็คอินทัน)</label>
              <input type="number" min={1} className="form-input" value={form.base_points}
                onChange={e => setForm(f => ({ ...f, base_points: +e.target.value }))} />
            </div>

            {/* End Time */}
            <div>
              <label className="form-label">เวลาสิ้นสุดการเช็คอิน <span className="text-slate-400 font-normal">(เว้นว่างถ้าไม่จำกัด)</span></label>
              <input type="datetime-local" className="form-input" value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>

            {/* Decay */}
            <div>
              <label className="form-label">มาช้าลดลงทุก (นาที)</label>
              <input type="number" min={1} className="form-input" value={form.decay_interval_minutes}
                onChange={e => setForm(f => ({ ...f, decay_interval_minutes: +e.target.value }))} />
            </div>
            <div>
              <label className="form-label">ลดลงทีละ (คะแนน)</label>
              <input type="number" min={0} className="form-input" value={form.decay_per_interval}
                onChange={e => setForm(f => ({ ...f, decay_per_interval: +e.target.value }))} />
            </div>

            {/* Min Points */}
            <div>
              <label className="form-label">คะแนนขั้นต่ำสุดที่ยังได้</label>
              <input type="number" min={0} className="form-input" value={form.min_points}
                onChange={e => setForm(f => ({ ...f, min_points: +e.target.value }))} />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl p-3 border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-700">📌 สรุปเงื่อนไขคะแนน:</p>
            <p>• <strong>ช่วงเวลาทอง ({form.golden_minutes} นาทีแรก):</strong> ได้รับ <span className="text-amber-600 font-bold">{form.base_points + form.golden_bonus} pt</span> ({form.base_points} + {form.golden_bonus} โบนัส)</p>
            <p>• <strong>เวลาปกติ (หลังพ้นเวลาทอง):</strong> เริ่มต้นที่ <strong>{form.base_points} pt</strong> และจะลด {form.decay_per_interval} pt ทุกๆ {form.decay_interval_minutes} นาที</p>
            <p>• <strong>คะแนนต่ำสุดที่ได้รับ:</strong> {form.min_points} pt</p>
          </div>

          <div className="flex gap-2 justify-end">
            <button className="btn-secondary text-sm" onClick={() => setShowForm(false)}>ยกเลิก</button>
            <button className="btn-primary text-sm flex items-center gap-1.5" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingId ? 'บันทึกการแก้ไข' : 'สร้าง Session'}
            </button>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : sessions.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>ยังไม่มี Session เช็คอิน</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const records = recordsMap[s.id] || []
            const isExpanded = expandedId === s.id
            const roomName = (s.class_rooms as { name: string } | undefined)?.name
            return (
              <div key={s.id} className="card overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.status === 'OPEN' ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{s.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {s.status === 'OPEN' ? 'เปิดอยู่' : 'ปิดแล้ว'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-medium">
                        {roomName ? `ห้อง ${roomName}` : '🌐 ทุกคนเช็คอินได้'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      เริ่ม {formatDateTime(s.start_time)}
                      {s.end_time ? ` · สิ้นสุด ${formatDateTime(s.end_time)}` : ' · ไม่จำกัดเวลาสิ้นสุด'}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                        ⭐ เวลาทอง {s.golden_minutes ?? 5} นาทีแรก (+{s.golden_bonus ?? 5} pt)
                      </span>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        คะแนนปกติ {s.base_points} pt
                      </span>
                      <span className="text-slate-500 px-1 py-0.5">
                        ลด {s.decay_per_interval}pt/{s.decay_interval_minutes}นาที · ต่ำสุด {s.min_points}pt
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      className="btn-icon btn-ghost text-slate-600 hover:text-primary-600"
                      title="แก้ไข Session"
                      onClick={() => handleEdit(s)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      className="btn-icon btn-ghost text-primary-500"
                      title="ใช้ซ้ำ — copy settings มาสร้างใหม่"
                      onClick={() => handleDuplicate(s)}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {s.status === 'OPEN' && (
                      <button className="btn-icon btn-ghost text-amber-500" title="ปิด Session" onClick={() => handleClose(s.id)}>
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button className="btn-icon btn-ghost text-red-400" title="ลบ" onClick={() => handleDelete(s.id)}>
                      <span className="text-xs">🗑</span>
                    </button>
                    <button
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 px-2 py-1 rounded-lg hover:bg-primary-50"
                      onClick={() => toggleExpand(s.id)}
                    >
                      <Users className="w-3.5 h-3.5" />
                      {loadingRecords === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                    </button>
                  </div>
                </div>

                {/* Records list */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50">
                    {records.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-5">ยังไม่มีนักเรียนเช็คอิน</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                            <th className="px-4 py-2 w-10">อันดับ</th>
                            <th className="px-4 py-2">นักเรียน</th>
                            <th className="px-4 py-2">รหัส</th>
                            <th className="px-4 py-2">เวลา</th>
                            <th className="px-4 py-2 text-right">คะแนน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map(r => (
                            <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-white">
                              <td className="px-4 py-2 text-center text-base">{rankIcon(r.rank)}</td>
                              <td className="px-4 py-2 font-medium text-slate-700">
                                {(r.students as { first_name: string; last_name: string } | undefined)
                                  ? `${r.students!.first_name} ${r.students!.last_name}` : '—'}
                              </td>
                              <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                                {(r.students as { student_code: string } | undefined)?.student_code || '—'}
                              </td>
                              <td className="px-4 py-2 text-slate-500 text-xs">{formatDateTime(r.checked_in_at)}</td>
                              <td className="px-4 py-2 text-right">
                                <span className="font-bold text-primary-600">+{r.points_awarded}</span>
                                <span className="text-xs text-slate-400 ml-1">pt</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
