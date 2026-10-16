import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Game, GameAttempt } from '../../lib/types'
import { SectionHeader, PageLoading, EmptyState, Badge, formatRelativeTime } from '../../components/ui/index'

const GameTypeBadge = ({ type }: { type: string }) => {
  switch(type) {
    case 'SHOOTER': return <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">🚀 ยิงยาน</span>
    case 'RUNNER': return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">🏃 วิ่งเก็บเหรียญ</span>
    case 'MATCHING': return <span className="bg-fuchsia-100 text-fuchsia-700 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">🃏 จับคู่</span>
    default: return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">📝 ควิซ</span>
  }
}

export default function StudentGames() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [games, setGames] = useState<Array<Game & { attempts: GameAttempt[] }>>([])
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('students').select('id').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setStudentId(data.id)
    })
  }, [user])

  useEffect(() => {
    if (!studentId) return
    async function load() {
      const { data: games } = await supabase.from('games').select('*').eq('status', 'PUBLISHED').order('created_at', { ascending: false })
      if (!games) { setLoading(false); return }

      const { data: attempts } = await supabase.from('game_attempts').select('*').eq('student_id', studentId).order('created_at', { ascending: false })
      const attemptsByGame: Record<string, GameAttempt[]> = {}
      ;(attempts || []).forEach((a: GameAttempt) => {
        if (!attemptsByGame[a.game_id]) attemptsByGame[a.game_id] = []
        attemptsByGame[a.game_id].push(a)
      })
      setGames(games.map(g => ({ ...g, attempts: attemptsByGame[g.id] || [] })) as Array<Game & { attempts: GameAttempt[] }>)
      setLoading(false)
    }
    load()
  }, [studentId])

  function canPlay(game: Game & { attempts: GameAttempt[] }) {
    if (game.attempts.length >= game.max_attempts) return false
    const lastAttempt = game.attempts[0]
    if (lastAttempt && game.cooldown_seconds > 0) {
      const timeSince = (Date.now() - new Date(lastAttempt.finished_at || lastAttempt.started_at).getTime()) / 1000
      if (timeSince < game.cooldown_seconds) return false
    }
    return true
  }

  function cooldownLeft(game: Game & { attempts: GameAttempt[] }) {
    const last = game.attempts[0]
    if (!last) return 0
    const elapsed = (Date.now() - new Date(last.finished_at || last.started_at).getTime()) / 1000
    return Math.max(0, Math.round(game.cooldown_seconds - elapsed))
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <SectionHeader title="เกมเรียนรู้" subtitle="เรียนรู้ผ่านเกมและสะสม Point" />

      {games.length === 0 ? (
        <div className="card p-8"><EmptyState icon={<span className="text-4xl">🎮</span>} title="ยังไม่มีเกม" description="ครูยังไม่ได้สร้างเกม" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map(g => {
            const playable = canPlay(g)
            const cdLeft = cooldownLeft(g)
            const bestScore = g.attempts.reduce((m, a) => Math.max(m, a.score || 0), 0)
            const passedOnce = g.attempts.some(a => a.passed)

            return (
              <div key={g.id} className="card p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex gap-2 items-center mb-1">
                      <GameTypeBadge type={g.game_type || 'QUIZ'} />
                      {g.category && <Badge variant="indigo">{g.category}</Badge>}
                    </div>
                    <h3 className="font-bold text-slate-800 mt-1">{g.title}</h3>
                    {g.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{g.description}</p>}
                  </div>
                  {passedOnce && <span className="text-lg" title="ผ่านแล้ว">🏆</span>}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-amber-50 rounded-xl p-2 text-center">
                    <p className="text-base font-bold text-amber-600">{g.point_reward}</p>
                    <p className="text-xs text-slate-500">Point</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2 text-center">
                    <p className="text-base font-bold text-slate-700">{g.attempts.length}/{g.max_attempts}</p>
                    <p className="text-xs text-slate-500">ครั้ง</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-2 text-center">
                    <p className="text-base font-bold text-emerald-600">{bestScore}</p>
                    <p className="text-xs text-slate-500">สูงสุด</p>
                  </div>
                </div>

                {/* Last attempt */}
                {g.attempts.length > 0 && (
                  <p className="text-xs text-slate-400">เล่นล่าสุด: {formatRelativeTime(g.attempts[0].started_at)}</p>
                )}

                {/* Play button */}
                {playable ? (
                  <button
                    onClick={() => navigate(`/student/games/${g.id}/play`)}
                    id={`play-game-${g.id}`}
                    className="btn-primary w-full"
                  >
                    🎮 เล่นเกม
                  </button>
                ) : g.attempts.length >= g.max_attempts ? (
                  <div className="bg-slate-100 rounded-xl p-3 text-center text-sm text-slate-500">
                    ใช้ครบ {g.max_attempts} ครั้งแล้ว
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-xl p-3 text-center text-sm text-amber-600">
                    ⏳ Cooldown: {Math.floor(cdLeft / 3600)}h {Math.floor((cdLeft % 3600) / 60)}m
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
