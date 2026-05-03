import mongoose, { Document, Model, Schema } from 'mongoose';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type AttendeeRole = 'student' | 'teacher';

export interface IAttendance extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;     // teacher or student userId (User collection)
  studentId?: mongoose.Types.ObjectId; // only for student attendance (Student collection)
  role: AttendeeRole;
  date: Date;
  status: AttendanceStatus;
  markedBy: mongoose.Types.ObjectId;   // who marked the attendance
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    role: { type: String, enum: ['student', 'teacher'], required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

// One attendance record per user per day
AttendanceSchema.index({ userId: 1, date: 1, role: 1 }, { unique: true });

if (process.env.NODE_ENV === 'development' && mongoose.models.Attendance) {
  delete mongoose.models.Attendance;
}

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);

export default Attendance;
