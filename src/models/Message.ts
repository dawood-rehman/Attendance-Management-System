import mongoose, { Document, Model, Schema } from 'mongoose';

export type MessageRecipientType = 'admin' | 'teacher' | 'student';
export type MessageChannel = 'message' | 'email';
export type MessageDeliveryStatus = 'sent' | 'email_failed';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  parentMessageId?: mongoose.Types.ObjectId;
  senderUserId: mongoose.Types.ObjectId;
  senderName: string;
  senderEmail: string;
  senderRole: string;
  recipientType: MessageRecipientType;
  recipientUserId: mongoose.Types.ObjectId;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  channel: MessageChannel;
  deliveryStatus: MessageDeliveryStatus;
  emailError?: string;
  studentName?: string;
  studentEmail?: string;
  studentDepartment?: string;
  studentClass?: string;
  studentRollNumber?: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    parentMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true, trim: true },
    senderEmail: { type: String, required: true, trim: true, lowercase: true },
    senderRole: { type: String, required: true, trim: true },
    recipientType: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientName: { type: String, required: true, trim: true },
    recipientEmail: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    channel: { type: String, enum: ['message', 'email'], default: 'message' },
    deliveryStatus: { type: String, enum: ['sent', 'email_failed'], default: 'sent' },
    emailError: { type: String, trim: true },
    studentName: { type: String, trim: true },
    studentEmail: { type: String, trim: true, lowercase: true },
    studentDepartment: { type: String, trim: true },
    studentClass: { type: String, trim: true },
    studentRollNumber: { type: String, trim: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

MessageSchema.index({ recipientUserId: 1, createdAt: -1 });
MessageSchema.index({ senderUserId: 1, createdAt: -1 });
MessageSchema.index({ parentMessageId: 1, createdAt: 1 });

if (process.env.NODE_ENV === 'development' && mongoose.models.Message) {
  delete mongoose.models.Message;
}

const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
