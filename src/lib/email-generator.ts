import Student from '@/models/Student';
import Teacher from '@/models/Teacher';
import User from '@/models/User';

function nameSlug(name: string) {
  const firstName = name.trim().split(/\s+/)[0] || 'user';
  return firstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
}

async function uniqueEmail(base: string, domain: string, start: number) {
  let sequence = Math.max(start, 1);

  for (;;) {
    const email = `${base}${sequence}@${domain}`;
    const existing = await User.exists({ email });
    if (!existing) return email;
    sequence += 1;
  }
}

export async function generateStudentEmail(name: string, classId: string) {
  const classStrength = await Student.countDocuments({ classId });
  return uniqueEmail(nameSlug(name), 'stu.com', classStrength + 1);
}

export async function generateTeacherEmail(name: string) {
  const teacherCount = await Teacher.countDocuments();
  return uniqueEmail(nameSlug(name), 'teacher.com', teacherCount + 1);
}
