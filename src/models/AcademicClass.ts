import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IAcademicClass extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code?: string;
  departmentId: mongoose.Types.ObjectId;
  maxStudents: number;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicClassSchema = new Schema<IAcademicClass>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    maxStudents: { type: Number, required: true, min: 1, default: 10 },
  },
  { timestamps: true }
);

AcademicClassSchema.index({ departmentId: 1, name: 1 }, { unique: true });
AcademicClassSchema.index({ departmentId: 1, code: 1 }, { unique: true, sparse: true });

if (process.env.NODE_ENV === 'development' && mongoose.models.AcademicClass) {
  delete mongoose.models.AcademicClass;
}

const AcademicClass: Model<IAcademicClass> =
  mongoose.models.AcademicClass ||
  mongoose.model<IAcademicClass>('AcademicClass', AcademicClassSchema);

export default AcademicClass;
