import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserMinus, Plus, Search, Trophy, Medal, PlusCircle, MinusCircle, LayoutGrid, Users, X, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ClassRoom, Student, PointSetting, PointLevel } from '../../lib/types'
import { PageLoading, Avatar, Badge, Modal, showSuccess, showError, confirmDelete } from '../../components/ui/index'
import Swal from 'sweetalert2'
import StudentRandomizer from '../../components/games/StudentRandomizer'
import GroupGenerator from '../../components/games/GroupGenerator'

export default function AdminClassDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [room, setRoom] = useState<ClassRoom | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [topStudents, setTopStudents] = useState<any[]>([])
  const [pointLevels, setPointLevels] = useState<PointLevel[]>([])
  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Modal Add Students
  const [showAddModal, setShowAddModal] = useState(false)
  const [availableStudents, setAvailableStudents] = useState<Student[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'students' | 'groups'>('students')
  const [savedGroups, setSavedGroups] = useState<any[]>([])
  const [versionInputs, setVersionInputs] = useState<Record<string, { topic: string, points: string }>>({})
  
  // Games
  const [showWheel, setShowWheel] = useState(false)
  const [showGroups, setShowGroups] = useState(false)
  
  // Student Detail Modal
  const [viewStudent, setViewStudent] = useState<Student | null>(null)

  const loadData = async () => {
    setLoading(true)
    // Load Room
    const { data: roomData } = await supabase
      .from('class_rooms')
      .select('*, education_level:education_levels(name), academic_year:academic_years(name)')
      .eq('id', id)
      .single()
      
    if (roomData) setRoom(roomData as ClassRoom)

    // Load Students in Room with Points
    const { data: studentsData } = await supabase
      .from('students')
      .select('*, student_total_points(total_points)')
      .eq('class_room_id', id)
      .order('student_code')
      
    // Load Point Settings & Levels
    const [pSetRes, pLvlRes] = await Promise.all([
      supabase.from('point_settings').select('*').single(),
      supabase.from('point_levels').select('*').order('sort_order')
    ])
    if (pSetRes.data) setPointSetting(pSetRes.data)
    if (pLvlRes.data) setPointLevels(pLvlRes.data)

    if (studentsData) {
      const mappedData = studentsData.map((s: any) => {
        let pts = 0
        if (s.student_total_points) {
          pts = Array.isArray(s.student_total_points) 
            ? (s.student_total_points[0]?.total_points || 0) 
            : (s.student_total_points.total_points || 0)
        }
        return { ...s, total_points: pts }
      })
      setStudents(mappedData as Student[])
      
      const sorted = [...mappedData].sort((a, b) => b.total_points - a.total_points)
      setTopStudents(sorted.slice(0, 3)) // Show top 3 even if points are 0
    }
    
    // Load saved groups
    const { data: groupsData, error: groupsError } = await supabase
      .from('student_groups')
      .select('*, members:student_group_members(student_id, is_leader, student:students(*))')
      .eq('room_id', id)
      .order('name')
      
    if (groupsError) {
      console.error('Error fetching groups:', groupsError)
    }
      
      if (groupsData) {
      // Fetch group transactions to calculate exact points for each group
      const groupIds = groupsData.map((g: any) => g.id)
      const { data: txData } = await supabase
        .from('point_transactions')
        .select('source_id, points, created_at, note')
        .in('source_id', groupIds)
        
      const groupPointsMap: Record<string, number> = {}
      const completedGroups = new Set<string>()
      
      if (txData) {
        // Since 1 group point action inserts N rows (1 per member), 
        // we group by created_at to only count the action once per group.
        const uniqueEvents = new Map<string, any>()
        txData.forEach(tx => {
          if (tx.source_id) {
            const key = `${tx.source_id}_${tx.created_at}`
            uniqueEvents.set(key, tx)
          }
        })
        
        uniqueEvents.forEach((tx, key) => {
          const source_id = key.split('_')[0]
          groupPointsMap[source_id] = (groupPointsMap[source_id] || 0) + tx.points
          if (tx.note && tx.note.startsWith('Mission Complete')) {
            completedGroups.add(source_id)
          }
        })
      }

      const groupsWithPoints = groupsData.map((g: any) => ({
        ...g,
        group_points: groupPointsMap[g.id] || 0,
        is_mission_completed: completedGroups.has(g.id)
      }))

      setSavedGroups(groupsWithPoints)
    }

    setLoading(false)
  }

  function getStudentLevel(points: number) {
    if (!pointLevels || pointLevels.length === 0) return null
    const match = pointLevels.find(l => points >= l.min_points && (l.max_points === null || points <= l.max_points))
    return match || pointLevels[0]
  }

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const openAddModal = async () => {
    setSelectedStudentIds([])
    setSearchQuery('')
    setShowAddModal(true)
    
    // Load students NOT in this room
    const { data } = await supabase
      .from('students')
      .select('*')
      .neq('class_room_id', id)
      .order('student_code')
      
    // Also include students with NULL class_room_id
    const { data: nullData } = await supabase
      .from('students')
      .select('*')
      .is('class_room_id', null)
      .order('student_code')
      
    const combined = [...(data || []), ...(nullData || [])]
    // Filter duplicates just in case (though neq/is null shouldn't overlap)
    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values())
    
    setAvailableStudents(unique as Student[])
  }

  const handleAddStudents = async () => {
    if (selectedStudentIds.length === 0) return
    setAdding(true)
    
    const { error } = await supabase
      .from('students')
      .update({ class_room_id: id })
      .in('id', selectedStudentIds)
      
    if (error) {
      showError('เพิ่มนักเรียนไม่สำเร็จ', error.message)
    } else {
      showSuccess('เพิ่มนักเรียนเรียบร้อยแล้ว')
      setShowAddModal(false)
      loadData()
    }
    setAdding(false)
  }

  const handleRemoveStudent = async (student: Student, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await confirmDelete('นำนักเรียนออกจากห้อง', `ต้องการนำ ${student.first_name} ${student.last_name} ออกจากห้องนี้ใช่หรือไม่?`)
    if (!ok) return
    
    const { error } = await supabase
      .from('students')
      .update({ class_room_id: null })
      .eq('id', student.id)
      
    if (error) {
      showError('นำออกไม่สำเร็จ', error.message)
    } else {
      showSuccess('นำนักเรียนออกจากห้องเรียบร้อยแล้ว')
      loadData()
    }
  }

  const handleAdjustPoints = async (student: Student, e: React.MouseEvent) => {
    e.stopPropagation()
    const { value: amount } = await Swal.fire({
      title: 'ให้คะแนน / หักคะแนน',
      html: `กำลังปรับคะแนนให้ <b>${student.first_name} ${student.last_name}</b>`,
      input: 'number',
      inputLabel: 'จำนวนพอยต์ (ใส่ค่าติดลบเพื่อหักคะแนน)',
      inputPlaceholder: 'เช่น 10 หรือ -5',
      showCancelButton: true,
      confirmButtonText: 'ต่อไป',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#3b82f6',
    })

    if (amount) {
      const pts = parseInt(amount)
      if (isNaN(pts) || pts === 0) return
      
      const { value: note } = await Swal.fire({
        title: 'หมายเหตุ',
        input: 'text',
        inputPlaceholder: 'เช่น ตอบคำถามในห้องเรียน, จิตอาสา, มาสาย',
        showCancelButton: true,
        confirmButtonText: 'บันทึกคะแนน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: pts > 0 ? '#10b981' : '#ef4444'
      })

      if (note !== undefined) {
        setLoading(true)
        const { error } = await supabase.from('point_transactions').insert({
          student_id: student.id,
          points: pts,
          transaction_type: 'MANUAL',
          source_type: 'MANUAL',
          note: note || (pts > 0 ? 'ได้รับคะแนนพิเศษ' : 'โดนหักคะแนน')
        })

        if (error) {
          showError('ไม่สามารถปรับคะแนนได้', error.message)
        } else {
          showSuccess('ปรับคะแนนเรียบร้อยแล้ว')
          loadData()
          // Update viewStudent state if modal is open
          if (viewStudent && viewStudent.id === student.id) {
            setViewStudent({ ...viewStudent, total_points: ((viewStudent as any).total_points || 0) + pts } as any)
          }
        }
        setLoading(false)
      }
    }
  }

  const handleQuickPoints = async (student: Student, pts: number, note: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setLoading(true)
    const { error } = await supabase.from('point_transactions').insert({
      student_id: student.id,
      points: pts,
      transaction_type: 'MANUAL',
      source_type: 'MANUAL',
      note: note
    })
    
    if (error) {
      showError('ไม่สามารถปรับคะแนนได้', error.message)
    } else {
      // Don't show modal for quick points to save time, just a small toast or reload
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      })
      Toast.fire({
        icon: pts > 0 ? 'success' : 'error',
        title: `${pts > 0 ? '+' : ''}${pts} ให้ ${student.first_name}`
      })
      
      loadData()
      if (viewStudent && viewStudent.id === student.id) {
        setViewStudent({ ...viewStudent, total_points: ((viewStudent as any).total_points || 0) + pts } as any)
      }
    }
    setLoading(false)
  }

  const handleGroupPoints = async (group: any, pts: number, note: string) => {
    setLoading(true)
    const transactions = group.members.map((m: any) => ({
      student_id: m.student_id,
      points: pts,
      transaction_type: pts >= 0 ? 'EARN' : 'DEDUCTION',
      source_type: 'MANUAL',
      source_id: group.id,
      note: note
    }))

    const { error } = await supabase.from('point_transactions').insert(transactions)
    if (error) {
      showError('ไม่สามารถเพิ่มคะแนนกลุ่มได้', error.message)
    } else {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
      })
      Toast.fire({ icon: 'success', title: `เพิ่มคะแนนกลุ่ม ${group.name} สำเร็จ` })
      loadData()
    }
    setLoading(false)
  }

  const handleDeleteGroup = async (group: any) => {
    const ok = await confirmDelete('ลบกลุ่ม', `ต้องการลบกลุ่ม ${group.name} ใช่หรือไม่?`)
    if (!ok) return
    const { error } = await supabase.from('student_groups').delete().eq('id', group.id)
    if (error) {
      showError('ลบกลุ่มไม่สำเร็จ', error.message)
    } else {
      showSuccess('ลบกลุ่มเรียบร้อย')
      loadData()
    }
  }

  const handleDeleteVersion = async (groupsInVersion: any[]) => {
    const ok = await confirmDelete('ลบเวอร์ชัน', `ต้องการลบกลุ่มในชุดนี้ทั้งหมด (${groupsInVersion.length} กลุ่ม) ใช่หรือไม่?`)
    if (!ok) return
    setLoading(true)
    const ids = groupsInVersion.map(g => g.id)
    const { error } = await supabase.from('student_groups').delete().in('id', ids)
    if (error) {
      showError('ลบไม่สำเร็จ', error.message)
    } else {
      showSuccess('ลบเรียบร้อย')
      loadData()
    }
    setLoading(false)
  }

  const handleResetVersionPoints = async (groupsInVersion: any[]) => {
    const ok = await confirmDelete('รีเซ็ตคะแนน', `ต้องการลบข้อมูลคะแนนและยกเลิกสถานะ Mission Complete ของกลุ่มในชุดนี้ทั้งหมด ใช่หรือไม่?`)
    if (!ok) return
    setLoading(true)
    const ids = groupsInVersion.map(g => g.id)
    // Delete all point_transactions associated with these groups
    const { error } = await supabase.from('point_transactions').delete().in('source_id', ids)
    if (error) {
      showError('รีเซ็ตไม่สำเร็จ', error.message)
    } else {
      showSuccess('รีเซ็ตคะแนนเรียบร้อยแล้ว')
      loadData()
    }
    setLoading(false)
  }

  const handleResetAllStudents = async () => {
    const ok = await confirmDelete('รีเซ็ตคะแนนทุกคน', `ต้องการรีเซ็ตคะแนนของนักเรียน "ทุกคนในห้องนี้" ใช่หรือไม่? ข้อมูลคะแนนทั้งหมดจะถูกรีเซ็ตเป็น 0 และไม่สามารถกู้คืนได้`)
    if (!ok) return
    setLoading(true)
    const studentIds = students.map(s => s.id)
    if (studentIds.length > 0) {
      // Chunking if too many students
      const chunkSize = 100;
      for (let i = 0; i < studentIds.length; i += chunkSize) {
        const chunk = studentIds.slice(i, i + chunkSize);
        await supabase.from('point_transactions').delete().in('student_id', chunk)
      }
      showSuccess('รีเซ็ตคะแนนนักเรียนทุกคนเรียบร้อยแล้ว')
      loadData()
    } else {
      showSuccess('ไม่มีนักเรียนให้รีเซ็ตคะแนน')
    }
    setLoading(false)
  }

  const handleVersionPoints = async (versionKey: string, groupsInVersion: any[]) => {
    const { value: formValues } = await Swal.fire({
      title: `ให้คะแนนทุกกลุ่ม`,
      html: `
        <input id="swal-batch-pts" type="number" class="swal2-input" placeholder="จำนวนคะแนน (เช่น 10, -5)">
        <input id="swal-batch-note" type="text" class="swal2-input" placeholder="รายละเอียด/หมายเหตุ">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'บันทึกคะแนนให้ทุกกลุ่ม',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const pts = (document.getElementById('swal-batch-pts') as HTMLInputElement).value
        const note = (document.getElementById('swal-batch-note') as HTMLInputElement).value
        if (!pts) {
          Swal.showValidationMessage('กรุณากรอกคะแนน')
        }
        return { pts: parseInt(pts), note: note || 'ให้คะแนนกลุ่ม (ทั้งหมด)' }
      }
    })

    if (!formValues) return

    setLoading(true)
    let transactions: any[] = []
    groupsInVersion.forEach(g => {
      g.members.forEach((m: any) => {
        transactions.push({
          student_id: m.student_id,
          points: formValues.pts,
          transaction_type: formValues.pts >= 0 ? 'EARN' : 'DEDUCTION',
          source_type: 'MANUAL',
          source_id: g.id,
          note: formValues.note
        })
      })
    })

    const { error } = await supabase.from('point_transactions').insert(transactions)
    if (error) {
      showError('เกิดข้อผิดพลาด', error.message)
    } else {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
      })
      Toast.fire({ icon: 'success', title: `ให้คะแนนทุกกลุ่มสำเร็จ` })
      loadData()
    }
    setLoading(false)
  }

  const handleCustomGroupPoints = async (group: any) => {
    const { value: formValues } = await Swal.fire({
      title: `ให้คะแนน ${group.name}`,
      html: `
        <input id="swal-pts" type="number" class="swal2-input" placeholder="จำนวนคะแนน (เช่น 10, -5)">
        <input id="swal-note" type="text" class="swal2-input" placeholder="รายละเอียด/หัวข้องาน">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'บันทึกคะแนน',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const pts = (document.getElementById('swal-pts') as HTMLInputElement).value
        const note = (document.getElementById('swal-note') as HTMLInputElement).value
        if (!pts) {
          Swal.showValidationMessage('กรุณากรอกคะแนน')
        }
        return { pts: parseInt(pts), note: note || 'ให้คะแนนกลุ่ม' }
      }
    })

    if (formValues) {
      handleGroupPoints(group, formValues.pts, formValues.note)
    }
  }

  const handleVersionInputChange = (versionTime: string, field: 'topic' | 'points', value: string) => {
    setVersionInputs(prev => ({
      ...prev,
      [versionTime]: {
        ...(prev[versionTime] || { topic: '', points: '' }),
        [field]: value
      }
    }))
  }

  const handleVersionTopicBlur = async (versionKey: string, groupsInVersion: any[]) => {
    const inputs = versionInputs[versionKey]
    if (inputs) {
      const groupIds = groupsInVersion.map(g => g.id)
      const updates: any = {}
      if (inputs.topic !== undefined) updates.topic = inputs.topic
      if (inputs.points !== undefined && inputs.points !== '') updates.mission_points = parseInt(inputs.points) || 0
      
      if (Object.keys(updates).length > 0) {
        await supabase.from('student_groups').update(updates).in('id', groupIds)
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1000,
        })
        Toast.fire({ icon: 'success', title: `บันทึกการตั้งค่าแล้ว` })
        // Don't call loadData here to avoid losing focus
      }
    }
  }

  const handleMissionComplete = async (versionKey: string, group: any) => {
    // Get mission points from state or group data
    const inputs = versionInputs[versionKey]
    const pts = inputs?.points ? parseInt(inputs.points) : (group.mission_points || 0)
    
    if (!pts) {
      showError('ยังไม่ได้ตั้งค่าคะแนน', 'กรุณาระบุคะแนนในช่องการตั้งค่าของเวอร์ชันก่อน')
      return
    }

    const { value: formValues } = await Swal.fire({
      title: `ตรวจสอบคะแนน`,
      html: `
        <div class="mb-4 text-sm text-slate-600 font-medium">กลุ่ม: ${group.name}</div>
        <input id="swal-mission-pts" type="number" class="swal2-input !mt-0" value="${pts}" placeholder="ระบุคะแนน">
        <div class="mt-2 text-xs text-slate-500">สามารถแก้ไขคะแนนได้ตามที่ต้องการ</div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'ให้คะแนนและบันทึก',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const inputPts = (document.getElementById('swal-mission-pts') as HTMLInputElement).value
        if (!inputPts) {
          Swal.showValidationMessage('กรุณากรอกคะแนน')
        }
        return { pts: parseInt(inputPts) }
      }
    })

    if (!formValues) return

    const note = (inputs?.topic || group.topic) ? `Mission Complete: ${inputs?.topic || group.topic}` : 'Mission Complete'
    await handleGroupPoints(group, formValues.pts, note)
  }

  const groupedVersions = React.useMemo(() => {
    const versions: Record<string, any[]> = {}
    savedGroups.forEach(g => {
      // Use created_at as version key
      const key = g.created_at
      if (!versions[key]) versions[key] = []
      versions[key].push(g)
    })
    
    // Sort groups within each version by group_points (descending)
    Object.keys(versions).forEach(key => {
      versions[key].sort((a, b) => (b.group_points || 0) - (a.group_points || 0))
    })

    return Object.entries(versions).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
  }, [savedGroups])

  if (loading) return <PageLoading />
  if (!room) return <div className="p-8 text-center text-slate-500">ไม่พบข้อมูลห้องเรียน</div>

  const filteredAvailable = availableStudents.filter(s => 
    s.student_code.includes(searchQuery) || 
    s.first_name.includes(searchQuery) || 
    s.last_name.includes(searchQuery)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/admin/classes')} className="btn-icon btn-ghost bg-white shadow-sm border border-slate-200">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{room.name}</h1>
          <p className="text-slate-500 text-sm">
            รหัสห้อง: {room.room_code} • {(room.education_level as any)?.name} • {(room.academic_year as any)?.name}
          </p>
        </div>
      </div>

      {/* Stats & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-sm text-slate-500 font-medium">จำนวนนักเรียน</p>
            <p className="text-2xl font-bold text-slate-800">{students.length} <span className="text-sm font-normal text-slate-500">/ {room.max_students} คน</span></p>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div>
            <p className="text-sm text-slate-500 font-medium">ที่ว่าง</p>
            <p className="text-2xl font-bold text-green-600">{Math.max(0, room.max_students - students.length)}</p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setShowWheel(true)} className="btn-secondary flex-1 sm:flex-none">🎲 สุ่มชื่อ</button>
          <button onClick={() => setShowGroups(true)} className="btn-secondary flex-1 sm:flex-none">👥 จัดกลุ่ม</button>
          <button 
            onClick={openAddModal} 
            disabled={students.length >= room.max_students}
            className="btn-primary flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" /> เพิ่มนักเรียน
          </button>
        </div>
      </div>

      {/* Classroom Hall of Fame (Podium Style) */}
      {topStudents.length > 0 && (
        <div className="card p-6 bg-gradient-to-b from-slate-900 to-slate-800 border-none relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[150%] bg-amber-500 blur-[120px] rounded-full rotate-12" />
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[150%] bg-purple-500 blur-[120px] rounded-full -rotate-12" />
          </div>

          <div className="flex items-center justify-center mb-12 relative z-10">
            <Trophy className="w-8 h-8 text-amber-400 mr-3 animate-pulse" />
            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-400 tracking-wider">
              HALL OF FAME
            </h3>
          </div>
          
          <div className="flex items-end justify-center gap-2 sm:gap-6 mt-12 mb-4 h-64 relative z-10">
            {/* 2nd Place */}
            {topStudents[1] && (
              <div className="flex flex-col items-center w-28 sm:w-36">
                <div className="relative mb-3 group">
                  <Avatar name={topStudents[1].first_name} src={topStudents[1].avatar_url} size="lg" className="border-4 border-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.5)] transition-transform group-hover:scale-110" />
                </div>
                <div className="w-full bg-gradient-to-t from-slate-400 to-slate-300 h-32 rounded-t-xl shadow-inner flex flex-col items-center pt-3 relative overflow-hidden border-t-2 border-slate-100">
                  <div className="absolute inset-0 bg-white/10" />
                  <span className="text-4xl font-black text-slate-100 drop-shadow-md z-10">2</span>
                  <div className="z-10 text-center mt-2 px-1 w-full">
                    <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">{topStudents[1].first_name}</p>
                    <p className="font-black text-slate-900 text-sm sm:text-base bg-white/30 rounded px-1 mt-1">{topStudents[1].total_points} pt</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 1st Place */}
            {topStudents[0] && (
              <div className="flex flex-col items-center w-32 sm:w-44 z-20">
                <div className="relative mb-3 group">
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]">
                    <Trophy className="w-12 h-12 text-amber-400" />
                  </div>
                  <Avatar name={topStudents[0].first_name} src={topStudents[0].avatar_url} size="xl" className="border-4 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.6)] transition-transform group-hover:scale-110" />
                </div>
                <div className="w-full bg-gradient-to-t from-amber-500 to-yellow-400 h-44 rounded-t-xl shadow-inner flex flex-col items-center pt-3 relative overflow-hidden border-t-2 border-yellow-200">
                  <div className="absolute inset-0 bg-white/20" />
                  <span className="text-6xl font-black text-amber-100 drop-shadow-md z-10">1</span>
                  <div className="z-10 text-center mt-3 px-1 w-full">
                    <p className="font-bold text-amber-950 text-sm sm:text-base truncate">{topStudents[0].first_name}</p>
                    <p className="font-black text-amber-900 text-base sm:text-lg bg-white/40 rounded px-2 mt-1">{topStudents[0].total_points} pt</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 3rd Place */}
            {topStudents[2] && (
              <div className="flex flex-col items-center w-28 sm:w-36">
                <div className="relative mb-3 group">
                  <Avatar name={topStudents[2].first_name} src={topStudents[2].avatar_url} size="lg" className="border-4 border-orange-400 shadow-[0_0_15px_rgba(251,146,60,0.5)] transition-transform group-hover:scale-110" />
                </div>
                <div className="w-full bg-gradient-to-t from-orange-500 to-orange-400 h-24 rounded-t-xl shadow-inner flex flex-col items-center pt-2 relative overflow-hidden border-t-2 border-orange-200">
                  <div className="absolute inset-0 bg-white/10" />
                  <span className="text-3xl font-black text-orange-100 drop-shadow-md z-10">3</span>
                  <div className="z-10 text-center mt-1 px-1 w-full">
                    <p className="font-bold text-orange-950 text-xs sm:text-sm truncate">{topStudents[2].first_name}</p>
                    <p className="font-black text-orange-900 text-sm sm:text-base bg-white/30 rounded px-1 mt-1">{topStudents[2].total_points} pt</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-between items-end border-b border-slate-200">
        <div className="flex gap-6">
          <button 
            onClick={() => setActiveTab('students')}
            className={`pb-3 font-bold text-lg border-b-4 transition-colors ${activeTab === 'students' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid className="inline w-5 h-5 mr-2" />
            รายชื่อนักเรียน ({students.length})
          </button>
          <button 
            onClick={() => setActiveTab('groups')}
            className={`pb-3 font-bold text-lg border-b-4 transition-colors ${activeTab === 'groups' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Users className="inline w-5 h-5 mr-2" />
            กลุ่มที่บันทึกไว้ ({savedGroups.length})
          </button>
        </div>
        
        {activeTab === 'students' && (
          <button 
            onClick={handleResetAllStudents} 
            className="mb-2 btn-secondary text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200 text-sm py-1.5 px-3"
            title="รีเซ็ตคะแนนนักเรียนทุกคนในห้องเป็น 0"
          >
            <RotateCcw className="w-4 h-4 sm:mr-1 inline" />
            <span className="hidden sm:inline">รีเซ็ตคะแนนทุกคน</span>
          </button>
        )}
      </div>

      {activeTab === 'students' && (
        <div>
          {students.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <p className="text-lg font-medium mb-2">ยังไม่มีนักเรียนในห้องนี้</p>
              <button onClick={openAddModal} className="btn-secondary mt-2">เพิ่มนักเรียนคนแรก</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {students.map(s => (
                <div 
                  key={s.id} 
                  className="card p-4 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center text-center relative overflow-hidden group"
                  onClick={() => setViewStudent(s)}
                >
                  {/* Remove student button (shows on hover) */}
                  <button
                    onClick={(e) => handleRemoveStudent(s, e)}
                    className="absolute top-2 right-2 btn-icon btn-ghost bg-white/80 text-slate-400 hover:text-red-600 hover:bg-red-50 w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="นำออกจากห้อง"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>

                  {/* Big Avatar */}
                  <div className="relative mb-3 mt-2">
                    <Avatar name={s.first_name} src={s.avatar_url} className="w-20 h-20 sm:w-24 sm:h-24 text-3xl border-4 border-slate-50 shadow-md transition-transform group-hover:scale-105" />
                    {s.status !== 'ACTIVE' && (
                      <Badge variant="gray" className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap shadow-sm border border-white">
                        {s.status}
                      </Badge>
                    )}
                  </div>

                  {/* Names */}
                  <div className="flex-1 min-w-0 w-full px-1">
                    <p className="font-black text-primary-700 text-base sm:text-lg leading-tight line-clamp-1 w-full">
                      {s.nickname || s.first_name}
                    </p>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1 line-clamp-1">
                      {s.first_name} {s.last_name}
                    </p>
                  </div>

                  {/* Accumulated Points */}
                  <div className="mt-3 mb-4 flex items-center justify-center gap-1 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-100">
                    <span className="font-black text-amber-500 text-xl sm:text-2xl drop-shadow-sm">{(s as any).total_points || 0}</span>
                    <span className="text-[10px] sm:text-xs text-amber-600 font-bold uppercase tracking-wider">pt</span>
                  </div>

                  {/* Quick Buttons */}
                  <div className="flex gap-1 w-full">
                    <button
                      onClick={(e) => handleQuickPoints(s, -1, 'โดนหักคะแนน', e)}
                      className="flex-1 flex items-center justify-center py-2 rounded-lg font-bold text-xs sm:text-sm bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-colors border border-red-100"
                    >-1</button>
                    <button
                      onClick={(e) => handleQuickPoints(s, 1, 'ตอบคำถาม/มีส่วนร่วม', e)}
                      className="flex-1 flex items-center justify-center py-2 rounded-lg font-bold text-xs sm:text-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors border border-emerald-100"
                    >+1</button>
                    <button
                      onClick={(e) => handleQuickPoints(s, 5, 'ทำงานดี/โดดเด่น', e)}
                      className="flex-1 flex items-center justify-center py-2 rounded-lg font-bold text-xs sm:text-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors border border-emerald-100"
                    >+5</button>
                    <button
                      onClick={(e) => handleAdjustPoints(s, e)}
                      className="flex items-center justify-center w-8 sm:w-10 py-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors border border-slate-200"
                      title="กำหนดคะแนนเอง"
                    >
                      <PlusCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="space-y-12">
          {savedGroups.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium mb-2">ยังไม่ได้จัดกลุ่ม หรือยังไม่ได้บันทึกกลุ่ม</p>
              <button onClick={() => setShowGroups(true)} className="btn-secondary mt-2">ไปที่ระบบจัดกลุ่ม</button>
            </div>
          ) : (
            groupedVersions.map(([versionTime, groupsInVersion], vIdx) => {
              const d = new Date(versionTime)
              const versionLabel = `บันทึกเมื่อ ${d.toLocaleDateString('th-TH')} เวลา ${d.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}`
              const isLatest = vIdx === 0

              return (
                <div key={versionTime} className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-2 h-8 rounded-full ${isLatest ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                      <div>
                        <h3 className="text-xl font-bold text-slate-700 flex items-center gap-2">
                          {isLatest ? 'กลุ่มเวอร์ชันล่าสุด' : 'กลุ่มเวอร์ชันเก่า'}
                        </h3>
                        <p className="text-sm font-normal text-slate-500">{versionLabel}</p>
                      </div>
                    </div>
                    
                    {/* Batch Actions */}
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <input 
                        type="text" 
                        placeholder="ชื่อหัวข้องาน... (พิมพ์แล้วคลิกข้างนอกเพื่อบันทึก)" 
                        className="form-input text-sm py-1.5 w-64"
                        value={versionInputs[versionTime]?.topic ?? (groupsInVersion[0]?.topic || '')}
                        onChange={e => handleVersionInputChange(versionTime, 'topic', e.target.value)}
                        onBlur={() => handleVersionTopicBlur(versionTime, groupsInVersion)}
                      />
                      <input 
                        type="number" 
                        placeholder="คะแนนภารกิจ..." 
                        className="form-input text-sm py-1.5 w-32"
                        value={versionInputs[versionTime]?.points ?? (groupsInVersion[0]?.mission_points || '')}
                        onChange={e => handleVersionInputChange(versionTime, 'points', e.target.value)}
                        onBlur={() => handleVersionTopicBlur(versionTime, groupsInVersion)}
                        title="คะแนนที่จะได้รับเมื่อทำภารกิจสำเร็จ"
                      />
                      <button 
                        onClick={() => handleVersionPoints(versionTime, groupsInVersion)}
                        className="text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-4 py-1.5 rounded-lg transition-colors shadow-sm"
                      >
                        ให้คะแนนทุกกลุ่ม
                      </button>
                      <div className="w-px h-6 bg-slate-300 mx-2 hidden sm:block"></div>
                      <button 
                        onClick={() => handleResetVersionPoints(groupsInVersion)}
                        className="text-sm font-bold text-orange-500 hover:text-white bg-orange-50 hover:bg-orange-500 px-4 py-1.5 rounded-lg transition-colors border border-orange-100 hover:border-orange-500"
                        title="รีเซ็ตคะแนนทั้งหมดให้เป็น 0 และยกเลิกสถานะ Mission Complete"
                      >
                        รีเซ็ตคะแนนทุกกลุ่ม
                      </button>
                      <button 
                        onClick={() => handleDeleteVersion(groupsInVersion)}
                        className="text-sm font-bold text-red-500 hover:text-white bg-red-50 hover:bg-red-500 px-4 py-1.5 rounded-lg transition-colors border border-red-100 hover:border-red-500"
                      >
                        ลบทั้งเวอร์ชัน
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pt-2">
                    {groupsInVersion.map((g, index) => (
                      <div key={g.id} className={`card overflow-hidden border-t-4 ${isLatest ? 'border-t-indigo-500 shadow-md hover:shadow-lg' : 'border-t-slate-400 opacity-90 hover:opacity-100 shadow-sm'} transition-all`}>
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-black text-xl ${isLatest ? 'text-indigo-900' : 'text-slate-700'}`}>{g.name}</h3>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase">
                              อันดับ {index + 1}
                            </span>
                          </div>
                          <div className="flex gap-2 items-center">
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">{g.group_points || 0} pt</span>
                            <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{g.members.length} คน</span>
                            <button onClick={() => handleDeleteGroup(g)} className="text-red-400 hover:text-red-600 ml-1 p-1 rounded hover:bg-red-50" title="ลบกลุ่มนี้"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                        
                        <div className="flex bg-slate-50 border-b border-slate-100 divide-x divide-slate-100">
                          <button onClick={() => handleGroupPoints(g, 1, 'ให้คะแนนกลุ่ม')} className="flex-1 py-1.5 text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors">+1</button>
                          <button onClick={() => handleGroupPoints(g, 5, 'ให้คะแนนกลุ่ม')} className="flex-1 py-1.5 text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors">+5</button>
                          <button onClick={() => handleGroupPoints(g, -1, 'หักคะแนนกลุ่ม')} className="flex-1 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors">-1</button>
                          <button onClick={() => handleCustomGroupPoints(g)} className="flex-1 py-1.5 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors" title="ระบุคะแนนเอง">พิมพ์</button>
                        </div>

                        <div className="bg-slate-50 p-2 border-b border-slate-100">
                          <button 
                            onClick={() => handleMissionComplete(versionTime, g)}
                            className={`w-full py-2 text-white text-sm font-bold rounded-lg shadow-sm transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
                              g.is_mission_completed
                                ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700'
                                : 'bg-gradient-to-r from-slate-400 to-slate-500 hover:from-slate-500 hover:to-slate-600'
                            }`}
                          >
                            <Trophy className="w-4 h-4" />
                            {g.is_mission_completed ? 'Mission Completed!' : 'Mission Complete!'}
                          </button>
                        </div>

                        <div className="p-3 flex flex-wrap gap-1.5">
                          {g.members.map((m: any) => (
                            <div key={m.student_id} className={`flex items-center gap-1.5 px-2 py-1 rounded border ${m.is_leader ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                              {m.is_leader && <Trophy className="w-3 h-3 text-amber-500 drop-shadow-sm" />}
                              <span className="text-[13px] font-bold">{m.student?.nickname || m.student?.first_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Add Student Modal */}
      <Modal isOpen={showAddModal} onClose={() => !adding && setShowAddModal(false)} title="เพิ่มนักเรียนเข้าห้อง" size="2xl">
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="ค้นหารหัส, ชื่อ, นามสกุล..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input pl-10"
            />
          </div>
          
          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {filteredAvailable.length === 0 ? (
              <div className="p-8 text-center text-slate-500">ไม่พบนักเรียน</div>
            ) : (
              filteredAvailable.map(s => (
                <label key={s.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                    checked={selectedStudentIds.includes(s.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        if (students.length + selectedStudentIds.length >= room.max_students) {
                          showError('ไม่สามารถเพิ่มได้', 'จำนวนนักเรียนเกินความจุของห้อง')
                          return
                        }
                        setSelectedStudentIds(prev => [...prev, s.id])
                      } else {
                        setSelectedStudentIds(prev => prev.filter(id => id !== s.id))
                      }
                    }}
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.first_name} size="sm" />
                      <div>
                        <p className="font-medium text-slate-800">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{s.student_code}</p>
                      </div>
                    </div>
                    {s.class_room_id && <Badge variant="gray">มีห้องอื่นแล้ว</Badge>}
                  </div>
                </label>
              ))
            )}
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-600">
              เลือกแล้ว: <span className="font-bold text-primary-600">{selectedStudentIds.length}</span> คน 
              (ว่างอีก {Math.max(0, room.max_students - students.length - selectedStudentIds.length)} ที่)
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowAddModal(false)} disabled={adding} className="btn-ghost">ยกเลิก</button>
              <button onClick={handleAddStudents} disabled={adding || selectedStudentIds.length === 0} className="btn-primary">
                {adding ? 'กำลังบันทึก...' : 'เพิ่มลงห้อง'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
      {/* View Student Modal */}
      {viewStudent && (
        <Modal isOpen={!!viewStudent} onClose={() => setViewStudent(null)} title="ข้อมูลนักเรียน" size="2xl">
          <div className="flex flex-col items-center px-6 py-8">
            <div className="relative mb-6">
              <Avatar name={viewStudent.first_name} src={viewStudent.avatar_url} className="w-36 h-36 sm:w-44 sm:h-44 text-5xl border-8 border-slate-50 shadow-lg" />
              {viewStudent.status !== 'ACTIVE' && (
                <Badge variant="gray" className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-sm px-4 py-1 whitespace-nowrap shadow-md border-2 border-white">
                  {viewStudent.status}
                </Badge>
              )}
            </div>
            
            {viewStudent.nickname ? (
              <h2 className="text-4xl sm:text-5xl font-black text-primary-700 text-center mb-1 drop-shadow-sm">{viewStudent.nickname}</h2>
            ) : (
              <h2 className="text-4xl sm:text-5xl font-black text-primary-700 text-center mb-1 drop-shadow-sm">-</h2>
            )}
            <p className="text-slate-500 font-medium text-lg sm:text-xl text-center mb-3">{viewStudent.first_name} {viewStudent.last_name}</p>
            
            {/* Student Level Badge */}
            {(() => {
              const lvl = getStudentLevel((viewStudent as any).total_points || 0)
              if (!lvl) return null
              // standard badge colors
              const variant = (lvl.color === 'slate' ? 'gray' : lvl.color) as any
              return (
                <Badge variant={variant} className="mb-2 px-5 py-1.5 text-base shadow-sm border-2">
                  <Medal className="w-5 h-5 mr-1.5 inline-block" /> 
                  ระดับ: {lvl.name}
                </Badge>
              )
            })()}
            
            <div className="w-full mt-4">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200 flex flex-col items-center shadow-inner relative overflow-hidden">
                {/* Progress bar to next level if available */}
                {(() => {
                  const pts = (viewStudent as any).total_points || 0
                  const lvl = getStudentLevel(pts)
                  if (!lvl || !lvl.max_points) return null
                  const progress = Math.min(100, Math.max(0, ((pts - lvl.min_points) / (lvl.max_points - lvl.min_points)) * 100))
                  return (
                    <div className="absolute bottom-0 left-0 h-1.5 bg-amber-200 w-full">
                      <div className="h-full bg-amber-500" style={{ width: `${progress}%` }}></div>
                    </div>
                  )
                })()}

                <span className="text-lg text-amber-700 font-bold mb-2">พอยต์สะสม (Total Points)</span>
                <div className="flex items-center gap-2 relative z-10">
                  <span className="font-black text-amber-500 text-5xl sm:text-6xl drop-shadow-md">{(viewStudent as any).total_points || 0}</span>
                  <span className="text-2xl text-amber-600 font-bold mt-4">pt</span>
                </div>
                
                {/* Points to next level */}
                {(() => {
                  const pts = (viewStudent as any).total_points || 0
                  const lvl = getStudentLevel(pts)
                  if (!lvl || !lvl.max_points) return null
                  return <span className="text-xs text-amber-600/80 mt-2 font-medium relative z-10">อีก {lvl.max_points - pts + 1} pt เลื่อนขั้น</span>
                })()}
              </div>
            </div>
            
            <div className="w-full mt-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-base font-bold text-slate-700 mb-4 text-center">ปุ่มคะแนนด่วน (Quick Points)</p>
              <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
                <button onClick={(e) => handleQuickPoints(viewStudent, -5, 'โดนหักคะแนน (มาก)', e)} className="px-5 py-3 bg-red-100 text-red-700 font-black text-lg rounded-xl hover:bg-red-500 hover:text-white hover:scale-105 transition-all shadow-sm">-5</button>
                <button onClick={(e) => handleQuickPoints(viewStudent, -1, 'โดนหักคะแนน', e)} className="px-5 py-3 bg-red-50 text-red-600 font-black text-lg rounded-xl hover:bg-red-500 hover:text-white hover:scale-105 transition-all shadow-sm">-1</button>
                <button onClick={(e) => handleQuickPoints(viewStudent, 1, 'ตอบคำถาม/มีส่วนร่วม', e)} className="px-5 py-3 bg-emerald-50 text-emerald-600 font-black text-lg rounded-xl hover:bg-emerald-500 hover:text-white hover:scale-105 transition-all shadow-sm">+1</button>
                <button onClick={(e) => handleQuickPoints(viewStudent, 5, 'ทำงานดี/โดดเด่น', e)} className="px-5 py-3 bg-emerald-100 text-emerald-700 font-black text-lg rounded-xl hover:bg-emerald-500 hover:text-white hover:scale-105 transition-all shadow-sm">+5</button>
                <button onClick={(e) => handleQuickPoints(viewStudent, 10, 'ยอดเยี่ยมมาก', e)} className="px-5 py-3 bg-emerald-200 text-emerald-800 font-black text-lg rounded-xl hover:bg-emerald-600 hover:text-white hover:scale-105 transition-all shadow-sm">+10</button>
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-3 mt-6">
              <button onClick={() => {
                navigate(`/admin/students/register?id=${viewStudent.id}`)
              }} className="btn-secondary w-full">
                แก้ไขข้อมูล
              </button>
              <button onClick={(e) => {
                handleAdjustPoints(viewStudent, e)
              }} className="btn-primary w-full bg-amber-500 hover:bg-amber-600 border-amber-500">
                <PlusCircle className="w-4 h-4" /> กำหนดคะแนนเอง
              </button>
            </div>
    </div>
        </Modal>
      )}

      {/* Wheel Spinner Modal */}
      <Modal isOpen={showWheel} onClose={() => setShowWheel(false)} title="" size="xl" hideHeader>
        <StudentRandomizer students={students} onClose={() => setShowWheel(false)} />
        <button onClick={() => setShowWheel(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">✕</button>
      </Modal>

      {/* Group Generator Modal */}
      <Modal isOpen={showGroups} onClose={() => setShowGroups(false)} title="ระบบสุ่มจัดกลุ่ม" size="7xl">
        <GroupGenerator students={students} roomId={room.id} onClose={() => setShowGroups(false)} onSaved={loadData} />
      </Modal>

    </div>
  )
}
