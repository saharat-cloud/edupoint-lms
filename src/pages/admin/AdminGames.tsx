import React, { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Eye, Play } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Game, GameQuestion } from '../../lib/types'
import { SectionHeader, PageLoading, EmptyState, Modal, confirmDelete, showSuccess, showError, Spinner, Badge } from '../../components/ui/index'

const GAME_CATEGORIES = ['ระบบเครือข่าย', 'IP Address', 'การเขียนโปรแกรม', 'ฐานข้อมูล', 'ความปลอดภัย', 'ทั่วไป']

const GameTypeBadge = ({ type }: { type: string }) => {
  switch(type) {
    case 'SHOOTER': return <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">🚀 ยิงยาน</span>
    case 'RUNNER': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">🏃 วิ่งเก็บเหรียญ</span>
    case 'MATCHING': return <span className="bg-fuchsia-100 text-fuchsia-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">🃏 จับคู่</span>
    default: return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">📝 ควิซ</span>
  }
}

export default function AdminGames() {
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [showGameModal, setShowGameModal] = useState(false)
  const [showQModal, setShowQModal] = useState(false)
  const [editGame, setEditGame] = useState<Game | null>(null)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [questions, setQuestions] = useState<GameQuestion[]>([])
  const [saving, setSaving] = useState(false)

  const [gameForm, setGameForm] = useState({
    title: '', description: '', category: 'ทั่วไป', game_type: 'QUIZ' as Game['game_type'],
    max_score: 100, pass_score: 60, point_reward: 50,
    max_attempts: 3, cooldown_seconds: 3600, status: 'DRAFT' as Game['status'],
  })

  const [qForm, setQForm] = useState({
    question: '', options: ['', '', '', ''], correct_answer: '', explanation: '', points: 10, sort_order: 0,
  })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('games').select('*').order('created_at', { ascending: false })
    if (data) setGames(data as Game[])
    setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])

  function openAddGame() { setEditGame(null); setGameForm({ title: '', description: '', category: 'ทั่วไป', game_type: 'QUIZ', max_score: 100, pass_score: 60, point_reward: 50, max_attempts: 3, cooldown_seconds: 3600, status: 'DRAFT' }); setShowGameModal(true) }
  function openEditGame(g: Game) { setEditGame(g); setGameForm({ title: g.title, description: g.description || '', category: g.category || 'ทั่วไป', game_type: g.game_type || 'QUIZ', max_score: g.max_score, pass_score: g.pass_score, point_reward: g.point_reward, max_attempts: g.max_attempts, cooldown_seconds: g.cooldown_seconds, status: g.status }); setShowGameModal(true) }

  async function saveGame() {
    if (!gameForm.title) { await showError('กรุณากรอกชื่อเกม'); return }
    setSaving(true)
    try {
      if (editGame) {
        const { error } = await supabase.from('games').update({ ...gameForm, updated_at: new Date().toISOString() }).eq('id', editGame.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('games').insert({ ...gameForm, created_by: user!.id })
        if (error) throw error
      }
      setShowGameModal(false)
      load()
    } catch (err: unknown) { await showError('เกิดข้อผิดพลาด', err instanceof Error ? err.message : '') }
    finally { setSaving(false) }
  }

  async function openQuestions(g: Game) {
    setSelectedGame(g)
    const { data } = await supabase.from('game_questions').select('*').eq('game_id', g.id).order('sort_order')
    setQuestions((data || []) as GameQuestion[])
    setQForm({ question: '', options: ['', '', '', ''], correct_answer: '', explanation: '', points: 10, sort_order: (data?.length || 0) })
    setShowQModal(true)
  }

  async function addQuestion() {
    if (!qForm.question || !qForm.correct_answer || !selectedGame) { await showError('กรุณากรอกคำถามและคำตอบที่ถูกต้อง'); return }
    const { error } = await supabase.from('game_questions').insert({ ...qForm, game_id: selectedGame.id, options: qForm.options.filter(o => o.trim()) })
    if (error) { await showError('เกิดข้อผิดพลาด', error.message); return }
    const { data } = await supabase.from('game_questions').select('*').eq('game_id', selectedGame.id).order('sort_order')
    setQuestions((data || []) as GameQuestion[])
    setQForm({ question: '', options: ['', '', '', ''], correct_answer: '', explanation: '', points: 10, sort_order: (data?.length || 0) })
  }

  async function deleteQuestion(id: string) {
    const ok = await confirmDelete('ลบคำถามนี้?')
    if (!ok || !selectedGame) return
    await supabase.from('game_questions').delete().eq('id', id)
    const { data } = await supabase.from('game_questions').select('*').eq('game_id', selectedGame.id).order('sort_order')
    setQuestions((data || []) as GameQuestion[])
  }

  async function publishGame(id: string) {
    await supabase.from('games').update({ status: 'PUBLISHED' }).eq('id', id)
    await showSuccess('เผยแพร่เกมแล้ว')
    load()
  }

  async function deleteGame(id: string) {
    if (!await confirmDelete('ยืนยันการลบเกมนี้ใช่หรือไม่? การลบนี้จะลบคำถามและประวัติการเล่นทั้งหมดของเกมนี้ด้วย')) return
    const { error } = await supabase.from('games').delete().eq('id', id)
    if (error) await showError(error.message)
    else { await showSuccess('ลบเกมเรียบร้อยแล้ว'); load() }
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <SectionHeader title="จัดการเกม" subtitle={`${games.length} เกม`} actions={<button onClick={openAddGame} className="btn-primary"><Plus className="w-4 h-4" /> สร้างเกม</button>} />

      {games.length === 0 ? (
        <div className="card p-8"><EmptyState icon={<span className="text-3xl">🎮</span>} title="ยังไม่มีเกม" action={<button onClick={openAddGame} className="btn-primary"><Plus className="w-4 h-4" /> สร้างเกม</button>} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {games.map(g => (
            <div key={g.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant={g.status === 'PUBLISHED' ? 'green' : g.status === 'DRAFT' ? 'gray' : 'red'}>{g.status === 'PUBLISHED' ? 'เผยแพร่' : g.status === 'DRAFT' ? 'ร่าง' : 'เก็บถาวร'}</Badge>
                  <h3 className="font-bold text-slate-800 mt-1">{g.title}</h3>
                  <div className="flex gap-2 items-center mt-1">
                    <GameTypeBadge type={g.game_type} />
                    <p className="text-xs text-slate-500">{g.category}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-xl p-2"><p className="text-lg font-bold text-primary-600">{g.point_reward}</p><p className="text-xs text-slate-500">Point</p></div>
                <div className="bg-slate-50 rounded-xl p-2"><p className="text-lg font-bold text-emerald-600">{g.pass_score}</p><p className="text-xs text-slate-500">ผ่าน</p></div>
                <div className="bg-slate-50 rounded-xl p-2"><p className="text-lg font-bold text-amber-600">{g.max_attempts}</p><p className="text-xs text-slate-500">ครั้ง</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openQuestions(g)} className="btn-secondary btn-sm flex-1">📝 เนื้อหา/คำถาม</button>
                <button onClick={() => openEditGame(g)} className="btn-icon btn-ghost text-slate-400"><Edit className="w-4 h-4" /></button>
                <button onClick={() => deleteGame(g.id)} className="btn-icon btn-ghost text-red-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                {g.status === 'DRAFT' && <button onClick={() => publishGame(g.id)} className="btn-primary btn-sm">เผยแพร่</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Game Modal */}
      <Modal isOpen={showGameModal} onClose={() => setShowGameModal(false)} title={editGame ? 'แก้ไขเกม' : 'สร้างเกมใหม่'} size="lg"
        footer={<><button onClick={() => setShowGameModal(false)} className="btn-secondary">ยกเลิก</button><button onClick={saveGame} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'บันทึก'}</button></>}>
        <div className="space-y-4">
          <div><label className="form-label">ชื่อเกม *</label><input className="form-input" value={gameForm.title} onChange={e => setGameForm(f => ({ ...f, title: e.target.value }))} placeholder="เช่น IP Address Challenge" /></div>
          <div><label className="form-label">รายละเอียด</label><textarea className="form-textarea" rows={2} value={gameForm.description} onChange={e => setGameForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="form-label">ประเภทเกม</label>
              <select className="form-select" value={gameForm.game_type} onChange={e => setGameForm(f => ({ ...f, game_type: e.target.value as Game['game_type'] }))}>
                <option value="QUIZ">QUIZ (ตอบคำถาม)</option>
                <option value="SHOOTER">SHOOTER (ยานอวกาศยิงคำตอบ)</option>
                <option value="RUNNER">RUNNER (วิ่งเก็บเหรียญ)</option>
                <option value="MATCHING">MATCHING (จับคู่)</option>
              </select></div>
            <div><label className="form-label">หมวดหมู่</label>
              <select className="form-select" value={gameForm.category} onChange={e => setGameForm(f => ({ ...f, category: e.target.value }))}>
                {GAME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div><label className="form-label">Point รางวัล</label><input type="number" className="form-input" value={gameForm.point_reward} onChange={e => setGameForm(f => ({ ...f, point_reward: parseInt(e.target.value) || 0 }))} /></div>
            <div><label className="form-label">คะแนนผ่าน</label><input type="number" className="form-input" value={gameForm.pass_score} onChange={e => setGameForm(f => ({ ...f, pass_score: parseInt(e.target.value) || 0 }))} /></div>
            <div><label className="form-label">เล่นสูงสุด (ครั้ง)</label><input type="number" className="form-input" value={gameForm.max_attempts} onChange={e => setGameForm(f => ({ ...f, max_attempts: parseInt(e.target.value) || 1 }))} /></div>
            <div><label className="form-label">Cooldown (วินาที)</label><input type="number" className="form-input" value={gameForm.cooldown_seconds} onChange={e => setGameForm(f => ({ ...f, cooldown_seconds: parseInt(e.target.value) || 0 }))} /></div>
          </div>
        </div>
      </Modal>

      {/* Questions Modal */}
      <Modal isOpen={showQModal} onClose={() => setShowQModal(false)} title={`คำถาม: ${selectedGame?.title}`} size="2xl"
        footer={<button onClick={() => setShowQModal(false)} className="btn-secondary">ปิด</button>}>
        <div className="space-y-4">
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-sm text-slate-700">เพิ่มคำถามใหม่</h4>
            <textarea className="form-textarea" rows={2} placeholder="คำถาม" value={qForm.question} onChange={e => setQForm(f => ({ ...f, question: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              {qForm.options.map((opt, i) => (
                <input key={i} className="form-input" placeholder={`ตัวเลือก ${i + 1}`} value={opt} onChange={e => { const opts = [...qForm.options]; opts[i] = e.target.value; setQForm(f => ({ ...f, options: opts })) }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label text-xs">คำตอบที่ถูกต้อง</label>
                <input className="form-input" placeholder="พิมพ์คำตอบที่ถูก" value={qForm.correct_answer} onChange={e => setQForm(f => ({ ...f, correct_answer: e.target.value }))} /></div>
              <div><label className="form-label text-xs">คะแนน</label>
                <input type="number" className="form-input" value={qForm.points} onChange={e => setQForm(f => ({ ...f, points: parseInt(e.target.value) || 10 }))} /></div>
            </div>
            <input className="form-input" placeholder="คำอธิบาย (แสดงหลังตอบ)" value={qForm.explanation} onChange={e => setQForm(f => ({ ...f, explanation: e.target.value }))} />
            <button onClick={addQuestion} className="btn-primary btn-sm"><Plus className="w-4 h-4" /> เพิ่มคำถาม</button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {questions.length === 0 && <p className="text-slate-400 text-sm text-center py-4">ยังไม่มีคำถาม</p>}
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{q.question}</p>
                  <p className="text-xs text-emerald-600">✓ {q.correct_answer} • {q.points} คะแนน</p>
                </div>
                <button onClick={() => deleteQuestion(q.id)} className="btn-icon btn-ghost text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
