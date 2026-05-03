import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import { buildAttendanceEmailHTML, sendEmail } from '@/lib/email/nodemailer';
import AcademicClass from '@/models/AcademicClass';
import Department from '@/models/Department';
import Message from '@/models/Message';
import Student from '@/models/Student';
import Teacher from '@/models/Teacher';
import User from '@/models/User';
import { ensureTeacherProfile } from '@/lib/profiles';

const SendMessageSchema = z.object({
  recipientType: z.enum(['admin', 'teacher', 'student']),
  recipientUserId: z.string().optional().or(z.literal('')),
  departmentId: z.string().optional().or(z.literal('')),
  classId: z.string().optional().or(z.literal('')),
  studentName: z.string().min(2).max(100).optional(),
  studentRollNumber: z.string().min(1).max(50).optional(),
  subject: z.string().min(2).max(160),
  body: z.string().min(2).max(2000),
  sendEmail: z.boolean().optional(),
  parentMessageId: z.string().optional().or(z.literal('')),
});

type StudentContext = {
  studentName?: string;
  studentEmail?: string;
  studentDepartment?: string;
  studentClass?: string;
  studentRollNumber?: string;
};

function idString(value: unknown) {
  if (!value) return undefined;
  if (typeof value === 'object' && '_id' in value && value._id) {
    return String(value._id);
  }
  return String(value);
}

async function getStudentRecipients(userId: string) {
  const [student, admins, departments, classes, teachers] = await Promise.all([
    Student.findOne({ userId })
      .populate('departmentId', 'name code')
      .populate('classId', 'name code departmentId')
      .lean(),
    User.find({ role: 'admin', status: 'approved' })
      .select('_id name email role')
      .sort({ createdAt: 1 })
      .lean(),
    Department.find({}).select('_id name code').sort({ name: 1 }).lean(),
    AcademicClass.find({}).select('_id name code departmentId').sort({ name: 1 }).lean(),
    Teacher.find({})
      .populate('userId', 'name email role status')
      .sort({ name: 1 })
      .lean(),
  ]);

  return {
    student: student
      ? {
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          departmentId: idString(student.departmentId),
          classId: idString(student.classId),
        }
      : null,
    admins: admins.map((admin) => ({
      _id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
    })),
    departments: departments.map((department) => ({
      _id: department._id.toString(),
      name: department.name,
      code: department.code,
    })),
    classes: classes.map((academicClass) => ({
      _id: academicClass._id.toString(),
      name: academicClass.name,
      code: academicClass.code,
      departmentId: academicClass.departmentId.toString(),
    })),
    teachers: teachers
      .filter((teacher) => typeof teacher.userId === 'object' && teacher.userId)
      .map((teacher) => {
        const teacherUser = teacher.userId as unknown as {
          _id: { toString(): string };
          name: string;
          email: string;
          status: string;
        };
        return {
          _id: teacherUser._id.toString(),
          teacherProfileId: teacher._id.toString(),
          name: teacher.name || teacherUser.name,
          email: teacher.email || teacherUser.email,
          status: teacherUser.status,
          assignedClassIds: teacher.assignedClassIds.map((id) => id.toString()),
          departmentId: teacher.departmentId?.toString(),
        };
      })
      .filter((teacher) => teacher.status === 'approved'),
  };
}

async function getAdminRecipients() {
  const [teachers, students] = await Promise.all([
    Teacher.find({}).populate('userId', 'name email role status').sort({ name: 1 }).lean(),
    Student.find({})
      .populate('userId', 'name email role status')
      .populate('departmentId', 'name code')
      .populate('classId', 'name code')
      .sort({ name: 1 })
      .lean(),
  ]);

  return {
    teachers: teachers
      .filter((teacher) => typeof teacher.userId === 'object' && teacher.userId)
      .map((teacher) => {
        const teacherUser = teacher.userId as unknown as {
          _id: { toString(): string };
          name: string;
          email: string;
          status: string;
        };
        return {
          _id: teacherUser._id.toString(),
          name: teacher.name || teacherUser.name,
          email: teacher.email || teacherUser.email,
          status: teacherUser.status,
        };
      })
      .filter((teacher) => teacher.status === 'approved'),
    students: students
      .filter((student) => typeof student.userId === 'object' && student.userId)
      .map((student) => {
        const studentUser = student.userId as unknown as {
          _id: { toString(): string };
          email: string;
          status: string;
        };
        const department = student.departmentId as unknown as { name?: string } | undefined;
        const academicClass = student.classId as unknown as { name?: string } | undefined;
        return {
          _id: studentUser._id.toString(),
          name: student.name,
          email: student.email || studentUser.email,
          status: studentUser.status,
          department: department?.name,
          className: academicClass?.name || student.class,
          rollNumber: student.rollNumber,
        };
      })
      .filter((student) => student.status === 'approved'),
  };
}

async function getTeacherRecipients(userId: string) {
  const teacher = await ensureTeacherProfile(userId);
  const admins = await User.find({ role: 'admin', status: 'approved' })
    .select('_id name email role')
    .sort({ createdAt: 1 })
    .lean();

  const students = teacher
    ? await Student.find({ classId: { $in: teacher.assignedClassIds } })
        .populate('userId', 'name email role status')
        .populate('departmentId', 'name code')
        .populate('classId', 'name code')
        .sort({ name: 1 })
        .lean()
    : [];

  return {
    admins: admins.map((admin) => ({
      _id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
    })),
    students: students
      .filter((student) => typeof student.userId === 'object' && student.userId)
      .map((student) => {
        const studentUser = student.userId as unknown as {
          _id: { toString(): string };
          email: string;
          status: string;
        };
        const department = student.departmentId as unknown as { name?: string } | undefined;
        const academicClass = student.classId as unknown as { name?: string } | undefined;
        return {
          _id: studentUser._id.toString(),
          name: student.name,
          email: student.email || studentUser.email,
          status: studentUser.status,
          department: department?.name,
          className: academicClass?.name || student.class,
          rollNumber: student.rollNumber,
        };
      })
      .filter((student) => student.status === 'approved'),
  };
}

async function resolveRecipient(
  recipientType: 'admin' | 'teacher',
  recipientUserId: string,
  classId: string
) {
  if (recipientType === 'admin') {
    const admin = await User.findOne({ _id: recipientUserId, role: 'admin', status: 'approved' }).lean();
    if (!admin) return null;
    return { userId: admin._id, name: admin.name, email: admin.email };
  }

  const teacher = await Teacher.findOne({
    userId: recipientUserId,
    assignedClassIds: classId,
  }).lean();
  if (!teacher) return null;

  return { userId: teacher.userId, name: teacher.name, email: teacher.email };
}

async function getStudentContextByUserId(userId: string): Promise<StudentContext> {
  const student = await Student.findOne({ userId })
    .populate('departmentId', 'name code')
    .populate('classId', 'name code')
    .lean();

  if (!student) return {};
  const department = student.departmentId as unknown as { name?: string } | undefined;
  const academicClass = student.classId as unknown as { name?: string } | undefined;

  return {
    studentName: student.name,
    studentEmail: student.email,
    studentDepartment: department?.name,
    studentClass: academicClass?.name || student.class,
    studentRollNumber: student.rollNumber,
  };
}

async function resolveStaffRecipient(
  senderRole: string,
  senderUserId: string,
  recipientType: 'admin' | 'teacher' | 'student',
  recipientUserId: string
) {
  if (senderRole === 'admin') {
    const allowedRole = recipientType === 'teacher' ? 'teacher' : recipientType === 'student' ? 'student' : '';
    if (!allowedRole) return null;
    const target = await User.findOne({ _id: recipientUserId, role: allowedRole, status: 'approved' }).lean();
    if (!target) return null;
    return { userId: target._id, name: target.name, email: target.email };
  }

  if (senderRole === 'teacher') {
    if (recipientType === 'admin') {
      const admin = await User.findOne({ _id: recipientUserId, role: 'admin', status: 'approved' }).lean();
      if (!admin) return null;
      return { userId: admin._id, name: admin.name, email: admin.email };
    }

    if (recipientType === 'student') {
      const teacher = await ensureTeacherProfile(senderUserId);
      if (!teacher) return null;
      const student = await Student.findOne({
        userId: recipientUserId,
        classId: { $in: teacher.assignedClassIds },
      }).lean();
      if (!student) return null;
      return { userId: student.userId, name: student.name, email: student.email };
    }
  }

  return null;
}

async function buildSubmittedStudentContext(input: {
  departmentId: string;
  classId: string;
  studentName: string;
  studentRollNumber: string;
  senderEmail: string;
}): Promise<StudentContext | null> {
  const [department, academicClass] = await Promise.all([
    Department.findById(input.departmentId).lean(),
    AcademicClass.findById(input.classId).lean(),
  ]);

  if (!department || !academicClass || academicClass.departmentId.toString() !== input.departmentId) {
    return null;
  }

  return {
    studentName: input.studentName,
    studentEmail: input.senderEmail,
    studentDepartment: department.name,
    studentClass: academicClass.name,
    studentRollNumber: input.studentRollNumber,
  };
}

function studentDetailsHTML(context: StudentContext) {
  const details = [
    ['Name', context.studentName],
    ['Department', context.studentDepartment],
    ['Class', context.studentClass],
    ['Roll Number', context.studentRollNumber],
    ['Email', context.studentEmail],
  ].filter(([, value]) => Boolean(value));

  if (!details.length) return '';
  return `
    <p><strong>Student Details</strong></p>
    <ul>
      ${details.map(([label, value]) => `<li><strong>${label}:</strong> ${value}</li>`).join('')}
    </ul>
  `;
}

export const GET = requireAuth(async (req: NextRequest, user) => {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    if (searchParams.get('recipients') === '1') {
      if (user.role === 'student') {
        return NextResponse.json(await getStudentRecipients(user.userId));
      }
      if (user.role === 'admin') {
        return NextResponse.json(await getAdminRecipients());
      }
      if (user.role === 'teacher') {
        return NextResponse.json(await getTeacherRecipients(user.userId));
      }
      return NextResponse.json({});
    }

    const filter: Record<string, unknown> = {
      $or: [{ senderUserId: user.userId }, { recipientUserId: user.userId }],
    };

    const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return NextResponse.json({ messages, currentUserId: user.userId });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = requireAuth(async (req: NextRequest, user) => {
  try {
    await connectDB();
    const parsed = SendMessageSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const sender = await User.findById(user.userId).lean();
    if (!sender) return NextResponse.json({ error: 'Sender not found' }, { status: 404 });

    let recipient: { userId: unknown; name: string; email: string } | null = null;
    let studentContext: StudentContext = {};
    let parentMessageId: string | undefined;
    let messageRecipientType: 'admin' | 'teacher' | 'student' = parsed.data.recipientType;

    if (parsed.data.parentMessageId) {
      const parent = await Message.findById(parsed.data.parentMessageId).lean();
      if (!parent) return NextResponse.json({ error: 'Original message not found' }, { status: 404 });

      const isParticipant =
        parent.senderUserId.toString() === user.userId ||
        parent.recipientUserId.toString() === user.userId;
      if (!isParticipant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const replyToUserId =
        parent.senderUserId.toString() === user.userId
          ? parent.recipientUserId
          : parent.senderUserId;
      const replyTo = await User.findById(replyToUserId).lean();
      if (!replyTo) return NextResponse.json({ error: 'Reply recipient not found' }, { status: 404 });

      recipient = { userId: replyTo._id, name: replyTo.name, email: replyTo.email };
      messageRecipientType = replyTo.role as 'admin' | 'teacher' | 'student';
      studentContext = {
        studentName: parent.studentName,
        studentEmail: parent.studentEmail,
        studentDepartment: parent.studentDepartment,
        studentClass: parent.studentClass,
        studentRollNumber: parent.studentRollNumber,
      };
      parentMessageId = parent.parentMessageId?.toString() || parent._id.toString();
    } else {
      if (!parsed.data.recipientUserId) {
        return NextResponse.json({ error: 'Select a specific recipient' }, { status: 400 });
      }

      if (user.role === 'student') {
        if (parsed.data.recipientType === 'student') {
          return NextResponse.json({ error: 'Students can message admin or teachers only' }, { status: 400 });
        }
        if (!parsed.data.departmentId || !parsed.data.classId) {
          return NextResponse.json({ error: 'Department and class are required' }, { status: 400 });
        }
        if (!parsed.data.studentName || !parsed.data.studentRollNumber) {
          return NextResponse.json({ error: 'Student name and roll number are required' }, { status: 400 });
        }

        studentContext = await buildSubmittedStudentContext({
          departmentId: parsed.data.departmentId,
          classId: parsed.data.classId,
          studentName: parsed.data.studentName,
          studentRollNumber: parsed.data.studentRollNumber,
          senderEmail: sender.email,
        }) || {};

        if (!studentContext.studentDepartment || !studentContext.studentClass) {
          return NextResponse.json({ error: 'Class not found in selected department' }, { status: 404 });
        }

        recipient = await resolveRecipient(
          parsed.data.recipientType,
          parsed.data.recipientUserId,
          parsed.data.classId
        );
      } else {
        recipient = await resolveStaffRecipient(
          user.role,
          user.userId,
          parsed.data.recipientType,
          parsed.data.recipientUserId
        );
        if (parsed.data.recipientType === 'student') {
          studentContext = await getStudentContextByUserId(parsed.data.recipientUserId);
        }
      }
    }

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found or not linked to your class' }, { status: 404 });
    }

    let deliveryStatus: 'sent' | 'email_failed' = 'sent';
    let emailError: string | undefined;
    const channel = parsed.data.sendEmail ? 'email' : 'message';

    if (parsed.data.sendEmail) {
      try {
        await sendEmail({
          to: recipient.email,
          subject: parsed.data.subject,
          text: parsed.data.body,
          html: buildAttendanceEmailHTML(`
            <p><strong>From:</strong> ${sender.name} (${sender.email})</p>
            ${studentDetailsHTML(studentContext)}
            <p><strong>Message:</strong></p>
            <p>${parsed.data.body}</p>
          `),
        });
      } catch (error) {
        deliveryStatus = 'email_failed';
        emailError = (error as Error).message;
      }
    }

    const message = await Message.create({
      parentMessageId,
      senderUserId: sender._id,
      senderName: sender.name,
      senderEmail: sender.email,
      senderRole: sender.role,
      recipientType: messageRecipientType,
      recipientUserId: recipient.userId,
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      subject: parsed.data.subject,
      body: parsed.data.body,
      channel,
      deliveryStatus,
      emailError,
      ...studentContext,
    });

    return NextResponse.json({ message, emailError }, { status: 201 });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
