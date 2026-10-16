import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, Star, BookOpen, MessageCircle,
  Gamepad2, User, Bell, Calendar, LogOut, Menu
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { NotificationBell, Avatar } from '../ui/index'
import { confirmAction } from '../ui/index'

const navItems = [
  { to: '/student/dashboard', icon: LayoutDashboard, label: 'หน้าหลัก' },
  { to: '/student/assignments', icon: ClipboardList, label: 'งานของฉัน' },
  { to: '/student/points', icon: Star, label: 'Point' },
  { to: '/student/grades', icon: BookOpen, label: 'เกรด/คะแนน' },
  { to: '/student/messages', icon: MessageCircle, label: 'ข้อความ' },
  { to: '/student/games', icon: Gamepad2, label: 'เกมเรียนรู้' },
  { to: '/student/calendar', icon: Calendar, label: 'ปฏิทิน' },
  { to: '/student/notifications', icon: Bell, label: 'การแจ้งเตือน' },
  { to: '/student/profile', icon: User, label: 'โปรไฟล์' },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()

  async function handleSignOut() {
    const ok = await confirmAction('ออกจากระบบ', 'คุณต้องการออกจากระบบหรือไม่?', 'ออกจากระบบ')
    if (ok) { await signOut(); navigate('/login') }
  }

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200">
        <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">EP</span>
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm leading-tight">EduPoint</p>
          <p className="text-xs text-slate-500">นักเรียน</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item-inactive'}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.to === '/student/notifications' && unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center gap-3 p-2 rounded-xl">
          <Avatar name={profile?.full_name || 'Student'} src={profile?.avatar_url} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700 truncate">{profile?.full_name}</p>
            <p className="text-xs text-slate-400">นักเรียน</p>
          </div>
          <button onClick={handleSignOut} className="btn-icon btn-ghost text-slate-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-[220px] bg-white border-r border-slate-200 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-[240px] h-full bg-white shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 lg:ml-[220px]">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-3">
          <button className="lg:hidden btn-icon btn-ghost" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <NotificationBell count={unreadCount} onClick={() => navigate('/student/notifications')} />
        </header>

        {/* Bottom nav for mobile */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto pb-20 lg:pb-6">
          {children}
        </div>

        {/* Mobile bottom navigation */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-20 px-2 py-2 flex justify-around">
          {[
            { to: '/student/dashboard', icon: LayoutDashboard, label: 'หน้าหลัก' },
            { to: '/student/assignments', icon: ClipboardList, label: 'งาน' },
            { to: '/student/games', icon: Gamepad2, label: 'เกม' },
            { to: '/student/messages', icon: MessageCircle, label: 'แชท' },
            { to: '/student/profile', icon: User, label: 'โปรไฟล์' },
          ].map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? 'text-primary-600' : 'text-slate-400'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  )
}
