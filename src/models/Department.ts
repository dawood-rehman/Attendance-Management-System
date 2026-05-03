import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDepartment extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV === 'development' && mongoose.models.Department) {
  delete mongoose.models.Department;
}

const Department: Model<IDepartment> =
  mongoose.models.Department || mongoose.model<IDepartment>('Department', DepartmentSchema);

export default Department;
