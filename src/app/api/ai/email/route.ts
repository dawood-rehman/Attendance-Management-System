import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import Attendance from '@/models/Attendance';
import Student from '@/models/Student';
import { generateEmailContent } from '@/lib/ai/analysis';
import { sendEmail, buildAttendanceEmailHTML } from '@/lib/email/nodemailer';
import { subDays, format } from 'date-fns';
import { z } from 'zod';

const GenerateSchema = z.object({
  studentIds: z.array(z.string()),
  mode: z.enum(['generate', 'send']).default('generate'),
  customSubject: z.string().optional(),
  customBody: z.string().optional(),
});

export const POST = requireAuth(async (req: NextRequest, user) => {
  try {
    if (!['teacher', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const { studentIds, mode, customSubject, customBody } = parsed.data;

    const students = await Student.find({ _id: { $in: studentIds } }).lean();
    const results = [];

    for (const student of students) {
      const endDate = new Date();
      const startDate = subDays(endDate, 29);

      const records = await Attendance.find({
        $or: [{ studentId: student._id }, { userId: student._id }],
        date: { $gte: startDate, $lte: endDate },
      }).lean();

      const total = records.length;
      const present = records.filter((r) => ['present', 'late'].includes(r.status)).length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      const absenceDates = records
        .filter((r) => r.status === 'absent')
        .map((r) => format(new Date(r.date), 'MMM dd'))
        .slice(-5);

      let emailContent = { subject: '', body: '' };

      if (mode === 'generate' || !customSubject) {
        emailContent = await generateEmailContent(
          student.name,
          student.email || '',
          percentage,
          absenceDates
        );
      } else {
        emailContent = { subject: customSubject || '', body: customBody || '' };
      }

      if (mode === 'send' && student.email) {
        await sendEmail({
          to: student.email,
          subject: customSubject || emailContent.subject,
          html: buildAttendanceEmailHTML(customBody || emailContent.body),
        });
      }

      results.push({
        studentId: student._id,
        studentName: student.name,
        email: student.email,
        attendancePercentage: percentage,
        emailContent,
        sent: mode === 'send' && !!student.email,
      });
    }

    return NextResponse.json({ results, mode });
  } catch (error) {
    console.error('AI email error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
