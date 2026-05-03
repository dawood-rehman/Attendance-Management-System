'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Badge, Button, EmptyState, Skeleton, Textarea } from '@/components/ui';
import { Mail, MessageSquare, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export type ChatRole = 'admin' | 'teacher' | 'student' | string;

export interface ChatMessage {
  _id: string;
  parentMessageId?: string;
  senderUserId: string;
  senderName: string;
  senderEmail: string;
  senderRole: ChatRole;
  recipientType: ChatRole;
  recipientUserId: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  channel: string;
  deliveryStatus: string;
  studentName?: string;
  studentEmail?: string;
  studentDepartment?: string;
  studentClass?: string;
  studentRollNumber?: string;
  createdAt: string;
}

export interface ConversationThread {
  id: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  participantRole: ChatRole;
  latest: ChatMessage;
  messages: ChatMessage[];
  studentName?: string;
  studentDepartment?: string;
  studentClass?: string;
  studentRollNumber?: string;
}

interface ConversationPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  loading: boolean;
  title?: string;
  onReply: (thread: ConversationThread, body: string) => Promise<void>;
}

function toId(value: unknown) {
  return String(value || '');
}

function getStudentContext(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) =>
    message.studentName ||
    message.studentDepartment ||
    message.studentClass ||
    message.studentRollNumber
  );
}

export function buildConversationThreads(messages: ChatMessage[], currentUserId: string) {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const threads = new Map<string, ConversationThread>();

  sorted.forEach((message) => {
    const senderUserId = toId(message.senderUserId);
    const recipientUserId = toId(message.recipientUserId);
    const outgoing = senderUserId === currentUserId;
    const participantId = outgoing ? recipientUserId : senderUserId;
    const existing = threads.get(participantId);
    const threadMessages = existing ? [...existing.messages, message] : [message];
    const studentContext = getStudentContext(threadMessages);

    threads.set(participantId, {
      id: participantId,
      participantId,
      participantName: outgoing ? message.recipientName : message.senderName,
      participantEmail: outgoing ? message.recipientEmail : message.senderEmail,
      participantRole: outgoing ? message.recipientType : message.senderRole,
      latest: message,
      messages: threadMessages,
      studentName: studentContext?.studentName,
      studentDepartment: studentContext?.studentDepartment,
      studentClass: studentContext?.studentClass,
      studentRollNumber: studentContext?.studentRollNumber,
    });
  });

  return [...threads.values()].sort(
    (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime()
  );
}

export default function ConversationPanel({
  messages,
  currentUserId,
  loading,
  title = 'Conversations',
  onReply,
}: ConversationPanelProps) {
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const threads = useMemo(
    () => buildConversationThreads(messages, currentUserId),
    [currentUserId, messages]
  );
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) || threads[0];

  useEffect(() => {
    if (!threads.length) {
      setSelectedThreadId('');
      return;
    }
    if (!threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [selectedThreadId, threads]);

  const submitReply = async () => {
    if (!selectedThread) return;
    if (!replyBody.trim()) {
      toast.error('Reply message is required');
      return;
    }
    setSending(true);
    try {
      await onReply(selectedThread, replyBody.trim());
      setReplyBody('');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-6 space-y-3">
        {[...Array(5)].map((_, index) => <Skeleton key={index} className="h-14" />)}
      </div>
    );
  }

  if (!threads.length) {
    return (
      <div className="card">
        <EmptyState icon={<Mail size={32} />} title="No messages" />
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="grid lg:min-h-[620px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="font-display text-sm font-semibold text-white">{title}</div>
            <Badge value={`${threads.length}`} className="normal-case" />
          </div>
          <div className="max-h-72 overflow-y-auto lg:max-h-[560px]">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
                className={`w-full border-b border-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.04] ${
                  selectedThread?.id === thread.id ? 'bg-brand-500/10' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{thread.participantName}</div>
                    <div className="truncate text-xs text-white/35">{thread.participantEmail}</div>
                  </div>
                  <Badge value={String(thread.participantRole)} />
                </div>
                {thread.studentDepartment || thread.studentClass || thread.studentRollNumber ? (
                  <div className="mt-2 truncate text-xs text-white/35">
                    {[thread.studentDepartment, thread.studentClass, thread.studentRollNumber].filter(Boolean).join(' / ')}
                  </div>
                ) : null}
                <div className="mt-2 truncate text-xs text-white/45">{thread.latest.subject}</div>
                <div className="mt-1 truncate text-xs text-white/30">{thread.latest.body}</div>
              </button>
            ))}
          </div>
        </div>

        {selectedThread ? (
          <div className="flex min-h-[520px] flex-col lg:min-h-[620px]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={17} className="text-brand-300" />
                    <h2 className="truncate font-display text-lg font-semibold text-white">{selectedThread.participantName}</h2>
                  </div>
                  <div className="mt-1 truncate text-sm text-white/40">{selectedThread.participantEmail}</div>
                </div>
                <Badge value={String(selectedThread.participantRole)} />
              </div>
              {selectedThread.studentDepartment || selectedThread.studentClass || selectedThread.studentRollNumber ? (
                <div className="mt-3 grid gap-2 text-xs text-white/45 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 px-3 py-2">
                    <span className="block text-white/30">Department</span>
                    <span className="text-white/70">{selectedThread.studentDepartment || '-'}</span>
                  </div>
                  <div className="rounded-lg border border-white/10 px-3 py-2">
                    <span className="block text-white/30">Class</span>
                    <span className="text-white/70">{selectedThread.studentClass || '-'}</span>
                  </div>
                  <div className="rounded-lg border border-white/10 px-3 py-2">
                    <span className="block text-white/30">Roll Number</span>
                    <span className="text-white/70">{selectedThread.studentRollNumber || '-'}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {selectedThread.messages.map((message) => {
                const outgoing = toId(message.senderUserId) === currentUserId;
                return (
                  <div key={message._id} className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[92%] rounded-lg border px-3 py-3 sm:max-w-[84%] sm:px-4 ${
                      outgoing
                        ? 'border-brand-500/30 bg-brand-500/15'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-medium text-white/55">
                          {outgoing ? 'You' : message.senderName}
                        </div>
                        <div className="text-[11px] text-white/30">
                          {format(new Date(message.createdAt), 'MMM dd, h:mm a')}
                        </div>
                      </div>
                      <div className="mt-2 text-sm font-medium text-white">{message.subject}</div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/70">{message.body}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge value={message.deliveryStatus === 'email_failed' ? 'email failed' : message.channel} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="min-w-0 flex-1">
                  <Textarea
                    label="Reply"
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    rows={3}
                    placeholder="Write your reply"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={submitReply} loading={sending} className="w-full lg:w-auto">
                    <Send size={14} /> Reply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
