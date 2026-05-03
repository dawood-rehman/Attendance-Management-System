'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Skeleton } from '@/components/ui';
import { Download, GraduationCap, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { apiCall } from '@/utils/api';
import toast from 'react-hot-toast';

interface RefValue {
  _id: string;
  name: string;
  code?: string;
}

interface Department extends RefValue {}
interface AcademicClass extends RefValue {
  departmentId: string | Department;
}

interface Student {
  _id: string;
  name: string;
  rollNumber: string;
  email: string;
  departmentId: string | Department;
  classId: string | AcademicClass;
  userId?: string | { _id: string; status: string; mustChangePassword?: boolean };
}

const EMPTY_FORM = {
  name: '',
  rollNumber: '',
  email: '',
  password: '',
  departmentId: '',
  classId: '',
};

function refName(value: string | RefValue | undefined) {
  return typeof value === 'object' && value ? value.name : '-';
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const classOptions = useMemo(() => {
    const departmentId = form.departmentId || filterDepartmentId;
    return classes.filter((academicClass) => {
      const classDepartmentId =
        typeof academicClass.departmentId === 'string'
          ? academicClass.departmentId
          : academicClass.departmentId._id;
      return !departmentId || classDepartmentId === departmentId;
    });
  }, [classes, form.departmentId, filterDepartmentId]);

  const loadStructure = useCallback(async () => {
    const [departmentData, classData] = await Promise.all([
      apiCall<{ departments: Department[] }>('/api/admin/departments'),
      apiCall<{ classes: AcademicClass[] }>('/api/admin/classes'),
    ]);
    setDepartments(departmentData.departments);
    setClasses(classData.classes);
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterDepartmentId) params.set('departmentId', filterDepartmentId);
      if (filterClassId) params.set('classId', filterClassId);
      params.set('limit', '200');
      const data = await apiCall<{ students: Student[] }>(`/api/teacher/students?${params}`);
      setStudents(data.students);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [filterClassId, filterDepartmentId, search]);

  useEffect(() => {
    loadStructure().catch(() => toast.error('Failed to load departments'));
  }, [loadStructure]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, departmentId: filterDepartmentId, classId: filterClassId });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (student: Student) => {
    const departmentId = typeof student.departmentId === 'string' ? student.departmentId : student.departmentId._id;
    const classId = typeof student.classId === 'string' ? student.classId : student.classId._id;
    setForm({
      name: student.name,
      rollNumber: student.rollNumber,
      email: student.email,
      password: '',
      departmentId,
      classId,
    });
    setEditId(student._id);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name || !form.rollNumber || !form.departmentId || !form.classId) {
      return toast.error('Name, roll number, department, and class are required');
    }

    setSaving(true);
    try {
      if (editId) {
        await apiCall(`/api/teacher/students/${editId}`, { method: 'PATCH', body: JSON.stringify(form) });
        toast.success('Student updated');
      } else {
        await apiCall('/api/teacher/students', { method: 'POST', body: JSON.stringify(form) });
        toast.success('Student added');
      }
      setShowModal(false);
      loadStudents();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeStudent = async (id: string) => {
    if (!confirm('Delete this student and linked login account?')) return;
    try {
      await apiCall(`/api/teacher/students/${id}`, { method: 'DELETE' });
      toast.success('Student deleted');
      setStudents((items) => items.filter((item) => item._id !== id));
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!filterDepartmentId || !filterClassId) {
      e.target.value = '';
      return toast.error('Select department and class before upload');
    }

    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('departmentId', filterDepartmentId);
    fd.append('classId', filterClassId);

    try {
      const token = localStorage.getItem('auth-token');
      const res = await fetch('/api/teacher/students/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.inserted} students imported`);
      if (data.errors?.length) toast(`${data.errors.length} rows skipped`, { icon: '!' });
      loadStudents();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const downloadTemplate = () => {
    const csv = 'Name,Roll Number,Password\nAyesha Khan,001,\nAli Raza,002,';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Students</h1>
          <p className="text-white/40 text-sm mt-0.5">Enroll students into department classes and create login accounts</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download size={14} /> Template
          </Button>
          <label>
            <Button variant="secondary" size="sm" loading={uploading} as="span">
              <Upload size={14} /> Upload Excel
            </Button>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={upload} />
          </label>
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} /> Add Student
          </Button>
        </div>
      </div>

      {departments.length === 0 || classes.length === 0 ? (
        <Card className="border-amber-500/20 bg-amber-500/10">
          <div className="font-display font-semibold text-amber-200">Academic structure required</div>
          <p className="mt-1 text-sm text-amber-100/70">
            Create at least one department and class before adding students.
          </p>
          <Link href="/dashboard/admin/departments" className="mt-3 inline-block text-sm font-medium text-amber-200 hover:text-amber-100">
            Manage departments
          </Link>
        </Card>
      ) : null}

      <Card className="grid gap-3 md:grid-cols-4">
        <Select
          label="Department"
          value={filterDepartmentId}
          onChange={(e) => { setFilterDepartmentId(e.target.value); setFilterClassId(''); }}
          options={[{ value: '', label: 'All Departments' }, ...departments.map((department) => ({ value: department._id, label: department.name }))]}
        />
        <Select
          label="Class"
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
          options={[{ value: '', label: 'All Classes' }, ...classes
            .filter((academicClass) => {
              const departmentId = typeof academicClass.departmentId === 'string' ? academicClass.departmentId : academicClass.departmentId._id;
              return !filterDepartmentId || departmentId === filterDepartmentId;
            })
            .map((academicClass) => ({ value: academicClass._id, label: academicClass.name }))]}
        />
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-[38px] text-white/30" />
          <Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, roll number, or email" className="pl-9" />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : students.length === 0 ? (
          <EmptyState icon={<GraduationCap size={32} />} title="No students found" action={<Button size="sm" onClick={openAdd}>Add Student</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Name', 'Roll No.', 'Department', 'Class', 'Email', 'Login', 'Actions'].map((header) => (
                    <th key={header} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const linkedUser = typeof student.userId === 'object' ? student.userId : undefined;
                  return (
                    <tr key={student._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-medium text-white">{student.name}</td>
                      <td className="px-5 py-3 text-white/50 font-mono text-xs">{student.rollNumber}</td>
                      <td className="px-5 py-3 text-white/50">{refName(student.departmentId)}</td>
                      <td className="px-5 py-3 text-white/50">{refName(student.classId)}</td>
                      <td className="px-5 py-3 text-white/40 text-xs">{student.email}</td>
                      <td className="px-5 py-3">
                        <Badge value={linkedUser?.mustChangePassword ? 'pending' : linkedUser?.status || 'approved'} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(student)}><Pencil size={13} /></Button>
                          <Button size="sm" variant="danger" onClick={() => removeStudent(student._id)}><Trash2 size={13} /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Student' : 'Add Student'} size="lg">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Roll Number" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} required />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Department"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value, classId: '' })}
              options={[{ value: '', label: 'Select Department' }, ...departments.map((department) => ({ value: department._id, label: department.name }))]}
            />
            <Select
              label="Class"
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              options={[{ value: '', label: 'Select Class' }, ...classOptions.map((academicClass) => ({ value: academicClass._id, label: academicClass.name }))]}
            />
          </div>
          {editId ? (
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          ) : (
            <div className="rounded-lg border border-brand-500/20 bg-brand-500/10 px-3 py-2.5 text-sm text-brand-200">
              Student email will be generated automatically from the student name and class sequence.
            </div>
          )}
          <Input
            label={editId ? 'Reset Password' : 'Password'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            hint={editId ? 'Leave blank to keep current password' : 'Leave blank to use student email as default password'}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setShowModal(false)}>Cancel</Button>
            <Button fullWidth loading={saving} onClick={save}>{editId ? 'Update' : 'Add Student'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
