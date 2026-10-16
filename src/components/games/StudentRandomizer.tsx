import React, { useState, useRef, useEffect } from 'react'
import type { Student } from '../../lib/types'
import { Avatar } from '../ui'
import { PartyPopper, Settings, Lock } from 'lucide-react'
import { Modal } from '../ui'
import confetti from 'canvas-confetti'

interface StudentRandomizerProps {
  students: Student[]
  onClose: () => void
}

export default function StudentRandomizer({ students, onClose }: StudentRandomizerProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [winner, setWinner] = useState<Student | null>(null)
  
  // Rigging system
  const [showRigging, setShowRigging] = useState(false)
  const [riggedQueue, setRiggedQueue] = useState<string[]>([]) // array of student IDs
  const [clickCount, setClickCount] = useState(0)

  // Secret trigger for rigging (click title 5 times)
  const handleSecretClick = () => {
    const newCount = clickCount + 1
    setClickCount(newCount)
    if (newCount >= 3) {
      setShowRigging(true)
      setClickCount(0)
    }
  }

  const toggleRig = (id: string) => {
    if (riggedQueue.includes(id)) {
      setRiggedQueue(q => q.filter(x => x !== id))
    } else {
      setRiggedQueue(q => [...q, id])
    }
  }

  const spin = () => {
    if (students.length === 0) return
    setIsSpinning(true)
    setWinner(null)

    // Select winner
    let finalWinner: Student
    if (riggedQueue.length > 0) {
      const nextId = riggedQueue[0]
      finalWinner = students.find(s => s.id === nextId) || students[Math.floor(Math.random() * students.length)]
      setRiggedQueue(q => q.slice(1)) // remove first
    } else {
      finalWinner = students[Math.floor(Math.random() * students.length)]
    }

    // Fake delay for animation
    setTimeout(() => {
      setIsSpinning(false)
      setWinner(finalWinner)
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      })
    }, 3000)
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-3xl text-white relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[150%] bg-blue-500 blur-[120px] rounded-full rotate-12" />
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[150%] bg-purple-500 blur-[120px] rounded-full -rotate-12" />
      </div>

      <h2 
        className="text-4xl font-black mb-8 relative z-10 cursor-default select-none text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-400"
        onClick={handleSecretClick}
      >
        LUCKY DRAW
      </h2>

      {/* Spinner Area */}
      <div className="relative w-64 h-64 mb-8 z-10 flex items-center justify-center bg-white/10 rounded-full border-4 border-white/20 shadow-[0_0_50px_rgba(139,92,246,0.3)]">
        {isSpinning ? (
          <div className="animate-spin rounded-full h-48 w-48 border-b-4 border-white"></div>
        ) : winner ? (
          <div className="flex flex-col items-center animate-in zoom-in duration-500">
            <Avatar name={winner.first_name} src={winner.avatar_url} className="w-32 h-32 text-4xl mb-4 border-4 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)]" />
            <p className="text-2xl font-black text-yellow-400">{winner.nickname || winner.first_name}</p>
            <p className="text-sm text-slate-300">{winner.first_name} {winner.last_name}</p>
          </div>
        ) : (
          <div className="text-slate-400 font-bold text-xl">
            พร้อมสุ่ม!
          </div>
        )}
      </div>

      <button 
        onClick={spin}
        disabled={isSpinning || students.length === 0}
        className="relative z-10 btn-primary text-xl px-12 py-4 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:scale-105 transition-transform"
      >
        {isSpinning ? 'กำลังสุ่ม...' : 'SPIN! สุ่มเลย'}
      </button>

      {/* Rigging Menu (Hidden by default) */}
      <Modal isOpen={showRigging} onClose={() => setShowRigging(false)} title="Secret Menu (ล็อกคิวสุ่ม)" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">คลิกที่รายชื่อนักเรียนเพื่อจัดเรียงคิวที่จะถูกสุ่มออกตามลำดับ</p>
          
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="w-full font-bold text-slate-700 text-sm">คิวที่ล็อกไว้ ({riggedQueue.length} คิว):</p>
            {riggedQueue.map((id, index) => {
              const s = students.find(x => x.id === id)
              return (
                <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200 flex items-center gap-1">
                  {index + 1}. {s?.nickname || s?.first_name}
                  <button onClick={() => toggleRig(id)} className="text-purple-400 hover:text-purple-900 ml-1">×</button>
                </span>
              )
            })}
            {riggedQueue.length === 0 && <span className="text-slate-400 text-xs">ยังไม่มีคิว</span>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => toggleRig(s.id)}
                className={`flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors border ${
                  riggedQueue.includes(s.id) ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Avatar name={s.first_name} src={s.avatar_url} className="w-6 h-6 text-[10px]" />
                <span className="truncate">{s.nickname || s.first_name}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>

    </div>
  )
}
