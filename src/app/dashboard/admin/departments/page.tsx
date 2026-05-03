'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Input, Modal, Skeleton } from '@/components/ui';
import { Building2, Pencil, Plus, School, Trash2 } from 'lucide-react';
import { apiCall } from '@/utils/api';
import toast from 'react-hot-toast';

interface Department {
  _id: string;
  name: string;
  code?: string;
  description?: string;
}

interface AcademicClass {
  _id: string;
  name: string;
  code?: string;
  departmentId: string | Department;
  maxStudents: number;
  currentStrength?: number;
}

const EMPTY_DEPARTMENT = { name: '', code: '', description: '' };
const EMPTY_CLASS = { name: '', code: '', maxStudents: '10' };

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [departmentForm, setDepartmentForm] = useState(EMPTY_DEPARTMENT);
  const [classForm, setClassForm] = useState(EMPTY_CLASS);
  const [saving, setSaving] = useState(false);

  const selectedDepartment = useMemo(
    () => departments.find((department) => department._id === selectedDepartmentId),
    [departments, selectedDepartmentId]
  );

  const filteredClasses = useMemo(
    () => classes.filter((academicClass) => {
      const departmentId =
        typeof academicClass.departmentId === 'string'
          ? academicClass.departmentId
          : academicClass.departmentId._id;
      return departmentId === selectedDepartmentId;
    }),
    [classes, selectedDepartmentId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [departmentData, classData] = await Promise.all([
        apiCall<{ departments: Department[] }>('/api/admin/departments'),
        apiCall<{ classes: AcademicClass[] }>('/api/admin/classes'),
      ]);
      setDepartments(departmentData.departments);
      setClasses(classData.classes);
      setSelectedDepartmentId((current) => current || departmentData.departments[0]?._id || '');
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createDepartment = async () => {
    if (!departmentForm.name.trim()) return toast.error('Department name is required');
    setSaving(true);
    try {
      const data = await apiCall<{ department: Department }>('/api/admin/departments', {
        method: 'POST',
        body: JSON.stringify(departmentForm),
      });
      toast.success('Department created');
      setDepartments((items) => [...items, data.department].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedDepartmentId(data.department._id);
      setDepartmentForm(EMPTY_DEPARTMENT);
      setShowDepartmentModal(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openCreateClass = () => {
    setEditClassId(null);
    setClassForm(EMPTY_CLASS);
    setShowClassModal(true);
  };

  const openEditClass = (academicClass: AcademicClass) => {
    setEditClassId(academicClass._id);
    setClassForm({
      name: academicClass.name,
      code: academicClass.code || '',
      maxStudents: String(academicClass.maxStudents || 10),
    });
    setShowClassModal(true);
  };

  const saveClass = async () => {
    if (!selectedDepartmentId) return toast.error('Select a department first');
    if (!classForm.name.trim()) return toast.error('Class name is required');
    setSaving(true);
    try {
      if (editClassId) {
        const data = await apiCall<{ class: AcademicClass }>(`/api/admin/classes/${editClassId}`, {
          method: 'PATCH',
          body: JSON.stringify(classForm),
        });
        toast.success('Class updated');
        setClasses((items) => items.map((item) => item._id === editClassId ? data.class : item));
      } else {
        const data = await apiCall<{ class: AcademicClass }>('/api/admin/classes', {
          method: 'POST',
          body: JSON.stringify({ ...classForm, departmentId: selectedDepartmentId }),
        });
        toast.success('Class created');
        setClasses((items) => [...items, data.class].sort((a, b) => a.name.localeCompare(b.name)));
        setClassForm(EMPTY_CLASS);
      }
      setShowClassModal(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm('Delete this department?')) return;
    try {
      await apiCall(`/api/admin/departments/${id}`, { method: 'DELETE' });
      toast.success('Department deleted');
      setDepartments((items) => items.filter((item) => item._id !== id));
      if (selectedDepartmentId === id) setSelectedDepartmentId('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const deleteClass = async (id: string) => {
    if (!confirm('Delete this class?')) return;
    try {
      await apiCall(`/api/admin/classes/${id}`, { method: 'DELETE' });
      toast.success('Class deleted');
      setClasses((items) => items.filter((item) => item._id !== id));
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Departments & Classes</h1>
          <p className="text-white/40 text-sm mt-0.5">Build the academic hierarchy used for student enrollment</p>
        </div>
        <Button size="sm" onClick={() => setShowDepartmentModal(true)}>
          <Plus size={14} /> Department
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="font-display font-semibold text-white">Departments</div>
            <Badge value={String(departments.length)} />
          </div>
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : departments.length === 0 ? (
            <EmptyState icon={<Building2 size={32} />} title="No departments" action={<Button size="sm" onClick={() => setShowDepartmentModal(true)}>Create Department</Button>} />
          ) : (
            <div className="p-2 space-y-1">
              {departments.map((department) => (
                <button
                  key={department._id}
                  onClick={() => setSelectedDepartmentId(department._id)}
                  className={`w-full rounded-lg px-3 py-3 text-left transition ${
                    selectedDepartmentId === department._id
                      ? 'bg-brand-600/20 text-brand-200 border border-brand-500/25'
                      : 'text-white/60 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={16} />
                    <span className="font-medium">{department.name}</span>
                    {department.code && <span className="ml-auto text-xs text-white/35">{department.code}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-0 overflow-x-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div>
              <div className="font-display font-semibold text-white">{selectedDepartment?.name || 'Select department'}</div>
              <div className="text-xs text-white/35">{filteredClasses.length} classes</div>
            </div>
            <div className="flex gap-2">
              {selectedDepartment && (
                <Button variant="danger" size="sm" onClick={() => deleteDepartment(selectedDepartment._id)}>
                  <Trash2 size={14} />
                </Button>
              )}
              <Button size="sm" onClick={openCreateClass} disabled={!selectedDepartmentId}>
                <Plus size={14} /> Class
              </Button>
            </div>
          </div>

          {!selectedDepartmentId ? (
            <EmptyState icon={<School size={32} />} title="Choose a department" />
          ) : filteredClasses.length === 0 ? (
            <EmptyState icon={<School size={32} />} title="No classes yet" action={<Button size="sm" onClick={openCreateClass}>Create Class</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Class', 'Code', 'Strength', 'Actions'].map((header) => (
                    <th key={header} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((academicClass) => (
                  <tr key={academicClass._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium text-white">{academicClass.name}</td>
                    <td className="px-5 py-3 text-white/40">{academicClass.code || '-'}</td>
                    <td className="px-5 py-3 text-white/40">{academicClass.currentStrength || 0}/{academicClass.maxStudents}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => openEditClass(academicClass)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => deleteClass(academicClass._id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Modal isOpen={showDepartmentModal} onClose={() => setShowDepartmentModal(false)} title="Create Department">
        <div className="space-y-4">
          <Input label="Department Name" value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} placeholder="Computer Science" required />
          <Input label="Code" value={departmentForm.code} onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })} placeholder="CS" />
          <Input label="Description" value={departmentForm.description} onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })} placeholder="Optional" />
          <Button fullWidth loading={saving} onClick={createDepartment}>Create Department</Button>
        </div>
      </Modal>

      <Modal isOpen={showClassModal} onClose={() => setShowClassModal(false)} title={editClassId ? 'Edit Class' : 'Create Class'}>
        <div className="space-y-4">
          <Input label="Class Name" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} placeholder="BSCS 1A" required />
          <Input label="Code" value={classForm.code} onChange={(e) => setClassForm({ ...classForm, code: e.target.value })} placeholder="CS-1A" />
          <Input label="Class Strength" type="number" min={1} max={500} value={classForm.maxStudents} onChange={(e) => setClassForm({ ...classForm, maxStudents: e.target.value })} required />
          <Button fullWidth loading={saving} onClick={saveClass}>{editClassId ? 'Update Class' : 'Create Class'}</Button>
        </div>
      </Modal>
    </div>
  );
}
