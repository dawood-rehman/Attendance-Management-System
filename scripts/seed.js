#!/usr/bin/env node
/**
 * Creates or repairs the initial admin account.
 *
 * Run once:
 *   npm run seed
 */

const { loadEnvConfig } = require('@next/env');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@school.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Administrator';
const SAMPLE_STUDENT_PASSWORD = process.env.SAMPLE_STUDENT_PASSWORD || 'Student@123';

const INITIAL_DEPARTMENTS = [
  { name: 'ICS', code: 'ICS', className: 'ICS 1A', classCode: 'ICS-1A' },
  { name: 'FSC Pre-Medical', code: 'FSC-PM', className: 'FSC Pre-Medical 1A', classCode: 'PM-1A' },
  { name: 'FSC Pre-Engineering', code: 'FSC-PE', className: 'FSC Pre-Engineering 1A', classCode: 'PE-1A' },
  { name: 'ICOM', code: 'ICOM', className: 'ICOM 1A', classCode: 'ICOM-1A' },
  { name: 'FA', code: 'FA', className: 'FA 1A', classCode: 'FA-1A' },
  { name: 'FA-IT', code: 'FAIT', className: 'FA-IT 1A', classCode: 'FAIT-1A' },
];

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found. Add it to .env or .env.local before running the seed.');
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    googleId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String, trim: true },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    role: { type: String, enum: ['admin', 'teacher', 'student'], default: 'student' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const DepartmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

const AcademicClassSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    maxStudents: { type: Number, required: true, min: 1, default: 10 },
  },
  { timestamps: true }
);

AcademicClassSchema.index({ departmentId: 1, name: 1 }, { unique: true });
AcademicClassSchema.index({ departmentId: 1, code: 1 }, { unique: true, sparse: true });

const StudentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicClass', required: true },
    class: { type: String, trim: true },
    section: { type: String, trim: true },
  },
  { timestamps: true }
);

StudentSchema.index({ rollNumber: 1, classId: 1 }, { unique: true });
StudentSchema.index({ userId: 1 }, { unique: true });

const TeacherSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true },
    employeeId: { type: String, trim: true, unique: true, sparse: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    assignedClassIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AcademicClass' }],
  },
  { timestamps: true }
);

const AdminSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true, default: 'System Administrator' },
  },
  { timestamps: true }
);

async function upsertAdminProfile(Admin, user) {
  await Admin.findOneAndUpdate(
    { userId: user._id },
    {
      userId: user._id,
      name: user.name,
      email: user.email,
      designation: 'System Administrator',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
}

async function seedAcademicData({ User, Department, AcademicClass, Student }) {
  const studentPasswordHash = await bcrypt.hash(SAMPLE_STUDENT_PASSWORD, 12);
  let createdStudents = 0;

  for (const item of INITIAL_DEPARTMENTS) {
    const department = await Department.findOneAndUpdate(
      { name: item.name },
      {
        name: item.name,
        code: item.code,
        description: `${item.name} department`,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const academicClass = await AcademicClass.findOneAndUpdate(
      { departmentId: department._id, name: item.className },
      {
        name: item.className,
        code: item.classCode,
        departmentId: department._id,
        maxStudents: 10,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const prefix = slug(item.name);
    for (let i = 1; i <= 10; i++) {
      const padded = String(i).padStart(3, '0');
      const email = `${prefix}.student${i}@school.com`;
      const rollNumber = `${item.code}-${padded}`;
      const name = `${item.name} Student ${i}`;

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name,
          email,
          password: studentPasswordHash,
          role: 'student',
          status: 'approved',
          mustChangePassword: true,
        });
        createdStudents += 1;
      } else {
        user.name = name;
        user.role = 'student';
        user.status = 'approved';
        await user.save();
      }

      await Student.findOneAndUpdate(
        { userId: user._id },
        {
          name,
          rollNumber,
          email,
          userId: user._id,
          departmentId: department._id,
          classId: academicClass._id,
          class: academicClass.name,
          section: 'A',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  console.log(`Academic seed ready: ${INITIAL_DEPARTMENTS.length} departments, ${INITIAL_DEPARTMENTS.length} classes, ${INITIAL_DEPARTMENTS.length * 10} students (${createdStudents} new users)`);
}

async function repairTeacherProfiles({ User, Teacher }) {
  const users = await User.find({ role: 'teacher' }).lean();
  for (const user of users) {
    await Teacher.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          userId: user._id,
          name: user.name,
          email: user.email,
        },
        $setOnInsert: { assignedClassIds: [] },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = mongoose.models.User || mongoose.model('User', UserSchema);
  const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
  const Department = mongoose.models.Department || mongoose.model('Department', DepartmentSchema);
  const AcademicClass =
    mongoose.models.AcademicClass || mongoose.model('AcademicClass', AcademicClassSchema);
  const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);
  const Teacher = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);
  const existing = await User.findOne({ email: ADMIN_EMAIL }).select('+password');

  if (existing) {
    const passwordMatches = await bcrypt.compare(ADMIN_PASSWORD, existing.password);

    existing.name = ADMIN_NAME;
    existing.role = 'admin';
    existing.status = 'approved';
    existing.mustChangePassword = false;

    if (!passwordMatches) {
      existing.password = await bcrypt.hash(ADMIN_PASSWORD, 12);
    }

    await existing.save();
    await upsertAdminProfile(Admin, existing);
    await repairTeacherProfiles({ User, Teacher });
    await seedAcademicData({ User, Department, AcademicClass, Student });
    console.log(`Admin account repaired: ${ADMIN_EMAIL}`);
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const adminUser = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: hashedPassword,
    role: 'admin',
    status: 'approved',
    mustChangePassword: false,
  });
  await upsertAdminProfile(Admin, adminUser);
  await repairTeacherProfiles({ User, Teacher });
  await seedAcademicData({ User, Department, AcademicClass, Student });

  console.log(`Admin account created: ${ADMIN_EMAIL}`);
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seed error:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
