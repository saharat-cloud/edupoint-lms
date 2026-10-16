import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, AlertCircle } from 'lucide-react'
import { Modal, showSuccess, showError, Spinner } from '../ui/index'
import { supabase } from '../../lib/supabase'
import type { EducationLevel, ClassRoom } from '../../lib/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  educationLevels: EducationLevel[]
  classRooms: ClassRoom[]
}

interface ExcelRow {
  รหัสนักเรียน?: string | number
  ชื่อ?: string
  นามสกุล?: string
  ชื่อเล่น?: string
  อีเมล?: string
  รหัสผ่าน?: string
}

export default function StudentExcelImportModal({ isOpen, onClose, onSuccess, educationLevels, classRooms }: Props) {
  const [levelId, setLevelId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ExcelRow[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: [] as string[] })

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
      { รหัสนักเรียน: '60001', ชื่อ: 'สมชาย', นามสกุล: 'เรียนดี', ชื่อเล่น: 'ชาย', อีเมล: 'somchai@school.local', รหัสผ่าน: 'password123' },
      { รหัสนักเรียน: '60002', ชื่อ: 'สมหญิง', นามสกุล: 'ตั้งใจ', ชื่อเล่น: 'หญิง', อีเมล: 'somying@school.local', รหัสผ่าน: 'password123' }
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    XLSX.writeFile(wb, 'student_template.xlsx')
  }

  async function handleImport() {
    if (!levelId || !roomId) { await showError('กรุณาเลือกระดับชั้นและห้องเรียน'); return }
    if (preview.length === 0) { await showError('ไม่พบข้อมูลในไฟล์'); return }

    setLoading(true)
    setProgress({ current: 0, total: preview.length, errors: [] })
    
    let successCount = 0
    const errs: string[] = []

    for (let i = 0; i < preview.length; i++) {
      const row = preview[i]
      try {
        const studentCode = row.รหัสนักเรียน?.toString().trim()
        const firstName = row.ชื่อ?.trim()
        const lastName = row.นามสกุล?.trim()
        const email = row.อีเมล?.trim()
        const password = row.รหัสผ่าน?.toString().trim()

        if (!studentCode || !firstName || !lastName) {
          throw new Error(`แถวที่ ${i+2}: ข้อมูลไม่ครบถ้วน (ต้องการอย่างน้อย รหัสนักเรียน, ชื่อ, นามสกุล)`)
        }

        if (email && password) {
          const { error } = await supabase.rpc('admin_create_student', {
            p_student_code: studentCode,
            p_first_name: firstName,
            p_last_name: lastName,
            p_nickname: row.ชื่อเล่น?.trim() || '',
            p_card_number: '',
            p_education_level_id: levelId,
            p_class_room_id: roomId,
            p_status: 'ACTIVE',
            p_email: email,
            p_password: password
          })
          if (error) throw error
        } else {
          // No email/password provided, just create the student record
          const { data: existingCode } = await supabase.from('students').select('id').eq('student_code', studentCode).single()
          if (existingCode) throw new Error(`รหัสนักเรียน ${studentCode} มีอยู่ในระบบแล้ว`)
          
          const { error } = await supabase.from('students').insert({
             student_code: studentCode,
             first_name: firstName,
             last_name: lastName,
             nickname: row.ชื่อเล่น?.trim() || '',
             card_number: null,
             education_level_id: levelId,
             class_room_id: roomId,
             status: 'ACTIVE'
          })
          if (error) throw error
        }

        successCount++
      } catch (err: any) {
        errs.push(`แถวที่ ${i+2} (${row.รหัสนักเรียน || '-'}): ${err.message}`)
      }
      setProgress(p => ({ ...p, current: i + 1, errors: errs }))
    }

    setLoading(false)
    if (successCount > 0) {
      await showSuccess(`นำเข้าสำเร็จ ${successCount} รายการ, ล้มเหลว ${errs.length} รายการ`)
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

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : handleClose} title="นำเข้านักเรียนด้วย Excel">
      <div className="space-y-4">
        {/* Step 1 */}
        <div>
          <h3 className="font-bold text-slate-800 mb-2">1. เลือกระดับชั้นและห้องเรียน</h3>
          <div className="grid grid-cols-2 gap-3">
            <select className="form-select" value={levelId} onChange={e => setLevelId(e.target.value)} disabled={loading}>
              <option value="">-- เลือกระดับชั้น --</option>
              {educationLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select className="form-select" value={roomId} onChange={e => setRoomId(e.target.value)} disabled={loading}>
              <option value="">-- เลือกห้องเรียน --</option>
              {classRooms.filter(r => r.education_level_id === levelId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>

        {/* Step 2 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="font-bold text-slate-800">2. อัปโหลดไฟล์ Excel</h3>
              <p className="text-xs text-slate-500">สามารถเว้นอีเมลและรหัสผ่านไว้ก่อน เพื่อให้นักเรียนมาลงทะเบียนทีหลังได้</p>
            </div>
            <button onClick={downloadTemplate} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              <Download className="w-3 h-3" /> โหลดไฟล์ต้นแบบ
            </button>
          </div>
          <input type="file" accept=".xlsx, .xls" onChange={handleFile} disabled={loading} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
        </div>

        {/* Preview */}
        {preview.length > 0 && !loading && (
          <div className="bg-slate-50 p-3 rounded-lg text-sm max-h-40 overflow-auto">
            <p className="font-bold text-slate-700 mb-1">ตัวอย่างข้อมูล ({preview.length} รายการ)</p>
            <ul className="list-disc pl-5 text-slate-600 space-y-1">
              {preview.slice(0, 5).map((r, i) => (
                <li key={i}>{r.รหัสนักเรียน} - {r.ชื่อ} {r.นามสกุล} ({r.อีเมล})</li>
              ))}
              {preview.length > 5 && <li>... และอื่นๆ อีก {preview.length - 5} รายการ</li>}
            </ul>
          </div>
        )}

        {/* Progress & Errors */}
        {loading && (
          <div className="text-center py-4">
            <Spinner />
            <p className="mt-2 text-primary-600 font-bold">กำลังนำเข้า... {progress.current} / {progress.total}</p>
          </div>
        )}

        {progress.errors.length > 0 && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm max-h-32 overflow-auto">
            <div className="flex items-center gap-2 mb-1 font-bold"><AlertCircle className="w-4 h-4" /> พบข้อผิดพลาด:</div>
            <ul className="list-disc pl-5 space-y-1">
              {progress.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={handleClose} disabled={loading} className="btn-secondary">ยกเลิก</button>
          <button onClick={handleImport} disabled={loading || !levelId || !roomId || preview.length === 0} className="btn-primary">
            <Upload className="w-4 h-4" /> ยืนยันการนำเข้า
          </button>
        </div>
      </div>
    </Modal>
  )
}
