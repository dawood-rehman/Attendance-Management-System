import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'AttendanceIQ – Smart Attendance Management',
  description: 'AI-powered attendance management for schools',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e2032',
              color: '#f0f2f8',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '10px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#1e2032' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#1e2032' } },
          }}
        />
      </body>
    </html>
  );
}
