# AttendanceIQ — AI-Powered Attendance Management

> A full-stack Next.js + MongoDB attendance management system with integrated AI features for schools.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-green?logo=mongodb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai)

---

## ✨ Features

### 👥 Role-Based Access
| Role    | Capabilities |
|---------|-------------|
| **Admin**   | Approve/reject users, mark teacher attendance, system-wide reports, AI assistant |
| **Teacher** | Manage students (CRUD + Excel upload), mark student attendance, AI charts & email |
| **Student** | View personal attendance, profile settings |

### 🤖 AI Features
1. **AI Chart Generator** — Analyzes 90 days of attendance, generates Bar/Line charts, and produces AI-written insights (summary, trend, risk level, recommendation)
2. **AI Email Sender** — Selects students, generates contextual attendance warning emails via GPT, allows manual editing before sending via Gmail SMTP
3. **AI Attendance Assistant** — Admins type natural-language commands ("Mark all teachers present for this week"), the AI interprets and executes DB operations

### 📊 Excel Integration
- Upload `.xlsx` / `.xls` to bulk-import students
- Downloadable CSV template
- Export any attendance report to Excel

### 🔒 Security
- Passwords hashed with **bcrypt** (12 rounds)
- **JWT** authentication via HTTP-only cookies + Bearer header
- Route protection via Next.js **middleware**
- Input validation via **Zod**
- Role & status checks on every API route

---

## 🗂 Project Structure

```
attendance-app/
├── scripts/
│   └── seed.js                    # Creates initial admin account
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── api/
│   │   │   ├── auth/              # login, register, logout, me
│   │   │   ├── admin/             # users CRUD, stats
│   │   │   ├── teacher/           # students CRUD, Excel upload
│   │   │   ├── attendance/        # mark, list, export
│   │   │   ├── ai/                # chart, email, assistant
│   │   │   └── settings/          # profile update
│   │   ├── dashboard/
│   │   │   ├── admin/             # dashboard, users, attendance, reports, ai-assistant
│   │   │   ├── teacher/           # dashboard, students, attendance, reports, ai-chart, ai-email
│   │   │   └── student/           # dashboard, attendance, profile
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx
│   │   └── ui/
│   │       └── index.tsx          # Button, Input, Select, Badge, Card, Modal, etc.
│   ├── hooks/
│   │   └── useAuth.tsx            # AuthContext + useAuth hook
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── openai.ts          # OpenAI client
│   │   │   └── analysis.ts        # analyzeAttendance, generateEmailContent, processAICommand
│   │   ├── auth/
│   │   │   ├── jwt.ts             # signToken, verifyToken
│   │   │   └── middleware.ts      # requireAuth, requireRole
│   │   ├── db/
│   │   │   └── mongoose.ts        # connection with caching
│   │   └── email/
│   │       └── nodemailer.ts      # sendEmail, buildAttendanceEmailHTML
│   ├── middleware.ts              # Next.js edge middleware (route protection)
│   ├── models/
│   │   ├── User.ts
│   │   ├── Student.ts
│   │   ├── Attendance.ts
│   │   └── ExcelUpload.ts
│   └── utils/
│       └── api.ts                 # apiCall() helper
├── .env.example
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+
- **MongoDB** (Atlas free tier works perfectly)
- **OpenAI** API key (GPT-4o-mini)
- **Gmail** account with App Password enabled

---

### 1. Clone & Install

```bash
git clone https://github.com/your-org/attendance-app.git
cd attendance-app
npm install
```

---

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/attendance_db

# JWT — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_64_char_random_secret
JWT_EXPIRES_IN=7d

# NextAuth (if using NextAuth later)
NEXTAUTH_SECRET=another_random_secret
NEXTAUTH_URL=http://localhost:3000

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Gmail SMTP
# Enable 2FA on your Gmail account, then create an App Password:
# Google Account → Security → 2-Step Verification → App passwords
GMAIL_USER=yourname@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Admin account (created by seed script)
ADMIN_EMAIL=admin@school.com
ADMIN_PASSWORD=Admin@123456
ADMIN_NAME=System Administrator

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=AttendanceIQ
```

---

### 3. Seed Admin Account

```bash
npm run seed
```

Output:
```
✅  Connected to MongoDB
🎉  Admin created!
    Email:    admin@school.com
    Password: Admin@123456
```

---

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

### 5. Production Build

```bash
npm run build
npm start
```

---

## 📋 Database Schema

### Users Collection
```typescript
{
  name: string,
  email: string (unique),
  password: string (bcrypt hashed),
  role: 'admin' | 'teacher' | 'student',
  status: 'pending' | 'approved' | 'rejected',
  createdAt: Date,
  updatedAt: Date
}
```

### Students Collection
```typescript
{
  name: string,
  rollNumber: string,
  email?: string,
  phone?: string,
  teacherId: ObjectId → User,
  class?: string,
  section?: string,
  // Unique index: { rollNumber, teacherId }
}
```

### Attendance Collection
```typescript
{
  userId: ObjectId → User,
  studentId?: ObjectId → Student,
  role: 'student' | 'teacher',
  date: Date,
  status: 'present' | 'absent' | 'late' | 'excused',
  markedBy: ObjectId → User,
  note?: string,
  // Unique index: { userId, date, role }
}
```

### ExcelUploads Collection
```typescript
{
  fileName: string,
  uploaderId: ObjectId → User,
  recordCount: number,
  status: 'processing' | 'completed' | 'failed',
  errors: string[]
}
```

---

## 📤 Excel Upload Format

Download the template from the Teacher → Students page, or create a spreadsheet with these columns:

| Name       | Roll Number | Email              | Phone       | Class | Section |
|------------|-------------|-------------------|-------------|-------|---------|
| John Doe   | 001         | john@example.com  | 1234567890  | 10    | A       |
| Jane Smith | 002         | jane@example.com  |             | 10    | B       |

- `Name` and `Roll Number` are **required**
- All other columns are optional
- Duplicate roll numbers per teacher are skipped (not duplicated)

---

## 🤖 AI Features Guide

### AI Chart Generator (Teacher)
1. Go to **Teacher → AI Chart**
2. Select any student from the dropdown
3. Choose Bar or Line chart type
4. Click **Analyze**
5. View weekly attendance chart + AI-written insights with risk level

### AI Email Sender (Teacher)
1. Go to **Teacher → AI Email**
2. Select one or more students (checkboxes)
3. Click **Generate AI Emails**
4. Review and edit the AI-generated subject/body per student
5. Click **Send** per student or **Send All**

> ⚠️ Students must have an email address on file to receive emails.

### AI Attendance Assistant (Admin)
1. Go to **Admin → AI Assistant**
2. Type a natural-language command, e.g.:
   - `"Mark all teachers present for today"`
   - `"Set all teachers absent for last Monday"`
   - `"Mark attendance present for all teachers this week"`
3. Click **Execute Command**
4. Review the AI interpretation before confirming

---

## 🔑 Default Credentials

After running `npm run seed`:

| Role  | Email               | Password      |
|-------|---------------------|---------------|
| Admin | admin@school.com    | Admin@123456  |

Teachers and students register themselves at `/register`. The admin then approves them at **Admin → User Management**.

---

## 🛠 API Reference

### Auth
| Method | Endpoint              | Description         | Auth |
|--------|-----------------------|---------------------|------|
| POST   | /api/auth/register    | Register new user   | —    |
| POST   | /api/auth/login       | Login               | —    |
| POST   | /api/auth/logout      | Logout              | —    |
| GET    | /api/auth/me          | Get current user    | ✅   |

### Admin
| Method | Endpoint                  | Description            | Role  |
|--------|---------------------------|------------------------|-------|
| GET    | /api/admin/users          | List users             | Admin |
| PATCH  | /api/admin/users/[id]     | Update user status     | Admin |
| DELETE | /api/admin/users/[id]     | Delete user            | Admin |
| GET    | /api/admin/stats          | Dashboard stats        | Admin |

### Teacher
| Method | Endpoint                         | Description         | Role         |
|--------|----------------------------------|---------------------|--------------|
| GET    | /api/teacher/students            | List students       | Teacher/Admin|
| POST   | /api/teacher/students            | Add student         | Teacher/Admin|
| PATCH  | /api/teacher/students/[id]       | Update student      | Teacher/Admin|
| DELETE | /api/teacher/students/[id]       | Delete student      | Teacher/Admin|
| POST   | /api/teacher/students/upload     | Upload Excel        | Teacher/Admin|

### Attendance
| Method | Endpoint                  | Description              | Role         |
|--------|---------------------------|--------------------------|--------------|
| GET    | /api/attendance           | List attendance records  | All (filtered)|
| POST   | /api/attendance           | Bulk mark attendance     | Admin/Teacher|
| GET    | /api/attendance/export    | Export to Excel          | All          |

### AI
| Method | Endpoint              | Description                 | Role         |
|--------|-----------------------|-----------------------------|--------------|
| POST   | /api/ai/chart         | Analyze + generate chart    | Teacher/Admin|
| POST   | /api/ai/email         | Generate + send AI email    | Teacher/Admin|
| POST   | /api/ai/assistant     | Process NL command          | Admin        |

### Settings
| Method | Endpoint        | Description    | Role |
|--------|-----------------|----------------|------|
| PATCH  | /api/settings   | Update profile | All  |

---

## 🚀 Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or:
vercel env add MONGODB_URI
vercel env add JWT_SECRET
vercel env add OPENAI_API_KEY
vercel env add GMAIL_USER
vercel env add GMAIL_APP_PASSWORD
```

---

## 🧩 Tech Stack Summary

| Layer       | Technology          |
|-------------|---------------------|
| Framework   | Next.js 14 (App Router) |
| Language    | TypeScript 5        |
| Database    | MongoDB + Mongoose  |
| Auth        | JWT + HTTP-only cookies |
| Styling     | Tailwind CSS 3      |
| AI          | OpenAI GPT-4o-mini  |
| Charts      | Recharts            |
| Email       | Nodemailer (Gmail)  |
| Excel       | xlsx (SheetJS)      |
| Validation  | Zod                 |
| Security    | bcryptjs            |
| Toasts      | react-hot-toast     |
| Icons       | lucide-react        |

---

## 📝 License

MIT © AttendanceIQ
