import mongoose, { Document, Model, Schema } from 'mongoose';

export type LectureStatus = 'scheduled' | 'completed' | 'cancelled';
export type LectureDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface ILecture extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  subject: string;
  departmentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  dayOfWeek?: LectureDay;
  lectureDate?: Date;
  startTime: string;
  endTime: string;
  room?: string;
  notes?: string;
  status: LectureStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dayValues: LectureDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const LectureSchema = new Schema<ILecture>(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'AcademicClass', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
    dayOfWeek: { type: String, enum: dayValues },
    lectureDate: { type: Date },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    room: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

LectureSchema.index({ classId: 1, dayOfWeek: 1, startTime: 1 });
LectureSchema.index({ teacherId: 1, dayOfWeek: 1, startTime: 1 });
LectureSchema.index({ lectureDate: 1 });

if (process.env.NODE_ENV === 'development' && mongoose.models.Lecture) {
  delete mongoose.models.Lecture;
}

const Lecture: Model<ILecture> =
  mongoose.models.Lecture || mongoose.model<ILecture>('Lecture', LectureSchema);

export default Lecture;
