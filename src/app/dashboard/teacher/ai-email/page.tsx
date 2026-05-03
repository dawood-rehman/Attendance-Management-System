'use client';
import { useEffect, useState } from 'react';
import { Button, Card, Textarea, EmptyState } from '@/components/ui';
import { Mail, Sparkles, Send, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiCall } from '@/utils/api';
import toast from 'react-hot-toast';

interface Student { _id: string; name: string; rollNumber: string; email?: string; }

interface EmailResult {
  studentId: string;
  studentName: string;
  email?: string;
  attendancePercentage: number;
  emailContent: { subject: string; body: string };
  sent: boolean;
}

export default function TeacherAIEmailPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<EmailResult[]>([]);
  const [editedEmails, setEditedEmails] = useState<Record<string, { subject: string; body: string }>>({});
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    apiCall<{ students: Student[] }>('/api/teacher/students?limit=200')
      .then((d) => setStudents(d.students))
      .catch(console.error);
  }, []);

  const toggleSelect = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const selectAll = () => setSelected(students.map((s) => s._id));
  const clearAll = () => setSelected([]);

  const generate = async () => {
    if (!selected.length) return toast.error('Select at least one student');
    setGenerating(true);
    setResults([]);
    setEditedEmails({});
    try {
      const data = await apiCall<{ results: EmailResult[] }>('/api/ai/email', {
        method: 'POST',
        body: JSON.stringify({ studentIds: selected, mode: 'generate' }),
      });
      setResults(data.results);
      const edits: Record<string, { subject: string; body: string }> = {};
      data.results.forEach((r) => { edits[r.studentId] = { ...r.emailContent }; });
      setEditedEmails(edits);
    } catch (e) { toast.error((e as Error).message); }
    finally { setGenerating(false); }
  };

  const sendOne = async (result: EmailResult) => {
    if (!result.email) return toast.error('No email address for this student');
    setSending(result.studentId);
    try {
      await apiCall('/api/ai/email', {
        method: 'POST',
        body: JSON.stringify({
          studentIds: [result.studentId],
          mode: 'send',
          customSubject: editedEmails[result.studentId]?.subject,
          customBody: editedEmails[result.studentId]?.body,
        }),
      });
      toast.success(`Email sent to ${result.studentName}`);
      setResults((prev) => prev.map((r) => r.studentId === result.studentId ? { ...r, sent: true } : r));
    } catch (e) { toast.error((e as Error).message); }
    finally { setSending(null); }
  };

  const sendAll = async () => {
    const withEmail = results.filter((r) => r.email && !r.sent);
    if (!withEmail.length) return toast.error('No emails to send');
    setSending('all');
    try {
      await Promise.all(withEmail.map((r) =>
        apiCall('/api/ai/email', {
          method: 'POST',
          body: JSON.stringify({
            studentIds: [r.studentId],
            mode: 'send',
            customSubject: editedEmails[r.studentId]?.subject,
            customBody: editedEmails[r.studentId]?.body,
          }),
        })
      ));
      toast.success(`Sent ${withEmail.length} emails!`);
      setResults((prev) => prev.map((r) => r.email ? { ...r, sent: true } : r));
    } catch (e) { toast.error((e as Error).message); }
    finally { setSending(null); }
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-brand-600/20 border border-brand-500/30">
          <Mail size={20} className="text-brand-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">AI Email Sender</h1>
          <p className="text-white/40 text-sm">AI generates attendance alerts — review & send</p>
        </div>
      </div>

      {/* Student selection */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Select Students</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={selectAll}>All</Button>
            <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
          {students.map((s) => (
            <label key={s._id}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selected.includes(s._id)
                  ? 'bg-brand-600/15 border-brand-500/30'
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(s._id)}
                onChange={() => toggleSelect(s._id)}
                className="w-4 h-4 accent-blue-500"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{s.name}</div>
                <div className="text-xs text-white/35">{s.email || <span className="text-red-400/60">No email</span>}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <span className="text-sm text-white/40">{selected.length} selected</span>
          <Button onClick={generate} loading={generating} size="sm">
            <Sparkles size={14} />
            Generate AI Emails
          </Button>
        </div>
      </Card>

      {/* Generated emails */}
      {results.length > 0 && (
        <div className="space-y-4 animate-fade-up">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-white">Generated Emails</h2>
            <Button onClick={sendAll} loading={sending === 'all'} size="sm">
              <Send size={14} /> Send All
            </Button>
          </div>

          {results.map((r) => (
            <Card key={r.studentId} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500/40 to-purple-600/40 flex items-center justify-center text-white/70 font-bold text-xs">
                      {r.studentName.charAt(0)}
                    </div>
                    <div>
                      <span className="font-medium text-white text-sm">{r.studentName}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        r.attendancePercentage >= 85 ? 'bg-green-500/15 text-green-400' :
                        r.attendancePercentage >= 70 ? 'bg-amber-500/15 text-amber-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>{r.attendancePercentage}%</span>
                    </div>
                  </div>
                  <div className="text-xs text-white/35 mt-1 ml-11">
                    {r.email || <span className="text-red-400/60">No email address</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.sent ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle size={13} /> Sent
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => sendOne(r)}
                      loading={sending === r.studentId}
                      disabled={!r.email}
                    >
                      <Send size={13} /> Send
                    </Button>
                  )}
                </div>
              </div>

              {/* Editable email */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5 block">Subject</label>
                  <input
                    className="w-full px-3 py-2 text-sm rounded-lg"
                    value={editedEmails[r.studentId]?.subject || ''}
                    onChange={(e) => setEditedEmails((prev) => ({
                      ...prev,
                      [r.studentId]: { ...prev[r.studentId], subject: e.target.value }
                    }))}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Body</label>
                    <span className="text-xs text-brand-400 flex items-center gap-1"><Sparkles size={11} /> AI Generated</span>
                  </div>
                  <Textarea
                    rows={6}
                    value={editedEmails[r.studentId]?.body || ''}
                    onChange={(e) => setEditedEmails((prev) => ({
                      ...prev,
                      [r.studentId]: { ...prev[r.studentId], body: e.target.value }
                    }))}
                  />
                </div>
              </div>

              {!r.email && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle size={14} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">No email address — cannot send. Update student profile to add one.</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {!generating && results.length === 0 && (
        <Card>
          <EmptyState
            icon={<Mail size={32} />}
            title="No emails generated yet"
            description="Select students and click Generate AI Emails"
          />
        </Card>
      )}
    </div>
  );
}
