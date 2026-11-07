import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, AlertCircle, Sparkles, CheckCircle2, UserCheck, Plus } from 'lucide-react'
import { Modal, showSuccess, showError, Spinner } from '../ui/index'
import { supabase } from '../../lib/supabase'
import type { EducationLevel, ClassRoom } from '../../lib/types'
import voc11Students from '../../data/students_voc1_11.json'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  educationLevels: EducationLevel[]
  classRooms: ClassRoom[]
  initialLevelId?: string
  initialRoomId?: string
}

interface ExcelRow {
  ลำดับ?: string | number
  รหัสนักเรียน?: string | number
  รหัสนักศึกษา?: string | number
  คำนำหน้า?: string
  ชื่อ?: string
  นามสกุล?: string
  ชื่อเล่น?: string
  อีเมล?: string
  รหัสผ่าน?: string
  [key: string]: any
}

export default function StudentExcelImportModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  educationLevels, 
  classRooms,
  initialLevelId = '',
  initialRoomId = ''
}: Props) {
  const [levelId, setLevelId] = useState(initialLevelId)
  const [roomId, setRoomId] = useState(initialRoomId)
  const [, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ExcelRow[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: [] as string[] })
  
  // Options
  const [includePrefix, setIncludePrefix] = useState(false)
  const [autoCreateAuth, setAutoCreateAuth] = useState(true)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [localRooms, setLocalRooms] = useState<ClassRoom[]>(classRooms)

  useEffect(() => {
    setLocalRooms(classRooms)
  }, [classRooms])

  useEffect(() => {
    if (initialLevelId) setLevelId(initialLevelId)
    if (initialRoomId) setRoomId(initialRoomId)
  }, [initialLevelId, initialRoomId, isOpen])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFile(file)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const data = XLSX.utils.sheet_to_json<ExcelRow>(ws)
      setPreview(data)
    }
    reader.readAsBinaryString(file)
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      { รหัสนักศึกษา: '69219010105', คำนำหน้า: 'นางสาว', ชื่อ: 'มนัชนันท์', นามสกุล: 'แก้วผง', ชื่อเล่น: 'เมษา', อีเมล: '69219010105@school.ac.th', รหัสผ่าน: 'std69219010105' },
      { รหัสนักศึกษา: '69219010240', คำนำหน้า: 'นางสาว', ชื่อ: 'เพชรา', นามสกุล: 'โพธิ์พร', ชื่อเล่น: 'นัด', อีเมล: '69219010240@school.ac.th', รหัสผ่าน: 'std69219010240' }
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    XLSX.writeFile(wb, 'student_template.xlsx')
  }

  // Load preset ปวช.1/11 (39 คน)
  function loadPresetVoc11() {
    const mapped = (voc11Students as any[]).map(s => ({
      ลำดับ: s.no,
      รหัสนักศึกษา: s.code,
      คำนำหน้า: s.prefix,
      ชื่อ: s.fname,
      นามสกุล: s.lname,
      ชื่อเล่น: s.nickname,
      อีเมล: `${s.code}@school.ac.th`,
      รหัสผ่าน: `std${s.code}`
    }))
    setPreview(mapped)

    // Try to auto-select Level ปวช.1
    const foundLevel = educationLevels.find(l => l.code === 'V1' || l.name.includes('ปวช.1'))
    if (foundLevel && !levelId) {
      setLevelId(foundLevel.id)
      // Try to auto-select Room ปวช.1/11
      const foundRoom = localRooms.find(r => r.name.includes('1/11') || r.room_code?.includes('11'))
      if (foundRoom) {
        setRoomId(foundRoom.id)
      }
    }
  }

  // Helper to create room if missing
  async function handleQuickCreateRoom() {
    if (!levelId) {
      await showError('กรุณาเลือกระดับชั้นก่อน')
      return
    }
    setCreatingRoom(true)
    try {
      // Find active academic year
      const { data: years } = await supabase.from('academic_years').select('id').eq('status', 'ACTIVE').limit(1)
      const yearId = years?.[0]?.id || null

      const { data: newRoom, error } = await supabase.from('class_rooms').insert({
        name: 'ปวช.1/11',
        room_code: 'V1-11',
        education_level_id: levelId,
        academic_year_id: yearId,
        max_students: 45
      }).select().single()

      if (error) throw error

      if (newRoom) {
        setLocalRooms(prev => [...prev, newRoom as ClassRoom])
        setRoomId(newRoom.id)
        await showSuccess('สร้างห้องเรียนสำเร็จ', 'สร้างห้อง ปวช.1/11 พร้อมสำหรับการนำเข้าแล้ว')
      }
    } catch (err: any) {
      await showError('สร้างห้องเรียนไม่สำเร็จ', err.message)
    } finally {
      setCreatingRoom(false)
    }
  }

  async function handleImport() {
    if (!levelId || !roomId) { await showError('กรุณาเลือกระดับชั้นและห้องเรียน'); return }
    if (preview.length === 0) { await showError('ไม่พบข้อมูลในรายการ'); return }

    setLoading(true)
    setProgress({ current: 0, total: preview.length, errors: [] })
    
    let successCount = 0
    const errs: string[] = []

    for (let i = 0; i < preview.length; i++) {
      const row = preview[i]
      try {
        const studentCode = (row.รหัสนักเรียน || row.รหัสนักศึกษา || row['รหัสประจำตัว'] || row.student_code || row.code)?.toString().trim()
        const prefix = (row.คำนำหน้า || row['คำนำหน้านาม'] || row.prefix || '').toString().trim()
        let firstName = (row.ชื่อ || row.first_name || row.name || '').toString().trim()
        const lastName = (row.นามสกุล || row.last_name || row.surname || '').toString().trim()
        const nickname = (row.ชื่อเล่น || row.nickname || '').toString().trim()

        if (!studentCode || !firstName || !lastName) {
          throw new Error(`แถวที่ ${i+1}: ข้อมูลไม่ครบถ้วน (ต้องการ รหัสนักศึกษา, ชื่อ, นามสกุล)`)
        }

        // Handle title/prefix
        if (includePrefix && prefix && !firstName.startsWith(prefix)) {
          firstName = `${prefix}${firstName}`
        }

        let email = (row.อีเมล || row.email)?.toString().trim()
        let password = (row.รหัสผ่าน || row.password)?.toString().trim()

        if (autoCreateAuth) {
          if (!email) email = `${studentCode}@school.ac.th`
          if (!password) password = `std${studentCode}`
        }

        if (email && password) {
          // Check if already in auth or students
          const { error: rpcErr } = await supabase.rpc('admin_create_student', {
            p_student_code: studentCode,
            p_first_name: firstName,
            p_last_name: lastName,
            p_nickname: nickname,
            p_card_number: '',
            p_education_level_id: levelId,
            p_class_room_id: roomId,
            p_status: 'ACTIVE',
            p_email: email,
            p_password: password
          })
          
          if (rpcErr) {
            // If already exists, fallback to update room assignment
            if (rpcErr.message.includes('รหัสนักเรียนนี้มีในระบบ') || rpcErr.message.includes('นักเรียนนี้มีอยู่แล้ว')) {
              const { error: updErr } = await supabase.from('students')
                .update({ class_room_id: roomId, education_level_id: levelId, updated_at: new Date().toISOString() })
                .eq('student_code', studentCode)
              if (updErr) throw updErr
            } else {
              throw rpcErr
            }
          }
        } else {
          // No email/password provided, just create or update the student record
          const { data: existingCode } = await supabase.from('students').select('id').eq('student_code', studentCode).single()
          if (existingCode) {
            const { error: updErr } = await supabase.from('students')
              .update({ 
                class_room_id: roomId, 
                education_level_id: levelId,
                first_name: firstName,
                last_name: lastName,
                nickname: nickname || null,
                updated_at: new Date().toISOString() 
              })
              .eq('student_code', studentCode)
            if (updErr) throw updErr
          } else {
            const { error: insErr } = await supabase.from('students').insert({
              student_code: studentCode,
              first_name: firstName,
              last_name: lastName,
              nickname: nickname || null,
              card_number: null,
              education_level_id: levelId,
              class_room_id: roomId,
              status: 'ACTIVE'
            })
            if (insErr) throw insErr
          }
        }

        successCount++
      } catch (err: any) {
        errs.push(`แถวที่ ${i+1} (${row.รหัสนักศึกษา || row.รหัสนักเรียน || '-'}): ${err.message}`)
      }
      setProgress(p => ({ ...p, current: i + 1, errors: errs }))
    }

    setLoading(false)
    if (successCount > 0) {
      await showSuccess(`นำเข้าสำเร็จ ${successCount} รายการ`, errs.length > 0 ? `พบข้อผิดพลาด ${errs.length} รายการ` : 'ข้อมูลถูกบันทึกลงห้องเรียนเรียบร้อยแล้ว')
      if (errs.length === 0) {
        onSuccess()
      }
    } else {
      await showError('นำเข้าล้มเหลวทั้งหมด', errs.join('\n'))
    }
  }

  function handleClose() {
    setFile(null)
    setPreview([])
    setProgress({ current: 0, total: 0, errors: [] })
    onClose()
  }

  const roomOptions = localRooms.filter(r => !levelId || r.education_level_id === levelId)

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : handleClose} title="นำเข้านักเรียนด้วย Excel / รายชื่อห้อง" size="2xl">
      <div className="space-y-4">
        {/* Quick action preset for Voc 1/11 */}
        <div className="bg-gradient-to-r from-primary-50 to-indigo-50 border border-primary-200 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-600 text-white rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">รายชื่อนักเรียน ปวช.1/11 (39 คน)</p>
              <p className="text-xs text-slate-600">กดปุ่มเพื่อโหลดรายชื่อนักเรียน 39 คนที่ระบบเตรียมไว้ทันที</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a 
              href="/students_voc1_11.xlsx" 
              download 
              className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1 bg-white hover:bg-slate-50"
              title="ดาวน์โหลดไฟล์ Excel"
            >
              <Download className="w-3.5 h-3.5" /> โหลด .xlsx
            </a>
            <button 
              type="button"
              onClick={loadPresetVoc11}
              className="btn-primary text-xs py-1.5 px-3 flex-1 sm:flex-none flex items-center justify-center gap-1 shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> โหลดข้อมูล ปวช.1/11
            </button>
          </div>
        </div>

        {/* Step 1: Select Level & Room */}
        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs flex items-center justify-center font-bold">1</span>
            เลือกระดับชั้นและห้องเรียน
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">ระดับชั้น *</label>
              <select className="form-select text-sm w-full" value={levelId} onChange={e => { setLevelId(e.target.value); setRoomId('') }} disabled={loading}>
                <option value="">-- เลือกระดับชั้น --</option>
                {educationLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-500 font-medium block">ห้องเรียน *</label>
                {levelId && roomOptions.length === 0 && (
                  <button 
                    type="button" 
                    onClick={handleQuickCreateRoom} 
                    disabled={creatingRoom}
                    className="text-xs text-primary-600 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> สร้างห้อง ปวช.1/11
                  </button>
                )}
              </div>
              <select className="form-select text-sm w-full" value={roomId} onChange={e => setRoomId(e.target.value)} disabled={loading || !levelId}>
                <option value="">-- {levelId ? 'เลือกห้องเรียน' : 'กรุณาเลือกระดับชั้นก่อน'} --</option>
                {roomOptions.map(r => <option key={r.id} value={r.id}>{r.name} ({r.room_code})</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Upload or Check Preview */}
        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs flex items-center justify-center font-bold">2</span>
              ไฟล์หรือข้อมูลนักเรียน
            </h3>
            <button onClick={downloadTemplate} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              <Download className="w-3 h-3" /> ไฟล์ต้นแบบเปล่า
            </button>
          </div>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFile} 
            disabled={loading} 
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer" 
          />

          {/* Options */}
          <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={autoCreateAuth} 
                onChange={e => setAutoCreateAuth(e.target.checked)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" 
              />
              <span className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-primary-600" />
                สร้างบัญชีเข้าระบบอัตโนมัติ (รหัสผ่านเริ่มต้น: std + รหัสนักศึกษา)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={includePrefix} 
                onChange={e => setIncludePrefix(e.target.checked)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" 
              />
              <span>รวมคำนำหน้าเข้ากับชื่อจริง (เช่น นางสาวมนัชนันท์)</span>
            </label>
          </div>
        </div>

        {/* Preview Table */}
        {preview.length > 0 && !loading && (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-100/90 px-3 py-2 flex items-center justify-between border-b border-slate-200">
              <p className="font-bold text-xs text-slate-700">
                พร้อมนำเข้าทั้งหมด <span className="text-primary-600 font-extrabold">{preview.length}</span> คน
              </p>
              <button onClick={() => setPreview([])} className="text-xs text-slate-400 hover:text-red-500">
                ล้างข้อมูล
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 sticky top-0 font-medium">
                  <tr>
                    <th className="py-1.5 px-3">#</th>
                    <th className="py-1.5 px-3">รหัส</th>
                    <th className="py-1.5 px-3">ชื่อ - สกุล</th>
                    <th className="py-1.5 px-3">ชื่อเล่น</th>
                    <th className="py-1.5 px-3">อีเมลเข้าสู่ระบบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {preview.map((r, i) => {
                    const code = r.รหัสนักศึกษา || r.รหัสนักเรียน || '-'
                    const pfx = r.คำนำหน้า || ''
                    const fn = r.ชื่อ || ''
                    const ln = r.นามสกุล || ''
                    const nn = r.ชื่อเล่น || '-'
                    const em = r.อีเมล || `${code}@school.ac.th`
                    return (
                      <tr key={i} className="hover:bg-slate-50/70">
                        <td className="py-1.5 px-3 text-slate-400">{i + 1}</td>
                        <td className="py-1.5 px-3 font-mono font-medium text-slate-800">{code}</td>
                        <td className="py-1.5 px-3">{pfx} {fn} {ln}</td>
                        <td className="py-1.5 px-3 text-slate-500">{nn}</td>
                        <td className="py-1.5 px-3 text-slate-500 font-mono text-[11px]">{em}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Progress & Errors */}
        {loading && (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
            <Spinner />
            <p className="mt-2 text-primary-600 font-bold text-sm">กำลังบันทึกนักเรียนเข้าระบบ... {progress.current} / {progress.total}</p>
            <p className="text-xs text-slate-500 mt-1">กรุณารอสักครู่ กำลังผูกห้องเรียนและสร้างบัญชีผู้ใช้งาน</p>
          </div>
        )}

        {progress.errors.length > 0 && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs max-h-32 overflow-auto border border-red-200">
            <div className="flex items-center gap-1.5 mb-1 font-bold"><AlertCircle className="w-4 h-4 text-red-500" /> พบข้อผิดพลาด:</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {progress.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={handleClose} disabled={loading} className="btn-secondary text-sm">ยกเลิก</button>
          <button 
            onClick={handleImport} 
            disabled={loading || !levelId || !roomId || preview.length === 0} 
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" /> ยืนยันการนำเข้า ({preview.length} คน)
          </button>
        </div>
      </div>
    </Modal>
  )
}
