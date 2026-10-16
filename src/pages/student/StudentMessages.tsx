import React, { useEffect, useState, useRef } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { AssignmentConversation, ConversationMessage } from '../../lib/types'
import { SectionHeader, PageLoading, EmptyState, Avatar, ConversationStatusBadge, formatRelativeTime } from '../../components/ui/index'

export default function StudentMessages() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<AssignmentConversation[]>([])
  const [selected, setSelected] = useState<AssignmentConversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [studentId, setStudentId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('students').select('id').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setStudentId(data.id)
    })
  }, [user])

  useEffect(() => {
    if (!studentId) return
    supabase.from('assignment_conversations')
      .select(`*, assignment:assignments(title), teacher:profiles(full_name, avatar_url)`)
      .eq('student_id', studentId).order('last_message_at', { ascending: false })
      .then(({ data }) => { if (data) setConversations(data as AssignmentConversation[]); setLoading(false) })
  }, [studentId])

  async function selectConversation(conv: AssignmentConversation) {
    setSelected(conv)
    const { data } = await supabase.from('conversation_messages')
      .select('*, sender:profiles(full_name, avatar_url)').eq('conversation_id', conv.id).order('created_at')
    if (data) setMessages(data as ConversationMessage[])
    await supabase.from('conversation_messages').update({ is_read: true })
      .eq('conversation_id', conv.id).eq('is_read', false).neq('sender_user_id', user!.id)

    const channelName = `conv-student:${conv.id}-${Math.random().toString(36).slice(2)}`
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${conv.id}` },
        async payload => {
          const { data: msg } = await supabase.from('conversation_messages').select('*, sender:profiles(full_name, avatar_url)').eq('id', payload.new.id).single()
          if (msg) setMessages(prev => [...prev, msg as ConversationMessage])
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage() {
    if (!newMessage.trim() || !selected || !user) return
    setSending(true)
    const msg = newMessage.trim()
    setNewMessage('')
    const { error } = await supabase.from('conversation_messages').insert({
      conversation_id: selected.id, sender_user_id: user.id, sender_role: 'STUDENT', message: msg,
    })
    if (!error) {
      await supabase.from('assignment_conversations').update({ status: 'WAITING_TEACHER', last_message_at: new Date().toISOString(), last_message_by: user.id }).eq('id', selected.id)
    }
    setSending(false)
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <SectionHeader title="ข้อความ" subtitle="การสนทนากับครู" />
      <div className="flex h-[calc(100vh-200px)] gap-4 min-h-[500px]">
        <div className="w-72 flex-shrink-0 card overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">ยังไม่มีการสนทนา<br />ส่งงานและกด "ถามครู" เพื่อเริ่ม</div>
            ) : conversations.map(conv => {
              const teacher = conv.teacher as Record<string, unknown> | undefined
              const assignment = conv.assignment as Record<string, unknown> | undefined
              return (
                <div key={conv.id} onClick={() => selectConversation(conv)}
                  className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${selected?.id === conv.id ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Avatar name={teacher?.full_name as string || 'ครู'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">ครู: {teacher?.full_name as string}</p>
                      <p className="text-xs text-slate-500 truncate">{assignment?.title as string}</p>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <ConversationStatusBadge status={conv.status} />
                    {conv.status === 'WAITING_STUDENT' && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex-1 card overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={<span className="text-4xl">💬</span>} title="เลือกการสนทนา" />
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-100">
                {(() => {
                  const teacher = selected.teacher as Record<string, unknown> | undefined
                  const assignment = selected.assignment as Record<string, unknown> | undefined
                  return (
                    <div className="flex items-center gap-3">
                      <Avatar name={teacher?.full_name as string || 'ครู'} size="md" />
                      <div>
                        <p className="font-semibold">ครู {teacher?.full_name as string}</p>
                        <p className="text-xs text-slate-500">{assignment?.title as string}</p>
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => {
                  const isMe = msg.sender_role === 'STUDENT'
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <Avatar name={isMe ? 'Me' : 'Teacher'} size="sm" />
                      <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={isMe ? 'chat-bubble-sent' : 'chat-bubble-received'}>{msg.message}</div>
                        <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(msg.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-4 border-t border-slate-100">
                <div className="flex gap-3">
                  <textarea className="form-input flex-1 resize-none" rows={2} placeholder="พิมพ์ข้อความ..."
                    value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} />
                  <button onClick={sendMessage} disabled={sending || !newMessage.trim()} className="btn-primary self-end">
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
