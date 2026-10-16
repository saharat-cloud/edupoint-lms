import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, BookOpen, GraduationCap, Building2, Activity, Trophy, Crown, Medal, Award, Flame, Star, Zap, Sparkles } from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '../../lib/supabase'
import { StatCard, SectionHeader, PageLoading, ErrorState, Avatar } from '../../components/ui/index'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    students: 0, teachers: 0, subjects: 0, classRooms: 0, activities: 0,
  })
  const [topStudents, setTopStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fireConfetti = () => {
    // Center golden burst
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#fbbf24', '#f59e0b', '#d97706', '#38bdf8', '#a855f7', '#ec4899']
    })
    // Left cannon
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 60,
        origin: { x: 0.1, y: 0.65 },
        colors: ['#fbbf24', '#f59e0b', '#ec4899', '#3b82f6']
      })
    }, 200)
    // Right cannon
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 60,
        origin: { x: 0.9, y: 0.65 },
        colors: ['#fbbf24', '#f59e0b', '#10b981', '#8b5cf6']
      })
    }, 400)
  }

  useEffect(() => {
    async function load() {
      try {
        const [studentsRes, teachers, subjects, classRooms, activities] = await Promise.all([
          supabase.from('students').select('id, first_name, last_name, nickname, avatar_url, class_room:class_rooms(name), student_total_points(total_points)'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'TEACHER'),
          supabase.from('subjects').select('id', { count: 'exact', head: true }),
          supabase.from('class_rooms').select('id', { count: 'exact', head: true }),
          supabase.from('activities').select('id', { count: 'exact', head: true }),
        ])
        
        const allStudents = (studentsRes.data || []).map((s: any) => {
          let pts = 0
          if (s.student_total_points) {
            pts = Array.isArray(s.student_total_points) 
              ? (s.student_total_points[0]?.total_points || 0) 
              : (s.student_total_points.total_points || 0)
          }
          return { ...s, total_points: pts }
        })
        
        const sortedStudents = allStudents.sort((a, b) => b.total_points - a.total_points)
        setTopStudents(sortedStudents.slice(0, 3))

        setStats({
          students: allStudents.length,
          teachers: teachers.count || 0,
          subjects: subjects.count || 0,
          classRooms: classRooms.count || 0,
          activities: activities.count || 0,
        })

        // Auto trigger celebratory confetti upon page load
        if (sortedStudents.length > 0) {
          setTimeout(() => {
            fireConfetti()
          }, 350)
        }
      } catch {
        setError('ไม่สามารถโหลดข้อมูลได้')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <PageLoading />
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />

  return (
    <div className="space-y-6">
      <SectionHeader
        title="แดชบอร์ดผู้ดูแลระบบ"
        subtitle="ภาพรวมทั้งหมดของระบบ EduPoint"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => navigate('/admin/students')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>👤</span> เพิ่มนักเรียน
            </button>
            <button
              onClick={() => navigate('/admin/students/register')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>💳</span> ลงทะเบียนบัตร
            </button>
            <button
              onClick={() => navigate('/admin/classes')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>🏫</span> จัดการห้องเรียน
            </button>
            <button
              onClick={() => navigate('/admin/settings')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>⚙️</span> ตั้งค่าระบบ
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          title="นักเรียนทั้งหมด"
          value={stats.students}
          icon={<Users className="w-5 h-5" />}
          color="bg-primary-500"
          onClick={() => navigate('/admin/students')}
        />
        <StatCard
          title="ครูทั้งหมด"
          value={stats.teachers}
          icon={<GraduationCap className="w-5 h-5" />}
          color="bg-emerald-500"
          onClick={() => navigate('/admin/teachers')}
        />
        <StatCard
          title="วิชา"
          value={stats.subjects}
          icon={<BookOpen className="w-5 h-5" />}
          color="bg-violet-500"
          onClick={() => navigate('/admin/subjects')}
        />
        <StatCard
          title="ห้องเรียน"
          value={stats.classRooms}
          icon={<Building2 className="w-5 h-5" />}
          color="bg-amber-500"
          onClick={() => navigate('/admin/classes')}
        />
        <StatCard
          title="กิจกรรม"
          value={stats.activities}
          icon={<Activity className="w-5 h-5" />}
          color="bg-rose-500"
        />
      </div>

      {/* Hall of Fame Leaderboard — TOP 3 Grand Arena */}
      <div className="card p-6 sm:p-8 bg-gradient-to-b from-[#090d16] via-[#0f172a] to-[#070a12] border border-amber-500/20 relative overflow-hidden shadow-2xl rounded-3xl">
        {/* Ambient atmospheric spotlights & particle effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Spotlight on 1st place */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[340px] sm:w-[520px] h-[450px] bg-gradient-to-b from-amber-400/25 via-yellow-500/10 to-transparent blur-3xl rounded-full" />
          {/* Side auroras */}
          <div className="absolute -top-24 -left-20 w-80 h-80 bg-blue-600/15 blur-[100px] rounded-full" />
          <div className="absolute -top-24 -right-20 w-80 h-80 bg-purple-600/15 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        {/* Top Header Banner */}
        <div className="flex items-center justify-between gap-4 mb-8 relative z-10 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.6)]">
              <Trophy className="w-7 h-7 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 tracking-wider">
                  HALL OF FAME
                </h3>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 uppercase tracking-widest">
                  TOP 3
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 inline" /> สุดยอด 3 นักเรียนคะแนนสะสมสูงสุดแห่งเกียรติยศ
              </p>
            </div>
          </div>
        </div>

        {topStudents.length === 0 ? (
          <div className="text-center py-16 text-slate-400 relative z-10">
            <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-3 opacity-50" />
            <p className="text-base font-semibold">ยังไม่มีข้อมูลคะแนนนักเรียนในระบบ</p>
          </div>
        ) : (
          <div className="relative z-10">
            {/* The 3 Grand Podiums Stage */}
            <div className="flex items-end justify-center gap-3 sm:gap-6 md:gap-10 pt-16 pb-2 min-h-[360px] sm:min-h-[420px] max-w-4xl mx-auto">
              
              {/* ================= 2ND PLACE (SILVER) ================= */}
              {topStudents[1] ? (
                <div className="flex flex-col items-center w-28 sm:w-44 md:w-52 transition-transform duration-300 hover:-translate-y-1">
                  {/* Floating Silver Badge & Avatar */}
                  <div className="relative mb-3 flex flex-col items-center">
                    <div className="absolute -top-11 left-1/2 -translate-x-1/2 flex flex-col items-center drop-shadow-[0_0_15px_rgba(226,232,240,0.9)]">
                      <Medal className="w-8 h-8 sm:w-9 sm:h-9 text-slate-200 fill-slate-300" />
                      <span className="text-[9px] font-bold text-slate-200 bg-slate-900/90 px-2 py-0.5 rounded-full border border-slate-400/40 uppercase whitespace-nowrap mt-0.5">
                        2ND PLACE
                      </span>
                    </div>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-300/20 blur-md absolute -top-1 left-1/2 -translate-x-1/2" />
                    <Avatar
                      name={topStudents[1].first_name}
                      src={topStudents[1].avatar_url}
                      size="lg"
                      className="border-4 border-slate-200 shadow-[0_0_25px_rgba(203,213,225,0.7)] ring-2 ring-slate-400/50 sm:w-20 sm:h-20"
                    />
                  </div>

                  {/* Silver Pillar */}
                  <div className="w-full bg-gradient-to-t from-slate-600 via-slate-400 to-slate-200 h-44 sm:h-52 rounded-t-2xl shadow-[0_10px_30px_rgba(148,163,184,0.3)] border-t-4 border-x border-white/80 relative overflow-hidden flex flex-col items-center justify-between p-3 text-center">
                    {/* Top glass reflection */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
                    
                    <span className="text-5xl sm:text-6xl font-black text-slate-100 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] z-10 leading-none">
                      2
                    </span>

                    <div className="z-10 w-full px-1">
                      <p className="font-black text-slate-900 text-xs sm:text-base truncate drop-shadow-sm">
                        {topStudents[1].first_name} {topStudents[1].last_name}
                      </p>
                      <p className="text-[10px] sm:text-xs font-semibold text-slate-700 bg-white/40 rounded-full px-2 py-0.5 mt-1 inline-block truncate max-w-full">
                        {topStudents[1].class_room?.name || 'ไม่ระบุห้อง'}
                      </p>
                    </div>

                    <div className="z-10 bg-slate-900/90 backdrop-blur-sm text-slate-100 border border-slate-300/40 font-bold text-xs sm:text-sm px-3 py-1 rounded-xl shadow-md flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-slate-300 fill-slate-300" />
                      <span>{Number(topStudents[1].total_points).toLocaleString()} pt</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-28 sm:w-44 md:w-52 h-44 border-2 border-dashed border-slate-700 rounded-t-2xl flex items-center justify-center text-slate-600 text-xs font-bold">
                  ว่าง
                </div>
              )}

              {/* ================= 1ST PLACE (GRAND CHAMPION) ================= */}
              {topStudents[0] ? (
                <div 
                  onClick={fireConfetti}
                  className="flex flex-col items-center w-36 sm:w-52 md:w-60 z-20 transition-transform duration-300 hover:-translate-y-2 cursor-pointer"
                  title="คลิกเพื่อจุดพลุฉลองให้แชมป์!"
                >
                  {/* Floating Gold Crown & Avatar */}
                  <div className="relative mb-3 flex flex-col items-center">
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex flex-col items-center drop-shadow-[0_0_20px_rgba(251,191,36,1)]">
                      <Crown className="w-12 h-12 text-yellow-300 fill-amber-400 animate-pulse" />
                      <span className="text-[10px] font-black tracking-widest text-yellow-200 bg-amber-950/90 px-3 py-0.5 rounded-full border border-yellow-400/60 shadow-[0_0_15px_rgba(251,191,36,0.5)] uppercase mt-0.5 whitespace-nowrap">
                        👑 CHAMPION
                      </span>
                    </div>
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-amber-400/35 blur-xl absolute -top-2 left-1/2 -translate-x-1/2 animate-pulse" />
                    <Avatar
                      name={topStudents[0].first_name}
                      src={topStudents[0].avatar_url}
                      size="xl"
                      className="border-4 border-yellow-300 shadow-[0_0_40px_rgba(251,191,36,0.9)] ring-4 ring-amber-500/60 sm:w-24 sm:h-24"
                    />
                  </div>

                  {/* Gold Pillar */}
                  <div className="w-full bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-300 h-56 sm:h-64 rounded-t-2xl shadow-[0_15px_45px_rgba(245,158,11,0.5)] border-t-4 border-x-2 border-yellow-100 relative overflow-hidden flex flex-col items-center justify-between p-3.5 text-center">
                    {/* Top glass reflection */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                    
                    <span className="text-6xl sm:text-7xl md:text-8xl font-black text-amber-100 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-10 leading-none">
                      1
                    </span>

                    <div className="z-10 w-full px-1">
                      <p className="font-black text-amber-950 text-sm sm:text-lg truncate drop-shadow-sm">
                        {topStudents[0].first_name} {topStudents[0].last_name}
                      </p>
                      <p className="text-[10px] sm:text-xs font-bold text-amber-900 bg-white/50 rounded-full px-2.5 py-0.5 mt-1 inline-block truncate max-w-full">
                        {topStudents[0].class_room?.name || 'ไม่ระบุห้อง'}
                      </p>
                    </div>

                    <div className="z-10 bg-slate-950/90 backdrop-blur-sm text-yellow-300 border border-yellow-400/60 font-black text-sm sm:text-base px-4 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 animate-bounce">
                      <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span>{Number(topStudents[0].total_points).toLocaleString()} pt</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* ================= 3RD PLACE (BRONZE) ================= */}
              {topStudents[2] ? (
                <div className="flex flex-col items-center w-28 sm:w-44 md:w-52 transition-transform duration-300 hover:-translate-y-1">
                  {/* Floating Bronze Badge & Avatar */}
                  <div className="relative mb-3 flex flex-col items-center">
                    <div className="absolute -top-11 left-1/2 -translate-x-1/2 flex flex-col items-center drop-shadow-[0_0_15px_rgba(249,115,22,0.9)]">
                      <Award className="w-8 h-8 sm:w-9 sm:h-9 text-orange-300 fill-orange-400" />
                      <span className="text-[9px] font-bold text-orange-200 bg-orange-950/90 px-2 py-0.5 rounded-full border border-orange-400/40 uppercase whitespace-nowrap mt-0.5">
                        3RD PLACE
                      </span>
                    </div>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-orange-500/20 blur-md absolute -top-1 left-1/2 -translate-x-1/2" />
                    <Avatar
                      name={topStudents[2].first_name}
                      src={topStudents[2].avatar_url}
                      size="lg"
                      className="border-4 border-orange-300 shadow-[0_0_25px_rgba(249,115,22,0.7)] ring-2 ring-orange-500/50 sm:w-20 sm:h-20"
                    />
                  </div>

                  {/* Bronze Pillar */}
                  <div className="w-full bg-gradient-to-t from-orange-700 via-orange-600 to-amber-400 h-36 sm:h-44 rounded-t-2xl shadow-[0_10px_30px_rgba(234,88,12,0.3)] border-t-4 border-x border-orange-100 relative overflow-hidden flex flex-col items-center justify-between p-3 text-center">
                    {/* Top glass reflection */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
                    
                    <span className="text-4xl sm:text-5xl font-black text-orange-100 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] z-10 leading-none">
                      3
                    </span>

                    <div className="z-10 w-full px-1">
                      <p className="font-black text-orange-950 text-xs sm:text-base truncate drop-shadow-sm">
                        {topStudents[2].first_name} {topStudents[2].last_name}
                      </p>
                      <p className="text-[10px] sm:text-xs font-semibold text-orange-900 bg-white/40 rounded-full px-2 py-0.5 mt-1 inline-block truncate max-w-full">
                        {topStudents[2].class_room?.name || 'ไม่ระบุห้อง'}
                      </p>
                    </div>

                    <div className="z-10 bg-slate-900/90 backdrop-blur-sm text-orange-200 border border-orange-400/40 font-bold text-xs sm:text-sm px-3 py-1 rounded-xl shadow-md flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                      <span>{Number(topStudents[2].total_points).toLocaleString()} pt</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-28 sm:w-44 md:w-52 h-36 border-2 border-dashed border-slate-700 rounded-t-2xl flex items-center justify-center text-slate-600 text-xs font-bold">
                  ว่าง
                </div>
              )}

            </div>

            {/* Bottom Motivational Footer */}
            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <p className="text-xs text-amber-200/70 font-medium flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                นักเรียนสามารถสะสม Point เพิ่มเติมได้จากการส่งงาน กิจกรรม และเกมการเรียนรู้ในระบบ
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
