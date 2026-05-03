import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error('Email service is not configured');
  }

  await transporter.sendMail({
    from: `"${process.env.NEXT_PUBLIC_APP_NAME || 'AttendanceIQ'}" <${process.env.GMAIL_USER}>`,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

export async function sendPasswordResetPin(to: string, pin: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Your AttendanceIQ password reset PIN',
    text: `Your password reset PIN is ${pin}. It expires in 10 minutes.`,
    html: buildAttendanceEmailHTML(`
      <p>Use this PIN to reset your AttendanceIQ password:</p>
      <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:20px 0;">${pin}</p>
      <p>This PIN expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    `),
  });
}

export function buildAttendanceEmailHTML(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f7fa; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #163caf, #2d6be4); padding: 32px 40px; color: white; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .header p { margin: 4px 0 0; opacity: .8; font-size: 13px; }
    .body { padding: 32px 40px; color: #1e2032; line-height: 1.6; }
    .footer { background: #f0f2f8; padding: 20px 40px; font-size: 12px; color: #888; border-top: 1px solid #e2e6f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AttendanceIQ</h1>
      <p>School Attendance Management</p>
    </div>
    <div class="body">
      ${body.replace(/\n/g, '<br/>')}
    </div>
    <div class="footer">
      This is an automated message from AttendanceIQ. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
  `.trim();
}
