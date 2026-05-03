import Admin from '@/models/Admin';
import Teacher from '@/models/Teacher';
import User from '@/models/User';

export async function ensureAdminProfile(userId: string) {
  let admin = await Admin.findOne({ userId });
  if (admin) return admin;

  const user = await User.findById(userId).lean();
  if (!user || user.role !== 'admin') return null;

  admin = await Admin.create({
    userId: user._id,
    name: user.name,
    email: user.email,
  });

  return admin;
}

export async function ensureTeacherProfile(userId: string) {
  let teacher = await Teacher.findOne({ userId });
  if (teacher) return teacher;

  const user = await User.findById(userId).lean();
  if (!user || user.role !== 'teacher') return null;

  teacher = await Teacher.create({
    userId: user._id,
    name: user.name,
    email: user.email,
    assignedClassIds: [],
  });

  return teacher;
}
