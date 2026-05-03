import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IAdmin extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new Schema<IAdmin>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true, default: 'System Administrator' },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV === 'development' && mongoose.models.Admin) {
  delete mongoose.models.Admin;
}

const Admin: Model<IAdmin> =
  mongoose.models.Admin || mongoose.model<IAdmin>('Admin', AdminSchema);

export default Admin;
