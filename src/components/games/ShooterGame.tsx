import React, { useEffect, useRef, useState } from 'react'
import { Rocket, Heart } from 'lucide-react'
import type { GameQuestion } from '../../lib/types'

interface Props {
  questions: GameQuestion[]
  onComplete: (score: number, correctCount: number) => void
}

interface Bullet {
  id: number
  x: number
  y: number
}

interface Enemy {
  id: number
  text: string
  x: number
  y: number
  isCorrect: boolean
}

export default function ShooterGame({ questions, onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [gameState, setGameState] = useState<'PLAYING' | 'GAMEOVER' | 'VICTORY'>('PLAYING')
  const [qIndex, setQIndex] = useState(0)
  const [hp, setHp] = useState(3)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  // Game loop state refs to avoid closure stale state
  const stateRef = useRef({
    playerX: 50,
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    lastEnemySpawn: 0,
    keys: { ArrowLeft: false, ArrowRight: false, Space: false },
    lastShot: 0
  })

  // Start current question
  useEffect(() => {
    if (gameState === 'PLAYING' && qIndex < questions.length) {
      const q = questions[qIndex]
      // Spawn enemies for this question
      const options = q.options as string[]
      stateRef.current.enemies = options.map((opt, i) => ({
        id: Date.now() + i,
        text: opt,
        x: 10 + (i * (80 / Math.max(1, options.length - 1))), // Spread across screen
        y: -10 - (Math.random() * 20), // Staggered spawn above screen
        isCorrect: opt === q.correct_answer
      }))
    } else if (gameState === 'PLAYING' && qIndex >= questions.length) {
      setGameState('VICTORY')
      onComplete(score, correctCount)
    }
  }, [qIndex, gameState])

  // Game Loop
  useEffect(() => {
    if (gameState !== 'PLAYING') return

    let animationId: number
    let lastTime = performance.now()

    function loop(time: number) {
      const deltaTime = (time - lastTime) / 1000
      lastTime = time
      const s = stateRef.current

      // Movement
      if (s.keys.ArrowLeft) s.playerX = Math.max(0, s.playerX - 50 * deltaTime)
      if (s.keys.ArrowRight) s.playerX = Math.min(100, s.playerX + 50 * deltaTime)

      // Shooting
      if (s.keys.Space && time - s.lastShot > 500) {
        s.bullets.push({ id: Date.now(), x: s.playerX, y: 80 }) // player is at bottom 80%
        s.lastShot = time
      }

      // Move Bullets
      s.bullets.forEach(b => { b.y -= 50 * deltaTime })
      s.bullets = s.bullets.filter(b => b.y > -10)

      // Move Enemies
      s.enemies.forEach(e => { e.y += 15 * deltaTime })

      // Collision Detection
      let hitCorrect = false
      let hitWrong = false
      
      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i]
        for (let j = s.enemies.length - 1; j >= 0; j--) {
          const e = s.enemies[j]
          // Simple AABB box collision (approximate percentages)
          if (Math.abs(b.x - e.x) < 10 && Math.abs(b.y - e.y) < 10) {
            // Hit!
            if (e.isCorrect) {
              hitCorrect = true
            } else {
              hitWrong = true
            }
            s.bullets.splice(i, 1)
            s.enemies.splice(j, 1)
            break
          }
        }
      }

      // Enemy hit bottom
      const escaped = s.enemies.find(e => e.y > 100)
      if (escaped) {
        s.enemies = [] // Clear screen, try again or next? Let's just deduct HP
        hitWrong = true
      }

      // State Updates
      if (hitCorrect) {
        setScore(sc => sc + (questions[qIndex]?.points || 10))
        setCorrectCount(c => c + 1)
        s.enemies = [] // Clear others
        s.bullets = []
        setQIndex(qi => qi + 1)
      } else if (hitWrong) {
        setHp(h => {
          if (h <= 1) {
            setGameState('GAMEOVER')
            onComplete(score, correctCount)
            return 0
          }
          return h - 1
        })
        s.enemies = [] // Clear screen, spawn again for same question
        // Trigger respawn hack
        setTimeout(() => setQIndex(qi => qi), 100) 
      }

      // Re-render
      forceRender({})
      animationId = requestAnimationFrame(loop)
    }

    animationId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animationId)
  }, [gameState, qIndex])

  const [, forceRender] = useState({})

  // Keyboard events
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.code === 'ArrowLeft') stateRef.current.keys.ArrowLeft = true
      if (e.code === 'ArrowRight') stateRef.current.keys.ArrowRight = true
      if (e.code === 'Space') { e.preventDefault(); stateRef.current.keys.Space = true }
    }
    function up(e: KeyboardEvent) {
      if (e.code === 'ArrowLeft') stateRef.current.keys.ArrowLeft = false
      if (e.code === 'ArrowRight') stateRef.current.keys.ArrowRight = false
      if (e.code === 'Space') stateRef.current.keys.Space = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Keyboard events
  const s = stateRef.current
  const currentQ = questions[qIndex]

  return (
    <div className="relative w-full h-[600px] bg-slate-950 overflow-hidden rounded-xl border-4 border-slate-800" ref={containerRef}>
      
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10">
        <div>
          <div className="text-blue-400 font-bold">SCORE: {score}</div>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart key={i} className={`w-5 h-5 ${i < hp ? 'text-red-500 fill-red-500' : 'text-slate-700'}`} />
            ))}
          </div>
        </div>
        <div className="text-white text-center bg-slate-800/80 px-6 py-3 rounded-2xl border border-slate-700 shadow-xl max-w-[60%]">
          <p className="text-sm text-blue-300 mb-1">คำถามที่ {qIndex + 1}/{questions.length}</p>
          <p className="font-bold text-lg">{currentQ?.question}</p>
        </div>
        <div className="text-slate-400 font-bold">
          {hp <= 0 ? 'GAME OVER' : ''}
        </div>
      </div>

      {/* Game World */}
      <div className="absolute inset-0">
        {/* Player */}
        <div 
          className="absolute bottom-[10%] w-12 h-12 -ml-6 text-blue-400 transition-transform"
          style={{ left: `${s.playerX}%` }}
        >
          <Rocket className="w-full h-full" />
        </div>

        {/* Bullets */}
        {s.bullets.map(b => (
          <div 
            key={b.id} 
            className="absolute w-2 h-6 bg-yellow-400 rounded-full shadow-[0_0_10px_#facc15] -ml-1"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
          />
        ))}

        {/* Enemies (Options) */}
        {s.enemies.map(e => (
          <div 
            key={e.id}
            className="absolute px-4 py-2 bg-rose-600/90 text-white font-bold rounded-lg border-2 border-rose-400 shadow-[0_0_15px_#f43f5e] -translate-x-1/2 flex items-center justify-center min-w-[80px]"
            style={{ left: `${e.x}%`, top: `${e.y}%` }}
          >
            {e.text}
          </div>
        ))}
      </div>

      {/* Game Over / Victory Overlay */}
      {(gameState === 'GAMEOVER' || gameState === 'VICTORY') && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
          <h2 className={`text-4xl font-bold mb-2 ${gameState === 'VICTORY' ? 'text-emerald-400' : 'text-red-500'}`}>
            {gameState === 'VICTORY' ? 'MISSION COMPLETE!' : 'GAME OVER'}
          </h2>
          <p className="text-xl text-white mb-6">คะแนนของคุณ: {score}</p>
          {/* onComplete is called, parent handles next steps */}
          <div className="text-slate-400 animate-pulse">กำลังบันทึกคะแนน...</div>
        </div>
      )}
    </div>
  )
}
