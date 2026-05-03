'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Skeleton } from '@/components/ui';
import { GraduationCap, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
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

interface TeacherUser {
  _id: string;
  status: string;
  mustChangePassword?: boolean;
}

interface Teacher {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  employeeId?: string;
  education?: string;
  degree?: string;
  departmentId?: string | Department;
  assignedClassIds: (string | AcademicClass)[];
  userId?: string | TeacherUser;
}

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
  employeeId: '',
  education: '',
  degree: '',
  departmentId: '',
  assignedClassIds: [] as string[],
  status: 'approved',
};

function refId(value: string | RefValue | undefined) {
  return typeof value === 'object' && value ? value._id : value || '';
}

function refName(value: string | RefValue | undefined) {
  return typeof value === 'object' && value ? value.name : '-';
}

function classNames(classes: (string | AcademicClass)[]) {
  const names = classes
    .map((item) => (typeof item === 'object' ? item.name : ''))
    .filter(Boolean);
  return names.length ? names.join(', ') : '-';
}

function userStatus(user: string | TeacherUser | undefined) {
  return typeof user === 'object' && user ? user.status : 'approved';
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [search, setSearch] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const visibleClasses = useMemo(() => {
    return classes.filter((academicClass) => {
      const departmentId = refId(academicClass.departmentId);
      return !form.departmentId || departmentId === form.departmentId;
    });
  }, [classes, form.departmentId]);

  const filteredTeachers = useMemo(() => {
    const query = search.toLowerCase().trim();
    return teachers.filter((teacher) => {
      const inDepartment = !filterDepartmentId || refId(teacher.departmentId) === filterDepartmentId;
      if (!query) return inDepartment;
      return (
        inDepartment &&
        [teacher.name, teacher.email, teacher.employeeId || '']
          .some((value) => value.toLowerCase().includes(query))
      );
    });
  }, [filterDepartmentId, search, teachers]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teacherData, departmentData, classData] = await Promise.all([
        apiCall<{ teachers: Teacher[] }>('/api/admin/teachers'),
        apiCall<{ departments: Department[] }>('/api/admin/departments'),
        apiCall<{ classes: AcademicClass[] }>('/api/admin/classes'),
      ]);
      setTeachers(teacherData.teachers);
      setDepartments(departmentData.departments);
      setClasses(classData.classes);
    } catch {
      toast.error('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (teacher: Teacher) => {
    setForm({
      name: teacher.name,
      email: teacher.email,
      password: '',
      phone: teacher.phone || '',
      employeeId: teacher.employeeId || '',
      education: teacher.education || '',
      degree: teacher.degree || '',
      departmentId: refId(teacher.departmentId),
      assignedClassIds: teacher.assignedClassIds.map((item) => refId(item)).filter(Boolean),
      status: userStatus(teacher.userId),
    });
    setEditId(teacher._id);
    setShowModal(true);
  };

  const toggleClass = (classId: string) => {
    setForm((current) => ({
      ...current,
      assignedClassIds: current.assignedClassIds.includes(classId)
        ? current.assignedClassIds.filter((id) => id !== classId)
        : [...current.assignedClassIds, classId],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      return toast.error('Teacher name is required');
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        departmentId: form.departmentId || '',
        password: form.password || '',
      };

      if (editId) {
        await apiCall(`/api/admin/teachers/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Teacher updated');
      } else {
        await apiCall('/api/admin/teachers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Teacher account created');
      }

      setShowModal(false);
      load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (teacher: Teacher) => {
    if (!confirm(`Delete ${teacher.name}?`)) return;
    try {
      await apiCall(`/api/admin/teachers/${teacher._id}`, { method: 'DELETE' });
      toast.success('Teacher deleted');
      setTeachers((items) => items.filter((item) => item._id !== teacher._id));
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Teachers</h1>
          <p className="text-white/40 text-sm mt-0.5">Create teacher accounts and assign them to classes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw size={14} />
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} /> Add Teacher
          </Button>
        </div>
      </div>

      <Card className="grid gap-3 md:grid-cols-3">
        <Select
          label="Department"
          value={filterDepartmentId}
          onChange={(e) => setFilterDepartmentId(e.target.value)}
          options={[{ value: '', label: 'All Departments' }, ...departments.map((department) => ({ value: department._id, label: department.name }))]}
        />
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-[38px] text-white/30" />
          <Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, or employee ID" className="pl-9" />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filteredTeachers.length === 0 ? (
          <EmptyState icon={<GraduationCap size={32} />} title="No teachers found" action={<Button size="sm" onClick={openAdd}>Add Teacher</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Teacher', 'Education', 'Classes', 'Status', 'Actions'].map((header) => (
                    <th key={header} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-white">{teacher.name}</div>
                      <div className="text-xs text-white/35">{teacher.email}</div>
                    </td>
                    <td className="px-5 py-3.5 text-white/50">
                      <div>{teacher.education || '-'}</div>
                      <div className="text-xs text-white/30">{teacher.degree || ''}</div>
                    </td>
                    <td className="px-5 py-3.5 text-white/45 max-w-md">{classNames(teacher.assignedClassIds)}</td>
                    <td className="px-5 py-3.5"><Badge value={userStatus(teacher.userId)} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(teacher)}><Pencil size={13} /></Button>
                        <Button size="sm" variant="danger" onClick={() => remove(teacher)}><Trash2 size={13} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Teacher' : 'Add Teacher'} size="xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            {editId ? (
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            ) : (
              <div className="rounded-lg border border-brand-500/20 bg-brand-500/10 px-3 py-2.5 text-sm text-brand-200">
                Teacher email will be generated automatically from the teacher name and sequence.
              </div>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label={editId ? 'Reset Password' : 'Password'} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint={editId ? 'Leave blank to keep current password' : 'Leave blank to use teacher email as default password'} />
            <Input label="Employee ID" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Education" value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} placeholder="MSc Computer Science" />
            <Input label="Degree" value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} placeholder="BS / MS / MPhil" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            {editId ? (
              <Select
                label="Department"
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                options={[{ value: '', label: 'No Department' }, ...departments.map((department) => ({ value: department._id, label: department.name }))]}
              />
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white/45">
                Department and classes can be assigned after the teacher account is created.
              </div>
            )}
          </div>
          {editId && (
            <Select
              label="Account Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: 'approved', label: 'Approved' },
                { value: 'pending', label: 'Pending' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          )}
          {editId && (
            <div>
              <div className="text-sm font-medium text-white/70 mb-2">Assigned Classes</div>
              <div className="grid gap-2 md:grid-cols-2 max-h-60 overflow-y-auto pr-1">
                {visibleClasses.length === 0 ? (
                  <div className="text-sm text-white/35 rounded-lg border border-white/10 px-3 py-3">No classes available</div>
                ) : visibleClasses.map((academicClass) => (
                  <label key={academicClass._id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white/70 hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={form.assignedClassIds.includes(academicClass._id)}
                      onChange={() => toggleClass(academicClass._id)}
                      className="h-4 w-4 rounded border-white/20"
                    />
                    <span className="min-w-0">
                      <span className="block text-white">{academicClass.name}</span>
                      <span className="block text-xs text-white/35">{academicClass.code || refName(academicClass.departmentId)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setShowModal(false)}>Cancel</Button>
            <Button fullWidth loading={saving} onClick={save}>{editId ? 'Update Teacher' : 'Create Teacher'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
