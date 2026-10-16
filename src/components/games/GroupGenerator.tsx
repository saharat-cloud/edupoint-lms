import React, { useState, useEffect } from 'react'
import type { Student } from '../../lib/types'
import { Avatar } from '../ui'
import { Users, Crown, X, Save, Lock, ArrowRightLeft, Settings, Maximize, Minimize } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { showError, showSuccess, confirmDelete } from '../ui'

interface GroupGeneratorProps {
  students: Student[]
  roomId: string
  onClose: () => void
  onSaved: () => void
}

interface Group {
  id: string
  name: string
  members: Student[]
  leaderId: string | null
}

export default function GroupGenerator({ students, roomId, onClose, onSaved }: GroupGeneratorProps) {
  const [generateMode, setGenerateMode] = useState<'by_groups' | 'by_size'>('by_groups')
  const [groupCount, setGroupCount] = useState(4)
  const [groupSize, setGroupSize] = useState(4)
  const [groups, setGroups] = useState<Group[]>([])
  const [activeStudents, setActiveStudents] = useState<Student[]>([...students])
  const [saving, setSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Randomize Leader State
  const [rollingLeaderGroupId, setRollingLeaderGroupId] = useState<string | null>(null)
  const [highlightedMemberId, setHighlightedMemberId] = useState<string | null>(null)

  // Rigging System
  const [showRigging, setShowRigging] = useState(false)
  const [riggedGroups, setRiggedGroups] = useState<Record<string, string>>({}) // studentId -> groupId (0, 1, 2, ...)
  const [clickCount, setClickCount] = useState(0)

  const handleSecretClick = () => {
    const newCount = clickCount + 1
    setClickCount(newCount)
    if (newCount >= 3) {
      setShowRigging(true)
      setClickCount(0)
    }
  }

  const toggleFullscreen = async (forceEnter?: boolean) => {
    try {
      if (forceEnter || !document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleAbsent = (student: Student) => {
    const isActive = activeStudents.some(s => s.id === student.id)
    if (isActive) {
      setActiveStudents(prev => prev.filter(s => s.id !== student.id))
      // Remove from generated groups if present
      setGroups(prev => prev.map(g => {
        const newMembers = g.members.filter(s => s.id !== student.id)
        let newLeader = g.leaderId
        if (newLeader === student.id) {
          newLeader = newMembers.length > 0 ? newMembers[0].id : null
        }
        return { ...g, members: newMembers, leaderId: newLeader }
      }))
    } else {
      setActiveStudents(prev => [...prev, student])
    }
  }

  const generateGroups = () => {
    let finalGroupCount = groupCount
    if (generateMode === 'by_size') {
      if (groupSize <= 0) {
        showError('ไม่สามารถจัดกลุ่มได้', 'จำนวนคนต่อกลุ่มต้องมากกว่า 0')
        return
      }
      finalGroupCount = Math.ceil(activeStudents.length / groupSize)
    }

    if (finalGroupCount <= 0 || finalGroupCount > activeStudents.length) {
      showError('ไม่สามารถจัดกลุ่มได้', 'จำนวนกลุ่มต้องมากกว่า 0 และไม่เกินจำนวนนักเรียน')
      return
    }

    setIsGenerating(true)

    setTimeout(() => {
      // Create empty groups
      const newGroups: Group[] = Array.from({ length: finalGroupCount }, (_, i) => ({
        id: `temp-${i}`,
        name: `กลุ่มที่ ${i + 1}`,
        members: [],
        leaderId: null
      }))

      // Filter active students
      const pool = [...activeStudents]

      // 1. Assign rigged students first
      const remainingStudents: Student[] = []
      pool.forEach(s => {
        const riggedGroupId = riggedGroups[s.id]
        if (riggedGroupId !== undefined && parseInt(riggedGroupId) < finalGroupCount) {
          newGroups[parseInt(riggedGroupId)].members.push(s)
        } else {
          remainingStudents.push(s)
        }
      })

      // 2. Shuffle remaining and distribute to groups to balance them
      remainingStudents.sort(() => Math.random() - 0.5)

      remainingStudents.forEach(s => {
        // Find the group with the least members
        let minGroupIdx = 0
        let minSize = newGroups[0].members.length
        for (let i = 1; i < finalGroupCount; i++) {
          if (newGroups[i].members.length < minSize) {
            minSize = newGroups[i].members.length
            minGroupIdx = i
          }
        }
        newGroups[minGroupIdx].members.push(s)
      })

      // Assign leaders randomly if not assigned
      newGroups.forEach(g => {
        if (g.members.length > 0) {
          g.leaderId = g.members[Math.floor(Math.random() * g.members.length)].id
        }
      })

      setGroups(newGroups)
      setIsGenerating(false)
    }, 1500)
  }

  const setLeader = (groupId: string, studentId: string | null) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, leaderId: studentId } : g))
  }

  const randomizeLeader = (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group || group.members.length === 0) return

    setRollingLeaderGroupId(groupId)
    setLeader(groupId, null)

    let count = 0
    const maxCount = 20
    const interval = setInterval(() => {
      const randomMember = group.members[Math.floor(Math.random() * group.members.length)]
      setHighlightedMemberId(randomMember.id)
      count++

      if (count >= maxCount) {
        clearInterval(interval)
        setRollingLeaderGroupId(null)
        setHighlightedMemberId(null)
        setLeader(groupId, randomMember.id)
        
        import('canvas-confetti').then((module) => {
          module.default({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 },
            zIndex: 1000
          })
        })
      }
    }, 100)
  }

  const saveGroups = async () => {
    if (groups.length === 0) return
    setSaving(true)
    try {
      // 1. Insert Groups
      const groupDataToInsert = groups.map(g => ({
        room_id: roomId,
        name: g.name
      }))

      const { data: insertedGroups, error: groupErr } = await supabase
        .from('student_groups')
        .insert(groupDataToInsert)
        .select()
      
      if (groupErr) throw groupErr

      // 2. Insert Members
      const membersToInsert: any[] = []
      groups.forEach((g, idx) => {
        const dbGroup = insertedGroups[idx]
        g.members.forEach(m => {
          membersToInsert.push({
            group_id: dbGroup.id,
            student_id: m.id,
            is_leader: g.leaderId === m.id
          })
        })
      })

      const { error: memberErr } = await supabase
        .from('student_group_members')
        .insert(membersToInsert)

      if (memberErr) throw memberErr

      await showSuccess('บันทึกกลุ่มสำเร็จ')
      onSaved()
      onClose()
    } catch (err: any) {
      await showError('เกิดข้อผิดพลาด', err.message)
    } finally {
      setSaving(false)
    }
  }

  const givePointsToGroup = async (group: Group, points: number, reason: string) => {
    if (group.members.length === 0) return
    
    // Using sweetalert to confirm
    const Swal = (await import('sweetalert2')).default
    const result = await Swal.fire({
      title: `ให้ ${points} คะแนนกับ ${group.name}?`,
      text: `นักเรียนทั้ง ${group.members.length} คน จะได้รับคะแนนนี้`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    })

    if (!result.isConfirmed) return

    try {
      // Create point transactions
      const transactions = group.members.map(m => ({
        student_id: m.id,
        points: points,
        reason: reason,
        awarded_by: (supabase as any).auth?.user?.()?.id || null // Adjust this based on your auth setup, or just let DB trigger handle it if RLS doesn't require it here
      }))

      const { error } = await supabase.from('point_transactions').insert(transactions)
      if (error) throw error

      await showSuccess(`เพิ่มคะแนนกลุ่มสำเร็จ!`)
      onSaved() // To trigger parent to reload points
    } catch (err: any) {
      await showError('เกิดข้อผิดพลาด', err.message)
    }
  }


  return (
    <div className="flex flex-col gap-6 p-2">
      {/* Top: Settings */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch w-full h-auto md:h-36">
        {/* Settings Card */}
        <div className="card p-3 space-y-2 bg-slate-50 w-full md:w-1/3 xl:w-1/4 shrink-0 flex flex-col justify-between">
            <h3 className="font-bold flex items-center gap-2 cursor-pointer select-none text-sm" onClick={handleSecretClick}>
              <Settings className="w-3 h-3" /> ตั้งค่าการสุ่ม
            </h3>
            
            <div className="flex bg-slate-200 p-1 rounded-lg">
              <button 
                className={`flex-1 text-xs py-1.5 rounded-md font-bold transition-colors ${generateMode === 'by_groups' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setGenerateMode('by_groups')}
              >
                ระบุกลุ่ม
              </button>
              <button 
                className={`flex-1 text-xs py-1.5 rounded-md font-bold transition-colors ${generateMode === 'by_size' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setGenerateMode('by_size')}
              >
                ระบุจำนวนคน
              </button>
            </div>
            
            {generateMode === 'by_groups' ? (
              <div className="flex items-center gap-2">
                <label className="form-label mb-0 whitespace-nowrap text-xs">แบ่งกลุ่มกี่กลุ่ม?</label>
                <input 
                  type="number" 
                  min="1" 
                  max={activeStudents.length} 
                  className="form-input text-sm font-bold w-full py-1" 
                  value={groupCount}
                  onChange={(e) => setGroupCount(parseInt(e.target.value) || 1)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="form-label mb-0 whitespace-nowrap text-xs">กลุ่มละกี่คน?</label>
                <input 
                  type="number" 
                  min="1" 
                  max={activeStudents.length} 
                  className="form-input text-sm font-bold w-full py-1" 
                  value={groupSize}
                  onChange={(e) => setGroupSize(parseInt(e.target.value) || 1)}
                />
              </div>
            )}
            
            <button 
              onClick={generateGroups} 
              disabled={isGenerating}
              className="btn-primary w-full mt-1 py-1.5 text-sm"
            >
              <Users className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} /> 
              {isGenerating ? 'กำลังจับกลุ่ม...' : 'สุ่มจัดกลุ่ม!'}
            </button>
          </div>

          <div className="card p-3 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-1 shrink-0">
              <h3 className="font-bold text-sm text-slate-500">นักเรียน ({activeStudents.length}/{students.length})</h3>
              <p className="text-[10px] text-slate-400">คลิกที่ชื่อเพื่อสลับสถานะขาดเรียน (คัดออก)</p>
            </div>
            <div className="flex flex-wrap gap-1 overflow-y-auto content-start flex-1 p-1">
              {students.map(s => {
                const isActive = activeStudents.some(as => as.id === s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleAbsent(s)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      isActive 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700' 
                        : 'bg-red-50 border-red-200 text-red-700 line-through opacity-50 hover:opacity-100 hover:bg-emerald-50'
                    }`}
                  >
                    {s.nickname || s.first_name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main: Groups Result */}
        <div className="flex-1 space-y-4 relative w-full">
          {isGenerating && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl border-2 border-indigo-100">
              <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 shadow-lg"></div>
              <h2 className="text-xl font-black text-indigo-600 animate-pulse">กำลังจับกลุ่ม...</h2>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <Users className="w-12 h-12 mb-2 text-slate-300" />
              <p>ยังไม่ได้จัดกลุ่ม กดสุ่มเพื่อเริ่ม</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="text-blue-800 text-sm font-bold">
                  💡 คุณสามารถคลิกที่ <Crown className="inline w-3 h-3 text-amber-500" /> หน้านักเรียนเพื่อตั้งให้เป็นหัวหน้ากลุ่มได้
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => toggleFullscreen(true)} 
                    className="btn-icon bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center"
                  >
                    <Maximize className="w-4 h-4 mr-2" /> นำเสนอเต็มจอ
                  </button>
                  <button 
                    onClick={saveGroups} 
                    disabled={saving}
                    className="btn-primary"
                  >
                    <Save className="w-4 h-4 mr-2" /> {saving ? 'กำลังบันทึก...' : 'บันทึกกลุ่มนำไปใช้งาน'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto p-1">
                {groups.map(g => (
                  <div key={g.id} className="card overflow-hidden border-t-4 border-t-blue-500">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <input 
                          className="font-black text-lg bg-transparent border-none p-0 focus:ring-0 w-full"
                          value={g.name}
                          onChange={(e) => setGroups(prev => prev.map(pg => pg.id === g.id ? { ...pg, name: e.target.value } : pg))}
                        />
                        <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{g.members.length} คน</span>
                      </div>
                      
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => givePointsToGroup(g, 1, 'คะแนนกลุ่ม +1')} className="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded text-xs font-bold transition-colors">+1</button>
                        <button onClick={() => givePointsToGroup(g, 5, 'คะแนนกลุ่ม +5')} className="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded text-xs font-bold transition-colors">+5</button>
                        <button onClick={() => givePointsToGroup(g, -1, 'หักคะแนนกลุ่ม -1')} className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded text-xs font-bold transition-colors">-1</button>
                      </div>
                    </div>
                    <div className="p-2 grid grid-cols-2 lg:grid-cols-3 gap-2 min-h-32">
                      {g.members.map(m => {
                        const isLeader = g.leaderId === m.id
                        return (
                          <div key={m.id} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors relative ${isLeader ? 'bg-amber-50 border border-amber-100 shadow-sm' : 'bg-white border border-slate-100 hover:border-slate-300 shadow-sm'}`}>
                            
                            <div className="absolute top-1 left-1">
                              <button 
                                onClick={() => setLeader(g.id, m.id)}
                                className={`p-1 rounded-full transition-colors ${isLeader ? 'bg-amber-100 text-amber-500' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'}`}
                                title="ตั้งเป็นหัวหน้ากลุ่ม"
                              >
                                <Crown className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="absolute top-1 right-1">
                              <button 
                                onClick={() => toggleAbsent(m)} 
                                className="text-slate-300 hover:text-red-500 p-1"
                                title="ลบออกจากกลุ่ม (ขาดเรียน)"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>

                            <Avatar name={m.first_name} src={m.avatar_url} className={`w-10 h-10 text-sm ${isLeader ? 'border-2 border-amber-400 shadow-sm' : ''}`} />
                            <div className="text-center w-full px-1">
                              <p className={`text-xs font-bold truncate ${isLeader ? 'text-amber-700' : 'text-slate-700'}`} title={m.first_name}>
                                {m.nickname || m.first_name}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                      {g.members.length === 0 && (
                        <div className="col-span-full text-center text-sm text-slate-400 py-4">ไม่มีสมาชิก</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      {/* Secret Rigging Modal */}
      {showRigging && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-purple-50 rounded-t-2xl">
              <h3 className="font-bold text-purple-800">🕵️ Secret Rigging (ล็อกกลุ่มล่วงหน้า)</h3>
              <button onClick={() => setShowRigging(false)} className="text-slate-500 hover:text-slate-800">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-sm text-slate-500 mb-4">กำหนดกลุ่มให้กับนักเรียนล่วงหน้า ถ้านักเรียนคนไหนไม่ได้ล็อกไว้ ระบบจะสุ่มกระจายให้กลุ่มที่ว่างอัตโนมัติ</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {students.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-sm truncate w-24">{s.nickname || s.first_name}</span>
                    <select 
                      className="form-input py-1 px-2 text-xs w-20"
                      value={riggedGroups[s.id] !== undefined ? riggedGroups[s.id] : ''}
                      onChange={e => {
                        const val = e.target.value
                        setRiggedGroups(prev => {
                          const next = { ...prev }
                          if (val === '') delete next[s.id]
                          else next[s.id] = val
                          return next
                        })
                      }}
                    >
                      <option value="">สุ่ม</option>
                      {Array.from({length: groupCount}).map((_, i) => (
                        <option key={i} value={i}>กลุ่ม {i+1}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Presentation Mode */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col p-6 overflow-hidden">
          <div className="flex justify-between items-center mb-6 shrink-0 bg-white p-4 rounded-2xl shadow-sm">
            <h2 className="text-2xl font-black text-indigo-900">ผลการสุ่มจัดกลุ่ม</h2>
            <button 
              onClick={() => toggleFullscreen()} 
              className="btn-icon bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg font-bold flex items-center"
            >
              <Minimize className="w-5 h-5 mr-2" /> ออกจากโหมดเต็มจอ
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-8 px-2 flex-1 content-start">
            {groups.map(g => (
              <div key={g.id} className="card overflow-hidden border-t-4 border-t-indigo-500 shadow-lg">
                <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
                  <h3 className="font-black text-xl text-indigo-900">{g.name}</h3>
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => randomizeLeader(g.id)}
                      disabled={rollingLeaderGroupId !== null}
                      className="btn-icon bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1 rounded-full text-xs font-bold flex items-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      <Crown className="w-4 h-4 mr-1" /> สุ่มหัวหน้า
                    </button>
                    <span className="text-sm font-bold text-indigo-600 bg-indigo-200 px-3 py-1 rounded-full">{g.members.length} คน</span>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 min-h-32 bg-white">
                  {g.members.map(m => {
                    const isRolling = rollingLeaderGroupId === g.id
                    const isHighlighted = isRolling && highlightedMemberId === m.id
                    const isLeader = !isRolling && g.leaderId === m.id
                    return (
                      <div key={m.id} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl relative transition-all duration-75 ${
                        isLeader ? 'bg-amber-50 border-2 border-amber-300 shadow-md scale-105 z-10' : 
                        isHighlighted ? 'bg-amber-100 border-2 border-amber-400 shadow-lg scale-110 z-20' : 
                        isRolling ? 'bg-slate-50 border border-slate-200 opacity-50 scale-95' :
                        'bg-slate-50 border border-slate-200'
                      }`}>
                        {isLeader && (
                          <div className="absolute -top-3 -right-2 bg-white rounded-full p-1 shadow-sm">
                            <Crown className="w-5 h-5 text-amber-500" />
                          </div>
                        )}
                        <Avatar name={m.first_name} src={m.avatar_url} className={`w-14 h-14 text-lg ${isLeader ? 'border-2 border-amber-400' : ''}`} />
                        <div className="text-center w-full">
                          <p className={`text-sm font-bold truncate ${isLeader ? 'text-amber-700' : 'text-slate-700'}`}>
                            {m.nickname || m.first_name}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {g.members.length === 0 && (
                    <div className="col-span-full text-center text-slate-400 py-8">ไม่มีสมาชิก</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
