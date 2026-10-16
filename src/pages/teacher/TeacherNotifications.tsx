import React from 'react'
import { useNotifications } from '../../contexts/NotificationContext'
import { SectionHeader, formatRelativeTime } from '../../components/ui/index'

export default function TeacherNotifications() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications()

  const typeIcon: Record<string, string> = {
    ASSIGNMENT_GRADED: '✅', SUBMISSION_RETURNED: '↩️', TEACHER_REPLY: '💬',
    NEW_ASSIGNMENT: '📝', POINT_AWARDED: '⭐', GAME_RESULT: '🎮',
    STUDENT_SUBMITTED: '📄', STUDENT_MESSAGE: '💬',
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="การแจ้งเตือน"
        actions={notifications.some(n => !n.is_read) &&
          <button onClick={markAllAsRead} className="btn-secondary btn-sm">อ่านทั้งหมด</button>} />

      <div className="card divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">ไม่มีการแจ้งเตือน</div>
        ) : notifications.map(n => (
          <div key={n.id} onClick={() => !n.is_read && markAsRead(n.id)}
            className={`flex items-start gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-primary-50/50' : ''}`}>
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
              {typeIcon[n.type] || '🔔'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${!n.is_read ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>{n.title}</p>
              {n.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
              <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(n.created_at)}</p>
            </div>
            {!n.is_read && <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  )
}
