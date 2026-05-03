'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Skeleton, Textarea } from '@/components/ui';
import { BookOpen, CalendarDays, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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

interface Teacher {
  _id: string;
  name: string;
  email: string;
  employeeId?: string;
  assignedClassIds: (string | AcademicClass)[];
}

interface Lecture {
  _id: string;
  title: string;
  subject: string;
  departmentId: string | Department;
  classId: string | AcademicClass;
  teacherId: string | Teacher;
  dayOfWeek?: string;
  lectureDate?: string;
  startTime: string;
  endTime: string;
  room?: string;
  notes?: string;
  status: string;
}

const DAYS = [
  { value: '', label: 'No Weekly Day' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const EMPTY_FORM = {
  title: '',
  subject: '',
  departmentId: '',
  classId: '',
  teacherId: '',
  dayOfWeek: '',
  lectureDate: '',
  startTime: '09:00',
  endTime: '10:00',
  room: '',
  notes: '',
  status: 'scheduled',
};

function refId(value: string | RefValue | undefined) {
  return typeof value === 'object' && value ? value._id : value || '';
}

function refName(value: string | RefValue | undefined) {
  return typeof value === 'object' && value ? value.name : '-';
}

function teacherName(value: string | Teacher | undefined) {
  return typeof value === 'object' && value ? value.name : '-';
}

function formatSchedule(lecture: Lecture) {
  const date = lecture.lectureDate ? format(new Date(lecture.lectureDate), 'MMM dd, yyyy') : '';
  const day = lecture.dayOfWeek ? lecture.dayOfWeek.charAt(0).toUpperCase() + lecture.dayOfWeek.slice(1) : '';
  return [date, day].filter(Boolean).join(' / ') || '-';
}

function teacherClassIds(teacher: Teacher) {
  return teacher.assignedClassIds.map((item) => refId(item)).filter(Boolean);
}

export default function AdminLecturesPage() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const classOptions = useMemo(() => {
    const departmentId = form.departmentId || filterDepartmentId;
    return classes.filter((academicClass) => {
      const classDepartmentId = refId(academicClass.departmentId);
      return !departmentId || classDepartmentId === departmentId;
    });
  }, [classes, filterDepartmentId, form.departmentId]);

  const teacherOptions = useMemo(() => {
    if (!form.classId) return teachers;
    return teachers.filter((teacher) => teacherClassIds(teacher).includes(form.classId));
  }, [form.classId, teachers]);

  const filteredLectures = useMemo(() => {
    const query = search.toLowerCase().trim();
    return lectures.filter((lecture) => {
      const inDepartment = !filterDepartmentId || refId(lecture.departmentId) === filterDepartmentId;
      const inClass = !filterClassId || refId(lecture.classId) === filterClassId;
      if (!query) return inDepartment && inClass;
      return (
        inDepartment &&
        inClass &&
        [lecture.title, lecture.subject, refName(lecture.classId), teacherName(lecture.teacherId)]
          .some((value) => value.toLowerCase().includes(query))
      );
    });
  }, [filterClassId, filterDepartmentId, lectures, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lectureData, teacherData, departmentData, classData] = await Promise.all([
        apiCall<{ lectures: Lecture[] }>('/api/admin/lectures'),
        apiCall<{ teachers: Teacher[] }>('/api/admin/teachers?status=approved'),
        apiCall<{ departments: Department[] }>('/api/admin/departments'),
        apiCall<{ classes: AcademicClass[] }>('/api/admin/classes'),
      ]);
      setLectures(lectureData.lectures);
      setTeachers(teacherData.teachers);
      setDepartments(departmentData.departments);
      setClasses(classData.classes);
    } catch {
      toast.error('Failed to load lectures');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, departmentId: filterDepartmentId, classId: filterClassId });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (lecture: Lecture) => {
    setForm({
      title: lecture.title,
      subject: lecture.subject,
      departmentId: refId(lecture.departmentId),
      classId: refId(lecture.classId),
      teacherId: refId(lecture.teacherId),
      dayOfWeek: lecture.dayOfWeek || '',
      lectureDate: lecture.lectureDate ? format(new Date(lecture.lectureDate), 'yyyy-MM-dd') : '',
      startTime: lecture.startTime,
      endTime: lecture.endTime,
      room: lecture.room || '',
      notes: lecture.notes || '',
      status: lecture.status,
    });
    setEditId(lecture._id);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title || !form.subject || !form.departmentId || !form.classId || !form.teacherId) {
      return toast.error('Title, subject, department, class, and teacher are required');
    }
    if (!form.dayOfWeek && !form.lectureDate) {
      return toast.error('Choose a weekly day or a specific lecture date');
    }

    setSaving(true);
    try {
      if (editId) {
        await apiCall(`/api/admin/lectures/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        toast.success('Lecture updated');
      } else {
        await apiCall('/api/admin/lectures', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        toast.success('Lecture created');
      }
      setShowModal(false);
      load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (lecture: Lecture) => {
    if (!confirm(`Delete ${lecture.title}?`)) return;
    try {
      await apiCall(`/api/admin/lectures/${lecture._id}`, { method: 'DELETE' });
      toast.success('Lecture deleted');
      setLectures((items) => items.filter((item) => item._id !== lecture._id));
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Lectures</h1>
          <p className="text-white/40 text-sm mt-0.5">Design student lecture schedules with assigned teachers</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus size={14} /> Add Lecture
        </Button>
      </div>

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
            .filter((academicClass) => !filterDepartmentId || refId(academicClass.departmentId) === filterDepartmentId)
            .map((academicClass) => ({ value: academicClass._id, label: academicClass.name }))]}
        />
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-[38px] text-white/30" />
          <Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, subject, class, or teacher" className="pl-9" />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filteredLectures.length === 0 ? (
          <EmptyState icon={<CalendarDays size={32} />} title="No lectures found" action={<Button size="sm" onClick={openAdd}>Add Lecture</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Lecture', 'Class', 'Teacher', 'Schedule', 'Room', 'Status', 'Actions'].map((header) => (
                    <th key={header} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLectures.map((lecture) => (
                  <tr key={lecture._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-white">{lecture.title}</div>
                      <div className="text-xs text-white/35">{lecture.subject}</div>
                    </td>
                    <td className="px-5 py-3.5 text-white/50">{refName(lecture.classId)}</td>
                    <td className="px-5 py-3.5 text-white/50">{teacherName(lecture.teacherId)}</td>
                    <td className="px-5 py-3.5 text-white/45">
                      <div>{formatSchedule(lecture)}</div>
                      <div className="text-xs text-white/30">{lecture.startTime} - {lecture.endTime}</div>
                    </td>
                    <td className="px-5 py-3.5 text-white/40">{lecture.room || '-'}</td>
                    <td className="px-5 py-3.5"><Badge value={lecture.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(lecture)}><Pencil size={13} /></Button>
                        <Button size="sm" variant="danger" onClick={() => remove(lecture)}><Trash2 size={13} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Lecture' : 'Add Lecture'} size="xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Lecture Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Introduction to Databases" required />
            <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Database Systems" required />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              label="Department"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value, classId: '', teacherId: '' })}
              options={[{ value: '', label: 'Select Department' }, ...departments.map((department) => ({ value: department._id, label: department.name }))]}
            />
            <Select
              label="Class"
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value, teacherId: '' })}
              options={[{ value: '', label: 'Select Class' }, ...classOptions.map((academicClass) => ({ value: academicClass._id, label: academicClass.name }))]}
            />
            <Select
              label="Teacher"
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              options={[{ value: '', label: 'Select Teacher' }, ...teacherOptions.map((teacher) => ({ value: teacher._id, label: teacher.name }))]}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Select
              label="Weekly Day"
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
              options={DAYS}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-white/70">Specific Date</label>
              <input type="date" value={form.lectureDate} onChange={(e) => setForm({ ...form, lectureDate: e.target.value })} className="w-full px-3.5 py-2.5 text-sm rounded-lg" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-white/70">Start Time</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full px-3.5 py-2.5 text-sm rounded-lg" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-white/70">End Time</label>
              <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full px-3.5 py-2.5 text-sm rounded-lg" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Lab 2" />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setShowModal(false)}>Cancel</Button>
            <Button fullWidth loading={saving} onClick={save}><BookOpen size={14} /> {editId ? 'Update Lecture' : 'Create Lecture'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
