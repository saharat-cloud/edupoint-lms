import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Send, Paperclip, CheckCheck, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { AssignmentConversation, ConversationMessage } from '../../lib/types'
import { SectionHeader, PageLoading, EmptyState, Avatar, ConversationStatusBadge, formatRelativeTime, formatDateTime, Badge } from '../../components/ui/index'

export default function TeacherMessages() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<AssignmentConversation[]>([])
  const [selected, setSelected] = useState<AssignmentConversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [filterStatus, setFilterStatus] = useState('WAITING_TEACHER')

  const loadConversations = useCallback(async () => {
    if (!user) return
    let query = supabase.from('assignment_conversations')
      .select(`*, assignment:assignments(title), student:students(first_name,last_name,avatar_url)`)
      .eq('teacher_id', user.id)
      .order('last_message_at', { ascending: false })
    if (filterStatus) query = query.eq('status', filterStatus)
    const { data } = await query
    if (data) setConversations(data as AssignmentConversation[])
    setLoading(false)
  }, [user, filterStatus])

  useEffect(() => { loadConversations() }, [loadConversations])

  async function selectConversation(conv: AssignmentConversation) {
    setSelected(conv)
    // Load messages
    const { data } = await supabase.from('conversation_messages')
      .select('*, sender:profiles(full_name, avatar_url)')
      .eq('conversation_id', conv.id)
      .order('created_at')
    if (data) setMessages(data as ConversationMessage[])

    // Mark messages as read
    await supabase.from('conversation_messages').update({ is_read: true })
      .eq('conversation_id', conv.id).eq('is_read', false).neq('sender_user_id', user!.id)

    // Realtime subscription for this conversation
    const channelName = `conv:${conv.id}-${Math.random().toString(36).slice(2)}`
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${conv.id}` },
        async (payload) => {
          const { data: msgWithSender } = await supabase.from('conversation_messages')
            .select('*, sender:profiles(full_name, avatar_url)').eq('id', payload.new.id).single()
          if (msgWithSender) setMessages(prev => [...prev, msgWithSender as ConversationMessage])
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  async function sendMessage() {
    if (!newMessage.trim() || !selected || !user) return
    setSending(true)
    const msg = newMessage.trim()
    setNewMessage('')

    const { error } = await supabase.from('conversation_messages').insert({
      conversation_id: selected.id,
      sender_user_id: user.id,
      sender_role: 'TEACHER',
      message: msg,
    })

    if (!error) {
      // Update conversation status
      await supabase.from('assignment_conversations').update({
        status: 'WAITING_STUDENT',
        last_message_at: new Date().toISOString(),
        last_message_by: user.id,
      }).eq('id', selected.id)

      // Notify student
      const conv = selected as AssignmentConversation & { student?: Record<string, unknown>; assignment?: Record<string, unknown> }
      const studentData = conv.student as Record<string, unknown> | undefined
      if (studentData) {
        const { data: studentRow } = await supabase.from('students').select('user_id').eq('id', selected.student_id).single()
        if (studentRow?.user_id) {
          await supabase.from('notifications').insert({
            user_id: studentRow.user_id,
            type: 'TEACHER_REPLY',
            title: 'ครูตอบคำถามของคุณ',
            message: msg.slice(0, 100),
            reference_type: 'conversation',
            reference_id: selected.id,
          })
        }
      }
    }
    setSending(false)
    loadConversations()
  }

  async function resolveConversation() {
    if (!selected) return
    await supabase.from('assignment_conversations').update({
      status: 'RESOLVED',
      resolved_at: new Date().toISOString(),
      resolved_by: user!.id,
    }).eq('id', selected.id)
    loadConversations()
    setSelected(null)
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <SectionHeader title="ข้อความ / คำถามจากนักเรียน" />

      <div className="flex h-[calc(100vh-200px)] gap-4 min-h-[500px]">
        {/* Conversation list */}
        <div className="w-80 flex-shrink-0 card overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-100">
            <select className="form-select text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="WAITING_TEACHER">รอตอบ</option>
              <option value="WAITING_STUDENT">รอนักเรียน</option>
              <option value="RESOLVED">แก้ไขแล้ว</option>
              <option value="">ทั้งหมด</option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">ไม่มีการสนทนา</div>
            ) : conversations.map(conv => {
              const student = conv.student as Record<string, unknown> | undefined
              const assignment = conv.assignment as Record<string, unknown> | undefined
              const isSelected = selected?.id === conv.id
              return (
                <div key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Avatar name={`${student?.first_name} ${student?.last_name}`} src={student?.avatar_url as string} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{student?.first_name as string} {student?.last_name as string}</p>
                      <p className="text-xs text-slate-500 truncate">{assignment?.title as string}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <ConversationStatusBadge status={conv.status} />
                    <span className="text-xs text-slate-400">{conv.last_message_at ? formatRelativeTime(conv.last_message_at) : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 card overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={<span className="text-4xl">💬</span>} title="เลือกการสนทนา" description="คลิกที่รายการด้านซ้ายเพื่อเปิดการสนทนา" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                {(() => {
                  const student = selected.student as Record<string, unknown> | undefined
                  const assignment = selected.assignment as Record<string, unknown> | undefined
                  return (
                    <>
                      <Avatar name={`${student?.first_name} ${student?.last_name}`} size="md" />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{student?.first_name as string} {student?.last_name as string}</p>
                        <p className="text-xs text-slate-500">{assignment?.title as string}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ConversationStatusBadge status={selected.status} />
                        {selected.status !== 'RESOLVED' && (
                          <button onClick={resolveConversation} className="btn-secondary btn-sm">✓ แก้ไขแล้ว</button>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => {
                  const isTeacher = msg.sender_role === 'TEACHER'
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isTeacher ? 'flex-row-reverse' : 'flex-row'}`}>
                      <Avatar name={isTeacher ? 'Teacher' : 'Student'} size="sm" />
                      <div className={`max-w-[70%] ${isTeacher ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className={isTeacher ? 'chat-bubble-sent' : 'chat-bubble-received'}>
                          {msg.message}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(msg.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-slate-100">
                <div className="flex gap-3">
                  <textarea
                    className="form-input flex-1 resize-none"
                    rows={2}
                    placeholder="พิมพ์ข้อความ..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  />
                  <button onClick={sendMessage} disabled={sending || !newMessage.trim()} className="btn-primary self-end" id="send-message-btn">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
