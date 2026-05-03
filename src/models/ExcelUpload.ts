import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IExcelUpload extends Document {
  _id: mongoose.Types.ObjectId;
  fileName: string;
  uploaderId: mongoose.Types.ObjectId;
  recordCount: number;
  status: 'processing' | 'completed' | 'failed';
  errorMessages?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ExcelUploadSchema = new Schema<IExcelUpload>(
  {
    fileName: { type: String, required: true },
    uploaderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordCount: { type: Number, default: 0 },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    errorMessages: [{ type: String }],
  },
  { timestamps: true }
);

if (process.env.NODE_ENV === 'development' && mongoose.models.ExcelUpload) {
  delete mongoose.models.ExcelUpload;
}

const ExcelUpload: Model<IExcelUpload> =
  mongoose.models.ExcelUpload || mongoose.model<IExcelUpload>('ExcelUpload', ExcelUploadSchema);

export default ExcelUpload;
