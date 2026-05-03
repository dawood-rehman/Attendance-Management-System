import openai from './openai';

export interface AttendanceDataPoint {
  date: string;
  status: string;
}

export interface AttendanceInsights {
  summary: string;
  trend: string;
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high';
  percentage: number;
}

export async function analyzeAttendance(
  studentName: string,
  records: AttendanceDataPoint[]
): Promise<AttendanceInsights> {
  const total = records.length;
  const present = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  // Recent trend (last 14 days vs prior)
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-14);
  const recentPresent = recent.filter((r) => r.status === 'present' || r.status === 'late').length;
  const recentPct = recent.length > 0 ? Math.round((recentPresent / recent.length) * 100) : 0;

  const prompt = `
You are an attendance analysis AI for a school management system.

Student: ${studentName}
Total attendance records: ${total}
Overall attendance percentage: ${percentage}%
Recent 14-day attendance: ${recentPct}%
Records: ${JSON.stringify(sorted.slice(-30))}

Provide a JSON response with exactly these fields:
{
  "summary": "2-3 sentence summary of the student's attendance",
  "trend": "One sentence describing the recent trend",
  "recommendation": "One actionable recommendation for the teacher",
  "riskLevel": "low|medium|high based on attendance percentage"
}

Rules: low = >85%, medium = 70-85%, high = <70%
Be concise and professional. Return ONLY valid JSON.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || '{}';
    const cleaned = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      ...parsed,
      percentage,
      riskLevel: percentage >= 85 ? 'low' : percentage >= 70 ? 'medium' : 'high',
    };
  } catch {
    return {
      summary: `${studentName} has an overall attendance of ${percentage}%.`,
      trend: recentPct < percentage ? 'Attendance has been declining recently.' : 'Attendance has been stable or improving recently.',
      recommendation: percentage < 75 ? 'Immediate follow-up is recommended.' : 'Continue monitoring attendance.',
      riskLevel: percentage >= 85 ? 'low' : percentage >= 70 ? 'medium' : 'high',
      percentage,
    };
  }
}

export async function generateEmailContent(
  studentName: string,
  parentEmail: string,
  attendancePercentage: number,
  recentAbsences: string[]
): Promise<{ subject: string; body: string }> {
  const prompt = `
Generate a professional, empathetic email to parents/guardians about their child's attendance.

Student Name: ${studentName}
Attendance Percentage: ${attendancePercentage}%
Recent Absence Dates: ${recentAbsences.join(', ') || 'None listed'}
Type: ${attendancePercentage < 75 ? 'Low attendance warning' : 'Attendance update'}

Write a complete email with:
- Subject line
- Professional greeting
- Clear explanation of attendance status
- Specific dates of concern
- Request for communication
- Offer to discuss

Return JSON: { "subject": "...", "body": "..." }
Return ONLY valid JSON.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.5,
    });

    const content = response.choices[0].message.content || '{}';
    const cleaned = content.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      subject: `Attendance Notice – ${studentName}`,
      body: `Dear Parent/Guardian,\n\nWe are writing to inform you that ${studentName} currently has an attendance rate of ${attendancePercentage}%. Please contact us to discuss this matter.\n\nBest regards,\nSchool Administration`,
    };
  }
}

export async function processAICommand(command: string): Promise<{
  action: string;
  params: Record<string, unknown>;
  explanation: string;
}> {
  const today = new Date().toISOString().split('T')[0];

  const prompt = `
You are an AI assistant for a school attendance management system.
Today's date is: ${today}

User command: "${command}"

Interpret the command and return a JSON with:
{
  "action": "mark_attendance | view_report | send_email | none",
  "params": {
    "role": "teacher | student | all",
    "status": "present | absent | late | excused",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "targetGroup": "all | specific name"
  },
  "explanation": "Human-readable explanation of what will be done"
}

Only return valid JSON.
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.2,
    });

    const content = response.choices[0].message.content || '{}';
    const cleaned = content.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      action: 'none',
      params: {},
      explanation: 'Could not process the command. Please try again.',
    };
  }
}
