import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, BookOpen, GraduationCap, Settings,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Building2, Gamepad2, Monitor,
  ClipboardList, FileCheck, MessageCircle, BarChart3
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { NotificationBell, Avatar } from '../ui/index'
import { confirmAction } from '../ui/index'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { profile, signOut, role } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()

  const navItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'แดชบอร์ด', roles: ['SUPER_ADMIN'] },
    { to: '/admin/students', icon: Users, label: 'นักเรียน', roles: ['SUPER_ADMIN'] },
    { to: '/admin/classes', icon: Building2, label: 'ห้องเรียน', roles: ['SUPER_ADMIN'] },
    { to: '/admin/subjects', icon: BookOpen, label: 'วิชา', roles: ['SUPER_ADMIN'] },
    { to: '/admin/teachers', icon: GraduationCap, label: 'ครู', roles: ['SUPER_ADMIN'] },
    { to: '/admin/assignments', icon: ClipboardList, label: 'งาน/ภาระงาน', roles: ['SUPER_ADMIN', 'TEACHER'] },
    { to: '/admin/submissions', icon: FileCheck, label: 'ตรวจงาน', roles: ['SUPER_ADMIN', 'TEACHER'] },
    { to: '/admin/gradebook', icon: BookOpen, label: 'Gradebook', roles: ['SUPER_ADMIN', 'TEACHER'] },
    { to: '/admin/messages', icon: MessageCircle, label: 'ข้อความ', badge: true, roles: ['SUPER_ADMIN', 'TEACHER'] },
    { to: '/admin/reports', icon: BarChart3, label: 'รายงาน', roles: ['SUPER_ADMIN', 'TEACHER'] },
    { to: '/admin/games', icon: Gamepad2, label: 'เกม', roles: ['SUPER_ADMIN', 'TEACHER'] },
    { to: '/admin/settings', icon: Settings, label: 'ตั้งค่าระบบ', roles: ['SUPER_ADMIN'] },
  ]

  const filteredNavItems = navItems.filter(item => item.roles.includes(role || ''))

  async function handleSignOut() {
    const ok = await confirmAction('ออกจากระบบ', 'คุณต้องการออกจากระบบหรือไม่?', 'ออกจากระบบ')
    if (ok) { await signOut(); navigate('/login') }
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200">
        <div className="w-9 h-9 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">EP</span>
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-slate-800 text-sm leading-tight">EduPoint</p>
            <p className="text-xs text-slate-500">ระบบจัดการผู้สอน</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
        {filteredNavItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'nav-item-active' : 'nav-item-inactive'
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="flex-1">{item.label}</span>}
            {!collapsed && item.badge && unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-200">
        <div className={`flex items-center gap-3 p-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <Avatar name={profile?.full_name || 'Admin'} src={profile?.avatar_url} size="sm" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 truncate">{profile?.full_name}</p>
              <p className="text-xs text-slate-400">SUPER_ADMIN</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={handleSignOut} className="btn-icon btn-ghost text-slate-400" title="ออกจากระบบ">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-screen bg-white border-r border-slate-200 z-30 transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-16 w-7 h-7 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-[260px] h-full bg-white shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-3">
          <button
            className="lg:hidden btn-icon btn-ghost"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button 
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors" 
            onClick={() => window.open('/kiosk', '_blank')}
          >
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">จุดเช็คอิน</span>
          </button>
          <NotificationBell count={unreadCount} onClick={() => navigate('/admin/notifications')} />
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
