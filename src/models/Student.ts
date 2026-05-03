import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IStudent extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  rollNumber: string;
  email: string;
  phone?: string;
  userId: mongoose.Types.ObjectId;
  teacherId?: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  class?: string;
  section?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher' },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'AcademicClass', required: true },
    class: { type: String, trim: true },
    section: { type: String, trim: true },
  },
  { timestamps: true }
);

StudentSchema.index({ rollNumber: 1, classId: 1 }, { unique: true });
StudentSchema.index({ userId: 1 }, { unique: true });

if (process.env.NODE_ENV === 'development' && mongoose.models.Student) {
  delete mongoose.models.Student;
}

const Student: Model<IStudent> =
  mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);

export default Student;
