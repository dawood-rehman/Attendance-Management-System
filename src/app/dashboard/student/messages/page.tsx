'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import ConversationPanel, { ChatMessage, ConversationThread } from '@/components/messages/ConversationPanel';
import { Send } from 'lucide-react';
import { apiCall } from '@/utils/api';
import toast from 'react-hot-toast';

interface Recipient {
  _id: string;
  name: string;
  email: string;
}

interface Department {
  _id: string;
  name: string;
  code?: string;
}

interface AcademicClass {
  _id: string;
  name: string;
  code?: string;
  departmentId: string;
}

interface Teacher extends Recipient {
  assignedClassIds: string[];
  departmentId?: string;
}

interface StudentPrefill {
  name: string;
  email: string;
  rollNumber: string;
  departmentId?: string;
  classId?: string;
}

export default function StudentMessagesPage() {
  const [admins, setAdmins] = useState<Recipient[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [recipientType, setRecipientType] = useState<'teacher' | 'admin'>('teacher');
  const [departmentId, setDepartmentId] = useState('');
  const [classId, setClassId] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentRollNumber, setStudentRollNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const classOptions = useMemo(
    () => classes.filter((academicClass) => academicClass.departmentId === departmentId),
    [classes, departmentId]
  );

  const teacherOptions = useMemo(
    () => teachers.filter((teacher) => teacher.assignedClassIds.includes(classId)),
    [classId, teachers]
  );

  const recipientOptions = useMemo(() => {
    const options = recipientType === 'admin'
      ? admins.map((admin, index) => ({
          value: admin._id,
          label: admins.length === 1 ? 'Admin' : `Admin ${index + 1}: ${admin.name}`,
        }))
      : teacherOptions.map((teacher) => ({ value: teacher._id, label: teacher.name }));

    return [{ value: '', label: recipientType === 'admin' ? 'Select Admin' : 'Select Teacher' }, ...options];
  }, [admins, recipientType, teacherOptions]);

  const load = () => {
    setLoading(true);
    Promise.all([
      apiCall<{
        admins: Recipient[];
        teachers: Teacher[];
        departments: Department[];
        classes: AcademicClass[];
        student: StudentPrefill | null;
      }>('/api/messages?recipients=1'),
      apiCall<{ messages: ChatMessage[]; currentUserId: string }>('/api/messages'),
    ])
      .then(([recipientData, messageData]) => {
        setAdmins(recipientData.admins);
        setTeachers(recipientData.teachers);
        setDepartments(recipientData.departments);
        setClasses(recipientData.classes);
        setMessages(messageData.messages);
        setCurrentUserId(messageData.currentUserId);

        if (recipientData.student) {
          setStudentName((current) => current || recipientData.student?.name || '');
          setStudentRollNumber((current) => current || recipientData.student?.rollNumber || '');
          setDepartmentId((current) => current || recipientData.student?.departmentId || '');
          setClassId((current) => current || recipientData.student?.classId || '');
        }
      })
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const changeRecipientType = (value: 'teacher' | 'admin') => {
    setRecipientType(value);
    setRecipientUserId('');
  };

  const changeDepartment = (value: string) => {
    setDepartmentId(value);
    setClassId('');
    setRecipientUserId('');
  };

  const changeClass = (value: string) => {
    setClassId(value);
    setRecipientUserId('');
  };

  const send = async () => {
    if (!recipientType) return toast.error('Select Teacher or Admin');
    if (!departmentId) return toast.error('Select your department');
    if (!classId) return toast.error('Select your class');
    if (!recipientUserId) {
      return toast.error(recipientType === 'admin' ? 'Select admin' : 'Select teacher');
    }
    if (!studentName.trim() || !studentRollNumber.trim()) {
      return toast.error('Student name and roll number are required');
    }
    if (!subject.trim() || !body.trim()) {
      return toast.error('Subject and message are required');
    }

    setSending(true);
    try {
      const data = await apiCall<{ emailError?: string }>('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipientType,
          recipientUserId,
          departmentId,
          classId,
          studentName,
          studentRollNumber,
          subject,
          body,
          sendEmail,
        }),
      });
      toast.success(data.emailError ? 'Message saved, email could not be sent' : 'Message sent');
      setSubject('');
      setBody('');
      setSendEmail(false);
      load();
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
      load();
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Messages</h1>
        <p className="text-white/40 text-sm mt-0.5">Send a message to admin or a specific teacher</p>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Send Message To"
            value={recipientType}
            onChange={(e) => changeRecipientType(e.target.value as 'teacher' | 'admin')}
            options={[
              { value: 'teacher', label: 'Teacher' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <Select
            label="Department"
            value={departmentId}
            onChange={(e) => changeDepartment(e.target.value)}
            options={[{ value: '', label: 'Select Department' }, ...departments.map((department) => ({ value: department._id, label: department.name }))]}
          />
          <Select
            label="Class"
            value={classId}
            onChange={(e) => changeClass(e.target.value)}
            options={[{ value: '', label: 'Select Class' }, ...classOptions.map((academicClass) => ({ value: academicClass._id, label: academicClass.name }))]}
          />
          <Select
            label={recipientType === 'admin' ? 'Admin' : 'Teacher'}
            value={recipientUserId}
            onChange={(e) => setRecipientUserId(e.target.value)}
            options={recipientOptions}
          />
          <Input
            label="Your Name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Student name"
          />
          <Input
            label="Roll Number"
            value={studentRollNumber}
            onChange={(e) => setStudentRollNumber(e.target.value)}
            placeholder="Roll number"
          />
          <div className="md:col-span-2">
            <Input
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Attendance question"
            />
          </div>
        </div>

        <div className="mt-4">
          <Textarea label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Write your message" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-white/60">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 rounded" />
            Send as email too
          </label>
          <Button onClick={send} loading={sending}><Send size={14} /> Send Message</Button>
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
