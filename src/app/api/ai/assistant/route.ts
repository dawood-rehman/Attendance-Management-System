import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import { processAICommand } from '@/lib/ai/analysis';
import { parseISO, eachDayOfInterval, startOfDay } from 'date-fns';
import { z } from 'zod';

const CommandSchema = z.object({
  command: z.string().min(3),
});

export const POST = requireRole(['admin'], async (req: NextRequest, user) => {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = CommandSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please provide a command' }, { status: 400 });
    }

    const interpretation = await processAICommand(parsed.data.command);

    if (interpretation.action === 'mark_attendance') {
      const params = interpretation.params as {
        role?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
      };

      if (params.role && params.status && params.startDate && params.endDate) {
        const role: 'teacher' | 'student' = params.role === 'teacher' ? 'teacher' : 'student';
        const status = params.status as 'present' | 'absent' | 'late' | 'excused';
        const users = await User.find({ role, status: 'approved' }).lean();

        const startDate = parseISO(params.startDate);
        const endDate = parseISO(params.endDate);
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const markedBy = new mongoose.Types.ObjectId(user.userId);

        const ops = [];
        for (const u of users) {
          for (const day of days) {
            ops.push({
              updateOne: {
                filter: {
                  userId: u._id,
                  date: { $gte: startOfDay(day), $lt: new Date(startOfDay(day).getTime() + 86400000) },
                  role,
                },
                update: {
                  $setOnInsert: {
                    userId: u._id,
                    role,
                    date: startOfDay(day),
                    status,
                    markedBy,
                  },
                },
                upsert: true,
              },
            });
          }
        }

        if (ops.length) {
          const result = await Attendance.bulkWrite(ops);
          return NextResponse.json({
            interpretation,
            executed: true,
            message: `Marked ${status} for ${users.length} ${role}s over ${days.length} day(s).`,
            upserted: result.upsertedCount,
          });
        }
      }
    }

    return NextResponse.json({
      interpretation,
      executed: false,
      message: interpretation.explanation,
    });
  } catch (error) {
    console.error('AI assistant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
