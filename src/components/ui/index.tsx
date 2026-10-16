import React, { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

// ============================================================
// Loading Spinner
// ============================================================
export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return <Loader2 className={`animate-spin text-primary-600 ${sizes[size]} ${className}`} />
}

// ============================================================
// Full Page Loading
// ============================================================
export function PageLoading({ message = 'กำลังโหลด...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="lg" />
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  )
}

// ============================================================
// Skeleton
// ============================================================
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number, cols?: number }) {
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><Skeleton className="h-4 w-24" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci}><Skeleton className="h-4 w-full" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================
// Empty State
// ============================================================
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}

// ============================================================
// Error State
// ============================================================
interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({ title = 'เกิดข้อผิดพลาด', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
        <span className="text-3xl">⚠️</span>
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {message && <p className="text-sm text-slate-500 mb-4 max-w-sm">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-primary btn-sm">ลองอีกครั้ง</button>
      )}
    </div>
  )
}

// ============================================================
// Badge
// ============================================================
interface BadgeProps {
  variant?: 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple' | 'indigo' | 'orange'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return <span className={`badge-${variant} ${className}`}>{children}</span>
}

// ============================================================
// Status Badge for Submission/Assignment
// ============================================================
export function SubmissionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    DRAFT: { label: 'ร่าง', variant: 'gray' },
    SUBMITTED: { label: 'รอตรวจ', variant: 'blue' },
    REVIEWING: { label: 'กำลังตรวจ', variant: 'indigo' },
    RETURNED: { label: 'คืนงาน', variant: 'yellow' },
    RESUBMISSION_REQUIRED: { label: 'แก้ไข', variant: 'orange' },
    GRADED: { label: 'ตรวจแล้ว', variant: 'green' },
  }
  const cfg = map[status] || { label: status, variant: 'gray' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export function AssignmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    DRAFT: { label: 'ร่าง', variant: 'gray' },
    PUBLISHED: { label: 'เผยแพร่', variant: 'green' },
    CLOSED: { label: 'ปิด', variant: 'red' },
  }
  const cfg = map[status] || { label: status, variant: 'gray' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export function ConversationStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    WAITING_TEACHER: { label: 'รอครูตอบ', variant: 'orange' },
    WAITING_STUDENT: { label: 'รอนักเรียน', variant: 'blue' },
    RESOLVED: { label: 'แก้ไขแล้ว', variant: 'green' },
    CLOSED: { label: 'ปิด', variant: 'gray' },
  }
  const cfg = map[status] || { label: status, variant: 'gray' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

// ============================================================
// Avatar
// ============================================================
interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base', xl: 'w-16 h-16 text-xl' }
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const colors = ['bg-primary-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-sky-500']
  const color = colors[name.charCodeAt(0) % colors.length]

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  return (
    <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}>
      {initials}
    </div>
  )
}

// ============================================================
// Progress Bar
// ============================================================
interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  showLabel?: boolean
  className?: string
}

export function ProgressBar({ value, max = 100, color = 'bg-primary-500', showLabel = false, className = '' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={`w-full ${className}`}>
      <div className="progress-bar">
        <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{value.toLocaleString()}</span>
          <span>{max.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Point Display
// ============================================================
export function PointDisplay({ points, className = '' }: { points: number, className?: string }) {
  return (
    <span className={`point-display ${className}`}>
      ⭐ {points.toLocaleString()} pt
    </span>
  )
}

// ============================================================
// Modal
// ============================================================
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full'
  footer?: React.ReactNode
  hideHeader?: boolean
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer, hideHeader = false }: ModalProps) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    'full': 'max-w-[95vw]',
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-white rounded-2xl shadow-2xl animate-bounce-in max-h-[90vh] flex flex-col`}>
        {!hideHeader && (
          <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="btn-icon btn-ghost text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        )}
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="p-5 border-t border-slate-100 bg-slate-50 flex-shrink-0 flex justify-end gap-3 rounded-b-2xl">{footer}</div>
        )}
      </div>
    </div>
  )
}



// ============================================================
// Confirm Delete Helper (uses SweetAlert2)
// ============================================================
export async function confirmDelete(title: string, text?: string): Promise<boolean> {
  const Swal = (await import('sweetalert2')).default
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
  })
  return result.isConfirmed
}

export async function confirmAction(title: string, text?: string, confirmText = 'ยืนยัน'): Promise<boolean> {
  const Swal = (await import('sweetalert2')).default
  const result = await Swal.fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#4f46e5',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: confirmText,
    cancelButtonText: 'ยกเลิก',
  })
  return result.isConfirmed
}

export async function showSuccess(title: string, text?: string) {
  const Swal = (await import('sweetalert2')).default
  return Swal.fire({ title, text, icon: 'success', confirmButtonColor: '#4f46e5', confirmButtonText: 'ตกลง' })
}

export async function showError(title: string, text?: string) {
  const Swal = (await import('sweetalert2')).default
  return Swal.fire({ title, text, icon: 'error', confirmButtonColor: '#ef4444', confirmButtonText: 'ตกลง' })
}

export async function showToast(title: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success') {
  const Swal = (await import('sweetalert2')).default
  Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
  }).fire({ icon, title })
}

// ============================================================
// Stat Card
// ============================================================
interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color?: string
  trend?: { value: number; label: string }
  onClick?: () => void
}

export function StatCard({ title, value, subtitle, icon, color = 'bg-primary-500', trend, onClick }: StatCardProps) {
  return (
    <div
      className={`stat-card ${onClick ? 'cursor-pointer hover:shadow-card-hover transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className={`${color} w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        {trend && (
          <p className={`text-xs mt-1 font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Section Header
// ============================================================
interface SectionHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function SectionHeader({ title, subtitle, actions }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}

// ============================================================
// File Size Formatter
// ============================================================
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================
// Date Formatter
// ============================================================
export function formatDate(dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('th-TH', options || {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'เมื่อกี้'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
  if (days < 7) return `${days} วันที่แล้ว`
  return formatDate(dateStr)
}

// ============================================================
// Notification Bell
// ============================================================
interface NotificationBellProps {
  count: number
  onClick: () => void
}

export function NotificationBell({ count, onClick }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className="relative btn-icon btn-ghost"
      id="notification-bell"
      aria-label="การแจ้งเตือน"
    >
      <span className="text-xl">🔔</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

// ============================================================
// Search Input
// ============================================================
interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'ค้นหา...', className = '' }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-input pl-9"
        id="search-input"
      />
    </div>
  )
}

// ============================================================
// Tabs
// ============================================================
interface TabsProps {
  tabs: { id: string; label: string; count?: number }[]
  activeTab: string
  onChange: (id: string) => void
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            activeTab === tab.id
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.id ? 'bg-primary-100 text-primary-600' : 'bg-slate-200 text-slate-500'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ============================================================
// File type icon
// ============================================================
export function FileTypeIcon({ fileType }: { fileType: string | null | undefined }) {
  const type = (fileType || '').toLowerCase()
  if (type.includes('pdf')) return <span>📄</span>
  if (type.includes('word') || type.includes('doc')) return <span>📝</span>
  if (type.includes('excel') || type.includes('sheet') || type.includes('xls')) return <span>📊</span>
  if (type.includes('powerpoint') || type.includes('ppt')) return <span>📋</span>
  if (type.includes('zip') || type.includes('rar')) return <span>📦</span>
  if (type.includes('image') || type.includes('jpg') || type.includes('png')) return <span>🖼️</span>
  return <span>📎</span>
}
