'use client';
import { useEffect, useState } from 'react';
import { Button, Card, EmptyState, Input, Modal, Skeleton } from '@/components/ui';
import { Pencil, School } from 'lucide-react';
import { apiCall } from '@/utils/api';
import toast from 'react-hot-toast';

interface Department {
  _id: string;
  name: string;
  code?: string;
}

interface AcademicClass {
  _id: string;
  name: string;
  code?: string;
  departmentId: string | Department;
  maxStudents: number;
  currentStrength?: number;
}

function refName(value: string | Department | undefined) {
  return typeof value === 'object' && value ? value.name : '-';
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AcademicClass | null>(null);
  const [maxStudents, setMaxStudents] = useState('10');

  const load = () => {
    setLoading(true);
    apiCall<{ classes: AcademicClass[] }>('/api/admin/classes')
      .then((data) => setClasses(data.classes))
      .catch(() => toast.error('Failed to load classes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (academicClass: AcademicClass) => {
    setEditing(academicClass);
    setMaxStudents(String(academicClass.maxStudents));
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const data = await apiCall<{ class: AcademicClass }>(`/api/admin/classes/${editing._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ maxStudents }),
      });
      toast.success('Class strength updated');
      setClasses((items) => items.map((item) => item._id === editing._id ? { ...item, ...data.class } : item));
      setEditing(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Assigned Classes</h1>
        <p className="text-white/40 text-sm mt-0.5">Manage strength for classes assigned to you</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : classes.length === 0 ? (
          <EmptyState icon={<School size={32} />} title="No assigned classes" description="Admin can assign classes from teacher management" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Class', 'Department', 'Students', 'Strength', 'Actions'].map((header) => (
                    <th key={header} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((academicClass) => (
                  <tr key={academicClass._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-white">{academicClass.name}</div>
                      <div className="text-xs text-white/35">{academicClass.code || '-'}</div>
                    </td>
                    <td className="px-5 py-3.5 text-white/50">{refName(academicClass.departmentId)}</td>
                    <td className="px-5 py-3.5 text-white/50">{academicClass.currentStrength || 0}</td>
                    <td className="px-5 py-3.5 text-white/50">{academicClass.maxStudents}</td>
                    <td className="px-5 py-3.5">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(academicClass)}><Pencil size={13} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Update Class Strength">
        <div className="space-y-4">
          <Input label="Class" value={editing?.name || ''} disabled />
          <Input label="Class Strength" type="number" min={editing?.currentStrength || 1} max={500} value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} />
          <Button fullWidth loading={saving} onClick={save}>Update Strength</Button>
        </div>
      </Modal>
    </div>
  );
}
