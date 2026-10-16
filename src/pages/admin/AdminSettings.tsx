import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AcademicYear, Semester, EducationLevel, PointSetting, PointLevel } from '../../lib/types'
import { SectionHeader, PageLoading, showSuccess, showError, confirmDelete, Spinner, Badge } from '../../components/ui/index'

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'academic' | 'levels' | 'grade_rules' | 'points'>('academic')
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [levels, setLevels] = useState<EducationLevel[]>([])
  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)
  const [pointLevels, setPointLevels] = useState<PointLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Academic year form
  const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '', status: 'UPCOMING' as AcademicYear['status'] })
  // Semester form
  const [semForm, setSemForm] = useState({ academic_year_id: '', name: '', start_date: '', end_date: '', status: 'UPCOMING' as Semester['status'] })
  // Education level form
  const [levelForm, setLevelForm] = useState({ name: '', code: '', description: '', sort_order: 0 })
  // Point level form
  const [pointLevelForm, setPointLevelForm] = useState({ name: '', min_points: 0, max_points: 0, color: 'slate', sort_order: 1 })
  const [editPointLevelId, setEditPointLevelId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [yrRes, semRes, lvlRes, pSetRes, pLvlRes] = await Promise.all([
      supabase.from('academic_years').select('*').order('name', { ascending: false }),
      supabase.from('semesters').select('*, academic_year:academic_years(name)').order('start_date', { ascending: false }),
      supabase.from('education_levels').select('*').order('sort_order'),
      supabase.from('point_settings').select('*').single(),
      supabase.from('point_levels').select('*').order('sort_order'),
    ])
    if (yrRes.data) setAcademicYears(yrRes.data)
    if (semRes.data) setSemesters(semRes.data as Semester[])
    if (lvlRes.data) setLevels(lvlRes.data)
    if (pSetRes.data) setPointSetting(pSetRes.data)
    if (pLvlRes.data) setPointLevels(pLvlRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addAcademicYear() {
    if (!yearForm.name || !yearForm.start_date || !yearForm.end_date) { await showError('กรุณากรอกข้อมูลให้ครบ'); return }
    setSaving(true)

    // Check for duplicate name
    const { data: existing } = await supabase.from('academic_years').select('id').eq('name', yearForm.name).single()
    if (existing) {
      await showError('ปีการศึกษานี้มีอยู่แล้ว')
      setSaving(false)
      return
    }

    if (yearForm.status === 'ACTIVE') {
      await supabase.from('academic_years').update({ status: 'CLOSED' }).neq('status', 'CLOSED')
    }

    const { error } = await supabase.from('academic_years').insert(yearForm)
    if (error) { await showError('เกิดข้อผิดพลาด', error.message) }
    else { await showSuccess('เพิ่มปีการศึกษาสำเร็จ'); setYearForm({ name: '', start_date: '', end_date: '', status: 'UPCOMING' }); load() }
    setSaving(false)
  }

  async function addSemester() {
    if (!semForm.academic_year_id || !semForm.name || !semForm.start_date || !semForm.end_date) { await showError('กรุณากรอกข้อมูลให้ครบ'); return }
    setSaving(true)

    // Check for duplicate name
    const { data: existing } = await supabase.from('semesters').select('id').eq('academic_year_id', semForm.academic_year_id).eq('name', semForm.name).single()
    if (existing) {
      await showError('ภาคเรียนนี้มีอยู่แล้วในปีการศึกษานี้')
      setSaving(false)
      return
    }

    if (semForm.status === 'ACTIVE') {
      await supabase.from('semesters').update({ status: 'CLOSED' }).eq('academic_year_id', semForm.academic_year_id).neq('status', 'CLOSED')
    }

    const { error } = await supabase.from('semesters').insert(semForm)
    if (error) { await showError('เกิดข้อผิดพลาด', error.message) }
    else { await showSuccess('เพิ่มภาคเรียนสำเร็จ'); setSemForm({ academic_year_id: '', name: '', start_date: '', end_date: '', status: 'UPCOMING' }); load() }
    setSaving(false)
  }

  async function addLevel() {
    if (!levelForm.name || !levelForm.code) { await showError('กรุณากรอกชื่อและรหัสระดับ'); return }
    const { error } = await supabase.from('education_levels').insert(levelForm)
    if (error) { await showError('เกิดข้อผิดพลาด', error.message) }
    else { await showSuccess('เพิ่มระดับสำเร็จ'); setLevelForm({ name: '', code: '', description: '', sort_order: 0 }); load() }
  }

  async function deleteLevel(id: string) {
    const ok = await confirmDelete('ลบระดับการศึกษา', 'ต้องการลบระดับการศึกษานี้ใช่หรือไม่? อาจส่งผลกระทบต่อข้อมูลที่มีการอ้างอิง')
    if (!ok) return
    const { error } = await supabase.from('education_levels').delete().eq('id', id)
    if (error) { 
      if (error.code === '23503' || error.message.includes('foreign key constraint')) {
        await showError('ไม่สามารถลบได้', 'ไม่สามารถลบระดับการศึกษานี้ได้ เนื่องจากมี "ห้องเรียน" หรือข้อมูลอื่นที่ใช้งานระดับชั้นนี้อยู่ กรุณาลบห้องเรียนที่เกี่ยวข้องออกก่อน')
      } else {
        await showError('เกิดข้อผิดพลาด', error.message)
      }
    }
    else { await showSuccess('ลบระดับสำเร็จ'); load() }
  }

  async function setActiveYear(id: string) {
    await supabase.from('academic_years').update({ status: 'CLOSED' }).neq('id', id)
    await supabase.from('academic_years').update({ status: 'ACTIVE' }).eq('id', id)
    await showSuccess('เปลี่ยนปีการศึกษาปัจจุบันสำเร็จ')
    load()
  }

  async function setActiveSemester(id: string, academic_year_id: string) {
    await supabase.from('semesters').update({ status: 'CLOSED' }).eq('academic_year_id', academic_year_id).neq('id', id)
    await supabase.from('semesters').update({ status: 'ACTIVE' }).eq('id', id)
    await showSuccess('เปลี่ยนภาคเรียนปัจจุบันสำเร็จ')
    load()
  }

  async function updateTermMaxPoints(points: number) {
    if (!pointSetting) return
    const { error } = await supabase.from('point_settings').update({ term_max_points: points, updated_at: new Date().toISOString() }).eq('id', pointSetting.id)
    if (error) { await showError('เกิดข้อผิดพลาด', error.message) }
    else { await showSuccess('อัปเดตพอยต์สูงสุดสำเร็จ'); load() }
  }

  async function addPointLevel() {
    if (!pointLevelForm.name || pointLevelForm.min_points < 0) { await showError('กรุณากรอกชื่อและคะแนนขั้นต่ำ'); return }
    
    // Check for overlap
    const newMin = pointLevelForm.min_points
    const newMax = pointLevelForm.max_points || null
    if (newMax !== null && newMin >= newMax) {
      await showError('พอยต์ไม่ถูกต้อง', 'คะแนนขั้นต่ำต้องน้อยกว่าคะแนนสูงสุด')
      return
    }

    if (pointSetting) {
      if (newMin > pointSetting.term_max_points) {
        await showError('พอยต์ไม่ถูกต้อง', `คะแนนขั้นต่ำต้องไม่เกินเป้าหมายพอยต์สูงสุดของเทอม (${pointSetting.term_max_points})`)
        return
      }
      if (newMax !== null && newMax > pointSetting.term_max_points) {
        await showError('พอยต์ไม่ถูกต้อง', `คะแนนสูงสุดต้องไม่เกินเป้าหมายพอยต์สูงสุดของเทอม (${pointSetting.term_max_points})`)
        return
      }
    }

    const hasOverlap = pointLevels.some(lvl => {
      if (editPointLevelId && lvl.id === editPointLevelId) return false
      const lvlMin = lvl.min_points
      const lvlMax = lvl.max_points
      return (newMax === null || newMax >= lvlMin) && (lvlMax === null || newMin <= lvlMax)
    })

    if (hasOverlap) {
      await showError('คะแนนซ้ำซ้อน', 'ช่วงคะแนนนี้มีการทับซ้อนกับระดับอื่นที่มีอยู่แล้ว กรุณาตรวจสอบอีกครั้ง')
      return
    }
    
    if (editPointLevelId) {
      const { error } = await supabase.from('point_levels').update({
        name: pointLevelForm.name,
        min_points: pointLevelForm.min_points,
        max_points: pointLevelForm.max_points || null,
        color: pointLevelForm.color
      }).eq('id', editPointLevelId)
      
      if (error) { await showError('เกิดข้อผิดพลาด', error.message) }
      else { 
        await showSuccess('แก้ไขเลเวลสำเร็จ')
        setEditPointLevelId(null)
        setPointLevelForm({ name: '', min_points: 0, max_points: 0, color: 'slate', sort_order: pointLevels.length + 2 })
        load() 
      }
    } else {
      const { error } = await supabase.from('point_levels').insert({
        name: pointLevelForm.name,
        min_points: pointLevelForm.min_points,
        max_points: pointLevelForm.max_points || null,
        color: pointLevelForm.color,
        sort_order: pointLevelForm.sort_order
      })
      if (error) { await showError('เกิดข้อผิดพลาด', error.message) }
      else { 
        await showSuccess('เพิ่มเลเวลสำเร็จ')
        setPointLevelForm({ name: '', min_points: 0, max_points: 0, color: 'slate', sort_order: pointLevels.length + 2 })
        load() 
      }
    }
  }

  function startEditPointLevel(lvl: PointLevel) {
    setEditPointLevelId(lvl.id)
    setPointLevelForm({
      name: lvl.name,
      min_points: lvl.min_points,
      max_points: lvl.max_points || 0,
      color: lvl.color,
      sort_order: lvl.sort_order
    })
  }

  function cancelEditPointLevel() {
    setEditPointLevelId(null)
    setPointLevelForm({ name: '', min_points: 0, max_points: 0, color: 'slate', sort_order: pointLevels.length + 2 })
  }

  async function deletePointLevel(id: string) {
    const ok = await confirmDelete('ลบเลเวลนี้', 'ต้องการลบเลเวลนี้ใช่หรือไม่?')
    if (!ok) return
    const { error } = await supabase.from('point_levels').delete().eq('id', id)
    if (error) { await showError('เกิดข้อผิดพลาด', error.message) }
    else { await showSuccess('ลบเลเวลสำเร็จ'); load() }
  }

  if (loading) return <PageLoading />

  const tabs = [
    { id: 'academic' as const, label: 'ปีการศึกษา / ภาคเรียน' },
    { id: 'levels' as const, label: 'ระดับการศึกษา' },
    { id: 'points' as const, label: 'ตั้งค่าพอยต์/เลเวล' },
    { id: 'grade_rules' as const, label: 'เกณฑ์เกรด' },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader title="ตั้งค่าระบบ" subtitle="จัดการข้อมูลหลักของสถานศึกษา" />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'academic' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Academic Years */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-800">ปีการศึกษา</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">ชื่อปีการศึกษา</label>
                <input className="form-input" value={yearForm.name} onChange={e => setYearForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น 2568" /></div>
              <div><label className="form-label">สถานะ</label>
                <select className="form-select" value={yearForm.status} onChange={e => setYearForm(f => ({ ...f, status: e.target.value as AcademicYear['status'] }))}>
                  <option value="UPCOMING">กำลังจะมาถึง</option>
                  <option value="ACTIVE">ปัจจุบัน</option>
                  <option value="CLOSED">ปิดแล้ว</option>
                </select></div>
              <div><label className="form-label">วันเริ่มต้น</label>
                <input type="date" className="form-input" value={yearForm.start_date} onChange={e => setYearForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><label className="form-label">วันสิ้นสุด</label>
                <input type="date" className="form-input" value={yearForm.end_date} onChange={e => setYearForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <button onClick={addAcademicYear} disabled={saving} className="btn-primary w-full">
              {saving ? <Spinner size="sm" className="text-white" /> : <><Plus className="w-4 h-4" /> เพิ่มปีการศึกษา</>}
            </button>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {academicYears.map(y => (
                <div key={y.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{y.name}</p>
                    <p className="text-xs text-slate-500">{y.start_date} – {y.end_date}</p>
                  </div>
                  <Badge variant={y.status === 'ACTIVE' ? 'green' : y.status === 'UPCOMING' ? 'blue' : 'gray'}>
                    {y.status === 'ACTIVE' ? 'ปัจจุบัน' : y.status === 'UPCOMING' ? 'กำลังจะมา' : 'ปิดแล้ว'}
                  </Badge>
                  {y.status !== 'ACTIVE' && (
                    <button onClick={() => setActiveYear(y.id)} className="btn-secondary btn-sm text-xs">ตั้งเป็นปัจจุบัน</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Semesters */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-800">ภาคเรียน</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="form-label">ปีการศึกษา</label>
                <select className="form-select" value={semForm.academic_year_id} onChange={e => setSemForm(f => ({ ...f, academic_year_id: e.target.value }))}>
                  <option value="">-- เลือกปีการศึกษา --</option>
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select></div>
              <div><label className="form-label">ชื่อภาคเรียน</label>
                <input className="form-input" value={semForm.name} onChange={e => setSemForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น ภาคเรียนที่ 1" /></div>
              <div><label className="form-label">สถานะ</label>
                <select className="form-select" value={semForm.status} onChange={e => setSemForm(f => ({ ...f, status: e.target.value as Semester['status'] }))}>
                  <option value="UPCOMING">กำลังจะมา</option>
                  <option value="ACTIVE">ปัจจุบัน</option>
                  <option value="CLOSED">ปิดแล้ว</option>
                </select></div>
              <div><label className="form-label">วันเริ่มต้น</label>
                <input type="date" className="form-input" value={semForm.start_date} onChange={e => setSemForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><label className="form-label">วันสิ้นสุด</label>
                <input type="date" className="form-input" value={semForm.end_date} onChange={e => setSemForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <button onClick={addSemester} disabled={saving} className="btn-primary w-full">
              {saving ? <Spinner size="sm" className="text-white" /> : <><Plus className="w-4 h-4" /> เพิ่มภาคเรียน</>}
            </button>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {semesters.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-slate-500">{(s.academic_year as Record<string, string> | undefined)?.name} • {s.start_date} – {s.end_date}</p>
                  </div>
                  <Badge variant={s.status === 'ACTIVE' ? 'green' : s.status === 'UPCOMING' ? 'blue' : 'gray'}>
                    {s.status === 'ACTIVE' ? 'ปัจจุบัน' : s.status === 'UPCOMING' ? 'กำลังจะมา' : 'ปิดแล้ว'}
                  </Badge>
                  {s.status !== 'ACTIVE' && (
                    <button onClick={() => setActiveSemester(s.id, s.academic_year_id)} className="btn-secondary btn-sm text-xs">ตั้งเป็นปัจจุบัน</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'levels' && (
        <div className="max-w-lg space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-800">ระดับการศึกษา</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">ชื่อระดับ</label>
                <input className="form-input" value={levelForm.name} onChange={e => setLevelForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น ปวช.1" /></div>
              <div><label className="form-label">รหัส</label>
                <input className="form-input" value={levelForm.code} onChange={e => setLevelForm(f => ({ ...f, code: e.target.value }))} placeholder="เช่น V1" /></div>
              <div><label className="form-label">รายละเอียด</label>
                <input className="form-input" value={levelForm.description} onChange={e => setLevelForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><label className="form-label">ลำดับ</label>
                <input type="number" className="form-input" value={levelForm.sort_order} onChange={e => setLevelForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <button onClick={addLevel} className="btn-primary w-full"><Plus className="w-4 h-4" /> เพิ่มระดับ</button>
          </div>
          <div className="space-y-2">
            {levels.map(l => (
              <div key={l.id} className="card p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 font-bold text-xs">{l.sort_order}</div>
                <div className="flex-1">
                  <p className="font-medium">{l.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{l.code}</p>
                </div>
                <button 
                  onClick={() => deleteLevel(l.id)} 
                  className="btn-icon btn-ghost text-slate-400 hover:text-red-500"
                  title="ลบระดับการศึกษา"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'points' && (
        <div className="space-y-6 max-w-4xl">
          {!pointSetting && (
            <div className="alert-warning">
              <p className="font-bold">ยังไม่ได้ติดตั้งระบบพอยต์!</p>
              <p>กรุณารันคำสั่ง SQL ในไฟล์ <code>013_point_levels.sql</code> ใน Supabase เพื่อสร้างฐานข้อมูลสำหรับระบบนี้</p>
            </div>
          )}
          
          {pointSetting && (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Point Goal */}
              <div className="lg:col-span-1">
                <div className="card p-5 space-y-4">
                  <h3 className="font-bold text-slate-800">เป้าหมายพอยต์สูงสุด (เทอมนี้)</h3>
                  <div>
                    <label className="form-label">พอยต์เป้าหมาย</label>
                    <input 
                      type="number" 
                      className="form-input text-2xl font-black text-amber-500" 
                      value={pointSetting.term_max_points} 
                      onChange={e => setPointSetting({ ...pointSetting, term_max_points: parseInt(e.target.value) || 0 })} 
                    />
                  </div>
                  <button onClick={() => updateTermMaxPoints(pointSetting.term_max_points)} className="btn-primary w-full">บันทึกเป้าหมาย</button>
                  <p className="text-xs text-slate-500 mt-2">นักเรียนจะเห็นพอยต์สะสมของตนเองเทียบกับเป้าหมายนี้</p>
                </div>
              </div>

              {/* Point Levels (Ranks) */}
              <div className="lg:col-span-2 space-y-4">
                <div className="card p-5 space-y-4">
                  <h3 className="font-bold text-slate-800">จัดการเลเวล (ยศ/ระดับ)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2"><label className="form-label">ชื่อเลเวล (เช่น Novice)</label>
                      <input className="form-input" value={pointLevelForm.name} onChange={e => setPointLevelForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อเลเวล" /></div>
                    <div><label className="form-label">พอยต์ขั้นต่ำ</label>
                      <input type="number" className="form-input" value={pointLevelForm.min_points} onChange={e => setPointLevelForm(f => ({ ...f, min_points: parseInt(e.target.value) || 0 }))} /></div>
                    <div><label className="form-label">พอยต์สูงสุด</label>
                      <input type="number" className="form-input" value={pointLevelForm.max_points} onChange={e => setPointLevelForm(f => ({ ...f, max_points: parseInt(e.target.value) || 0 }))} placeholder="ไม่มีขีดจำกัด = 0" /></div>
                    <div><label className="form-label">สี</label>
                      <select className="form-select" value={pointLevelForm.color} onChange={e => setPointLevelForm(f => ({ ...f, color: e.target.value }))}>
                        <option value="slate">เทา</option>
                        <option value="green">เขียว</option>
                        <option value="blue">น้ำเงิน</option>
                        <option value="purple">ม่วง</option>
                        <option value="amber">ทอง</option>
                        <option value="red">แดง</option>
                      </select>
                    </div>
                  </div>
                  {editPointLevelId ? (
                    <div className="flex gap-2">
                      <button onClick={addPointLevel} className="btn-primary flex-1"><Save className="w-4 h-4 mr-2" /> บันทึกการแก้ไข</button>
                      <button onClick={cancelEditPointLevel} className="btn-secondary flex-1">ยกเลิก</button>
                    </div>
                  ) : (
                    <button onClick={addPointLevel} className="btn-primary w-full"><Plus className="w-4 h-4 mr-2" /> เพิ่มเลเวลใหม่</button>
                  )}
                </div>

                <div className="space-y-2">
                  {pointLevels.map(lvl => {
                    const colorMap: Record<string, { bg: string, text: string }> = {
                      slate: { bg: 'bg-slate-500', text: 'text-slate-700' },
                      green: { bg: 'bg-green-500', text: 'text-green-700' },
                      blue: { bg: 'bg-blue-500', text: 'text-blue-700' },
                      purple: { bg: 'bg-purple-500', text: 'text-purple-700' },
                      amber: { bg: 'bg-amber-500', text: 'text-amber-700' },
                      red: { bg: 'bg-red-500', text: 'text-red-700' }
                    }
                    const c = colorMap[lvl.color] || colorMap.slate
                    return (
                    <div key={lvl.id} className="card p-4 flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-white ${c.bg} shadow-md`}>
                        {lvl.sort_order}
                      </div>
                      <div className="flex-1">
                        <p className={`font-black text-lg ${c.text}`}>{lvl.name}</p>
                        <p className="text-sm text-slate-500">พอยต์ {lvl.min_points} {lvl.max_points ? `- ${lvl.max_points}` : 'ขึ้นไป'}</p>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => startEditPointLevel(lvl)} 
                          className="btn-icon btn-ghost text-slate-400 hover:text-primary-600"
                          title="แก้ไขเลเวล"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button 
                          onClick={() => deletePointLevel(lvl.id)} 
                          className="btn-icon btn-ghost text-slate-400 hover:text-red-500"
                          title="ลบเลเวล"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'grade_rules' && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-4">เกณฑ์การให้เกรด</h3>
          <div className="alert-info">
            <span>📊</span>
            <p>จัดการเกณฑ์เกรดในหน้า Gradebook ของครู สามารถสร้างเกณฑ์แยกตามวิชาและภาคเรียนได้</p>
          </div>
        </div>
      )}
    </div>
  )
}
