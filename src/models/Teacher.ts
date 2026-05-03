import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITeacher extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  employeeId?: string;
  education?: string;
  degree?: string;
  departmentId?: mongoose.Types.ObjectId;
  assignedClassIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const TeacherSchema = new Schema<ITeacher>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true },
    employeeId: { type: String, trim: true, unique: true, sparse: true },
    education: { type: String, trim: true },
    degree: { type: String, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    assignedClassIds: [{ type: Schema.Types.ObjectId, ref: 'AcademicClass' }],
  },
  { timestamps: true }
);

TeacherSchema.index({ departmentId: 1 });
TeacherSchema.index({ assignedClassIds: 1 });

if (process.env.NODE_ENV === 'development' && mongoose.models.Teacher) {
  delete mongoose.models.Teacher;
}

const Teacher: Model<ITeacher> =
  mongoose.models.Teacher || mongoose.model<ITeacher>('Teacher', TeacherSchema);

export default Teacher;
