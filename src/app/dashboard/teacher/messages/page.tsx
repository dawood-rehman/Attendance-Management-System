'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import ConversationPanel, { ChatMessage, ConversationThread } from '@/components/messages/ConversationPanel';
import { Send } from 'lucide-react';
import { apiCall } from '@/utils/api';
import toast from 'react-hot-toast';

interface Recipient {
  _id: string;
  name: string;
  email: string;
  department?: string;
  className?: string;
  rollNumber?: string;
}

interface RecipientData {
  admins: Recipient[];
  students: Recipient[];
}

function studentLabel(student: Recipient) {
  const details = [student.department, student.className, student.rollNumber].filter(Boolean).join(' / ');
  return details ? `${student.name} - ${details}` : student.name;
}

export default function TeacherMessagesPage() {
  const [admins, setAdmins] = useState<Recipient[]>([]);
  const [students, setStudents] = useState<Recipient[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [recipientType, setRecipientType] = useState<'admin' | 'student'>('student');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const recipientOptions = useMemo(() => {
    if (recipientType === 'admin') {
      return [
        { value: '', label: 'Select Admin' },
        ...admins.map((admin, index) => ({
          value: admin._id,
          label: admins.length === 1 ? 'Admin' : `Admin ${index + 1}: ${admin.name}`,
        })),
      ];
    }

    return [
      { value: '', label: 'Select Student' },
      ...students.map((student) => ({ value: student._id, label: studentLabel(student) })),
    ];
  }, [admins, recipientType, students]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recipientData, messageData] = await Promise.all([
        apiCall<RecipientData>('/api/messages?recipients=1'),
        apiCall<{ messages: ChatMessage[]; currentUserId: string }>('/api/messages'),
      ]);
      setAdmins(recipientData.admins);
      setStudents(recipientData.students);
      setMessages(messageData.messages);
      setCurrentUserId(messageData.currentUserId);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendNewMessage = async () => {
    if (!recipientUserId) return toast.error(recipientType === 'admin' ? 'Select admin' : 'Select student');
    if (!subject.trim() || !body.trim()) return toast.error('Subject and message are required');

    setSending(true);
    try {
      const data = await apiCall<{ emailError?: string }>('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipientType,
          recipientUserId,
          subject,
          body,
          sendEmail,
        }),
      });
      toast.success(data.emailError ? 'Message saved, email could not be sent' : 'Message sent');
      setSubject('');
      setBody('');
      setSendEmail(false);
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (thread: ConversationThread, replyBody: string) => {
    const subjectLine = thread.latest.subject.startsWith('Re:')
      ? thread.latest.subject
      : `Re: ${thread.latest.subject}`;
    try {
      await apiCall('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          parentMessageId: thread.latest._id,
          recipientType: thread.participantRole,
          subject: subjectLine,
          body: replyBody,
        }),
      });
      toast.success('Reply sent');
      await load();
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Messages</h1>
        <p className="text-white/40 text-sm mt-0.5">Direct chats with admin and assigned students</p>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Send Message To"
            value={recipientType}
            onChange={(event) => {
              setRecipientType(event.target.value as 'admin' | 'student');
              setRecipientUserId('');
            }}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <Select
            label={recipientType === 'admin' ? 'Admin' : 'Student'}
            value={recipientUserId}
            onChange={(event) => setRecipientUserId(event.target.value)}
            options={recipientOptions}
          />
          <div className="md:col-span-2">
            <Input
              label="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Class update"
            />
          </div>
        </div>
        <div className="mt-4">
          <Textarea label="Message" value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder="Write your message" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-white/60">
            <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} className="h-4 w-4 rounded" />
            Send as email too
          </label>
          <Button onClick={sendNewMessage} loading={sending}><Send size={14} /> Send Message</Button>
        </div>
      </Card>

      <ConversationPanel
        messages={messages}
        currentUserId={currentUserId}
        loading={loading}
        onReply={sendReply}
      />
    </div>
  );
}
