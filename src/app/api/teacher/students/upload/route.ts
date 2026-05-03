import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import AcademicClass from '@/models/AcademicClass';
import Department from '@/models/Department';
import ExcelUpload from '@/models/ExcelUpload';
import Student from '@/models/Student';
import User from '@/models/User';
import { generateStudentEmail } from '@/lib/email-generator';
import { ensureTeacherProfile } from '@/lib/profiles';
import * as XLSX from 'xlsx';

function cell(row: Record<string, unknown>, labels: string[]) {
  for (const label of labels) {
    const value = row[label];
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return '';
}

// POST /api/teacher/students/upload - Upload Excel file
export const POST = requireAuth(async (req: NextRequest, user) => {
  try {
    if (!['teacher', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const selectedDepartmentId = String(formData.get('departmentId') || '');
    const selectedClassId = String(formData.get('classId') || '');
    const teacher = user.role === 'teacher' ? await ensureTeacherProfile(user.userId) : null;

    if (user.role === 'teacher' && !teacher) {
      return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json({ error: 'Only Excel or CSV files are allowed' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    if (!data.length) {
      return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 });
    }

    const upload = await ExcelUpload.create({
      fileName: file.name,
      uploaderId: user.userId,
      status: 'processing',
    });

    const [departments, classes] = await Promise.all([
      Department.find({}).lean(),
      AcademicClass.find({}).lean(),
    ]);
    const departmentByName = new Map(departments.map((department) => [department.name.toLowerCase(), department]));
    const classByDepartmentAndName = new Map(
      classes.map((academicClass) => [
        `${academicClass.departmentId.toString()}::${academicClass.name.toLowerCase()}`,
        academicClass,
      ])
    );
    const classById = new Map(classes.map((academicClass) => [academicClass._id.toString(), academicClass]));
    const classCounts = new Map<string, number>();
    await Promise.all(
      classes.map(async (academicClass) => {
        const count = await Student.countDocuments({ classId: academicClass._id });
        classCounts.set(academicClass._id.toString(), count);
      })
    );

    const errors: string[] = [];
    let inserted = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = cell(row, ['Name', 'name', 'Student Name']);
      const rollNumber = cell(row, ['Roll Number', 'roll_number', 'Roll No', 'RollNo']);
      const providedEmail = cell(row, ['Email', 'email']).toLowerCase();
      const password = cell(row, ['Password', 'password']);
      const phone = cell(row, ['Phone', 'phone']);
      const departmentName = cell(row, ['Department', 'department']);
      const className = cell(row, ['Class', 'class']);

      if (!name || !rollNumber) {
        errors.push(`Row ${i + 2}: Missing required fields (Name, Roll Number)`);
        continue;
      }

      let departmentId = selectedDepartmentId;
      if (!departmentId && departmentName) {
        departmentId = departmentByName.get(departmentName.toLowerCase())?._id.toString() || '';
      }

      let academicClass = selectedClassId ? classById.get(selectedClassId) : undefined;
      if (!academicClass && departmentId && className) {
        academicClass = classByDepartmentAndName.get(`${departmentId}::${className.toLowerCase()}`);
      }

      if (!departmentId || !academicClass || academicClass.departmentId.toString() !== departmentId) {
        errors.push(`Row ${i + 2}: Department and Class are required and must match`);
        continue;
      }

      if (teacher) {
        const assignedClassIds = teacher.assignedClassIds.map((id) => id.toString());
        if (!assignedClassIds.includes(academicClass._id.toString())) {
          errors.push(`Row ${i + 2}: Class is not assigned to your teacher account`);
          continue;
        }
      }

      const academicClassId = academicClass._id.toString();
      const currentClassStrength = classCounts.get(academicClassId) || 0;
      if (currentClassStrength >= academicClass.maxStudents) {
        errors.push(`Row ${i + 2}: Class strength limit reached (${academicClass.maxStudents} students)`);
        continue;
      }

      let createdUserId: string | null = null;
      try {
        const email = providedEmail || await generateStudentEmail(name, academicClassId);
        const existingUser = await User.findOne({ email }).lean();
        if (existingUser) {
          errors.push(`Row ${i + 2}: Email already exists`);
          continue;
        }

        const studentUser = await User.create({
          name,
          email,
          password: password || email,
          role: 'student',
          status: 'approved',
          mustChangePassword: true,
        });
        createdUserId = studentUser._id.toString();

        await Student.create({
          name,
          rollNumber,
          email,
          phone: phone || undefined,
          userId: studentUser._id,
          teacherId: teacher?._id,
          departmentId,
          classId: academicClass._id,
          class: academicClass.name,
        });

        inserted += 1;
        classCounts.set(academicClassId, currentClassStrength + 1);
      } catch (error: unknown) {
        if (createdUserId) {
          await User.findByIdAndDelete(createdUserId).catch(() => {});
        }
        const duplicate = (error as { code?: number }).code === 11000;
        errors.push(`Row ${i + 2}: ${duplicate ? 'Duplicate roll number in class' : 'Could not import student'}`);
      }
    }

    await ExcelUpload.findByIdAndUpdate(upload._id, {
      recordCount: inserted,
      status: errors.length > 0 && inserted === 0 ? 'failed' : 'completed',
      errorMessages: errors,
    });

    return NextResponse.json({
      message: `${inserted} students imported successfully`,
      inserted,
      errors,
      uploadId: upload._id,
    });
  } catch (error) {
    console.error('Excel upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
