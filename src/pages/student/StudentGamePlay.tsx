import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Game, GameQuestion, GameAttempt } from '../../lib/types'
import { PageLoading, showSuccess, showError, Spinner } from '../../components/ui/index'
import ShooterGame from '../../components/games/ShooterGame'

type GameState = 'LOADING' | 'START' | 'PLAYING' | 'REVIEWING' | 'FINISHED'

export default function StudentGamePlay() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [questions, setQuestions] = useState<GameQuestion[]>([])
  const [studentId, setStudentId] = useState<string | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [state, setState] = useState<GameState>('LOADING')
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [reviewAnswers, setReviewAnswers] = useState<Array<{ question: string; selected: string; correct: string; is_correct: boolean }>>([])

  useEffect(() => {
    if (!user || !id) return
    async function load() {
      const [studentRes, gameRes, questRes] = await Promise.all([
        supabase.from('students').select('id').eq('user_id', user!.id).single(),
        supabase.from('games').select('*').eq('id', id).single(),
        supabase.from('game_questions').select('*').eq('game_id', id).order('sort_order'),
      ])
      if (studentRes.data) setStudentId(studentRes.data.id)
      if (gameRes.data) setGame(gameRes.data as Game)
      if (questRes.data) setQuestions(questRes.data as GameQuestion[])
      setState('START')
    }
    load()
  }, [user, id])

  // Timer
  useEffect(() => {
    if (state !== 'PLAYING') return
    if (timeLeft <= 0) { handleAnswer(null); return }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [state, timeLeft])

  async function startGame() {
    if (!studentId || !id) return
    const { data, error } = await supabase.from('game_attempts').insert({
      game_id: id,
      student_id: studentId,
      score: 0,
      passed: false,
      started_at: new Date().toISOString(),
    }).select('id').single()
    if (error) { await showError('ไม่สามารถเริ่มเกมได้', error.message); return }
    setAttemptId(data.id)
    setCurrentQ(0)
    setScore(0)
    setCorrectCount(0)
    setTimeLeft(30)
    setSelected(null)
    setIsCorrect(null)
    setReviewAnswers([])
    setState('PLAYING')
  }

  async function handleAnswer(answer: string | null) {
    const q = questions[currentQ]
    if (!q || state !== 'PLAYING') return

    const correct = answer === q.correct_answer
    setSelected(answer || '')
    setIsCorrect(correct)

    const newScore = score + (correct ? q.points : 0)
    const newCorrect = correctCount + (correct ? 1 : 0)
    setScore(newScore)
    setCorrectCount(newCorrect)
    setReviewAnswers(ra => [...ra, { question: q.question, selected: answer || '(หมดเวลา)', correct: q.correct_answer, is_correct: correct }])

    setState('REVIEWING')

    // Auto advance after 1.5 sec
    setTimeout(async () => {
      if (currentQ + 1 >= questions.length) {
        await finishGame(newScore)
      } else {
        setCurrentQ(q => q + 1)
        setSelected(null)
        setIsCorrect(null)
        setTimeLeft(30)
        setState('PLAYING')
      }
    }, 1500)
  }

  async function finishGame(finalScore: number) {
    if (!game || !attemptId) return
    const passed = finalScore >= game.pass_score
    await supabase.from('game_attempts').update({
      score: finalScore,
      passed,
      answers: {},
      finished_at: new Date().toISOString(),
    }).eq('id', attemptId)

    if (passed) {
      await supabase.rpc('award_game_point', {
        p_student_id: studentId,
        p_game_id: id,
        p_attempt_id: attemptId,
        p_score: finalScore,
      })
    }
    setScore(finalScore)
    setState('FINISHED')
  }

  if (state === 'LOADING') return <PageLoading />

  const q = questions[currentQ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-violet-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">

        {/* START */}
        {state === 'START' && game && (
          <div className="bg-white/10 backdrop-blur rounded-3xl p-8 text-center animate-bounce-in">
            <div className="text-6xl mb-4">🎮</div>
            <h1 className="text-3xl font-black text-white">{game.title}</h1>
            {game.description && <p className="text-slate-300 mt-2">{game.description}</p>}
            <div className="grid grid-cols-3 gap-3 my-6">
              {[
                { label: 'คำถาม', value: `${questions.length} ข้อ` },
                { label: 'คะแนนผ่าน', value: `${game.pass_score}` },
                { label: 'Point', value: `${game.point_reward} ⭐` },
              ].map(s => (
                <div key={s.label} className="bg-white/10 rounded-xl p-3">
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            {game.game_type === 'SHOOTER' ? (
              <p className="text-blue-300 text-sm mb-6 font-bold">🚀 บังคับยานอวกาศยิงคำตอบที่ถูกต้อง!</p>
            ) : game.game_type === 'RUNNER' ? (
              <p className="text-emerald-300 text-sm mb-6 font-bold">🏃 วิ่งกระโดดเก็บเหรียญคำตอบที่ถูกต้อง!</p>
            ) : game.game_type === 'MATCHING' ? (
              <p className="text-fuchsia-300 text-sm mb-6 font-bold">🃏 เปิดไพ่จับคู่ความหมายให้ถูกต้อง!</p>
            ) : (
              <p className="text-slate-400 text-sm mb-6">มีเวลา 30 วินาทีต่อข้อ</p>
            )}
            <button onClick={startGame} className="bg-primary-600 hover:bg-primary-500 text-white font-bold px-8 py-4 rounded-2xl text-xl transition-all hover:scale-105 active:scale-95">
              เริ่มเกม 🚀
            </button>
          </div>
        )}

        {/* PLAYING SHOOTER */}
        {(state === 'PLAYING' || state === 'REVIEWING') && game?.game_type === 'SHOOTER' && (
          <ShooterGame 
            questions={questions}
            onComplete={(finalScore) => finishGame(finalScore)}
          />
        )}

        {/* PLAYING or REVIEWING QUIZ */}
        {(state === 'PLAYING' || state === 'REVIEWING') && q && game?.game_type !== 'SHOOTER' && (
          <div className="animate-bounce-in">
            {/* Progress */}
            <div className="flex items-center justify-between mb-6 text-white text-sm font-medium">
              <span>ข้อ {currentQ + 1}/{questions.length}</span>
              <div className={`flex items-center gap-2 ${timeLeft <= 5 ? 'text-red-400' : 'text-slate-300'}`}>
                <Clock className="w-4 h-4" />
                <span className={`font-mono text-xl font-black ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>{timeLeft}</span>
              </div>
              <span>⭐ {score}</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-white/20 rounded-full mb-6 overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${((currentQ) / questions.length) * 100}%` }} />
            </div>

            {/* Question */}
            <div className="bg-white/10 backdrop-blur rounded-3xl p-6 mb-4">
              <p className="text-white text-lg font-bold text-center">{q.question}</p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {q.options.filter(o => o).map((opt, i) => {
                let cls = 'bg-white/10 hover:bg-white/20 border-white/20 text-white cursor-pointer'
                if (state === 'REVIEWING') {
                  if (opt === q.correct_answer) cls = 'bg-emerald-500 border-emerald-400 text-white'
                  else if (opt === selected && !isCorrect) cls = 'bg-red-500 border-red-400 text-white'
                  else cls = 'bg-white/5 border-white/10 text-white/50'
                }
                return (
                  <button
                    key={i}
                    onClick={() => state === 'PLAYING' && handleAnswer(opt)}
                    disabled={state === 'REVIEWING'}
                    className={`w-full p-4 rounded-2xl border-2 font-medium text-left transition-all ${cls}`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>

            {/* Feedback */}
            {state === 'REVIEWING' && (
              <div className={`mt-4 p-4 rounded-2xl text-center font-bold text-white ${isCorrect ? 'bg-emerald-500' : 'bg-red-500'} animate-bounce-in`}>
                {isCorrect ? '✅ ถูกต้อง!' : '❌ ผิด!'} {q.explanation && <span className="font-normal text-sm ml-2">{q.explanation}</span>}
              </div>
            )}
          </div>
        )}

        {/* FINISHED */}
        {state === 'FINISHED' && game && (
          <div className="bg-white/10 backdrop-blur rounded-3xl p-8 text-center animate-bounce-in">
            <div className="text-6xl mb-4">{score >= game.pass_score ? '🏆' : '😔'}</div>
            <h2 className="text-3xl font-black text-white mb-2">
              {score >= game.pass_score ? 'ผ่านแล้ว!' : 'ยังไม่ผ่าน'}
            </h2>
            <p className="text-slate-300 mb-6">{score >= game.pass_score ? `ได้รับ +${game.point_reward} Point!` : `ต้องได้ ${game.pass_score} คะแนนขึ้นไป`}</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-4xl font-black text-white">{score}</p>
                <p className="text-slate-400 text-sm">คะแนน</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-4xl font-black text-white">{correctCount}/{questions.length}</p>
                <p className="text-slate-400 text-sm">ข้อที่ถูก</p>
              </div>
            </div>

            {/* Review */}
            <div className="text-left space-y-2 mb-6 max-h-60 overflow-y-auto">
              {reviewAnswers.map((ra, i) => (
                <div key={i} className={`flex gap-2 p-3 rounded-xl text-sm ${ra.is_correct ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
                  {ra.is_correct ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  <div>
                    <p className="font-medium">{ra.question}</p>
                    {!ra.is_correct && <p className="text-xs mt-0.5">เฉลย: {ra.correct}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/student/games')} className="bg-white/20 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/30 transition-all">
                <ArrowLeft className="w-4 h-4 inline mr-2" />กลับ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
