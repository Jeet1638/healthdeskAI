import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "HealthDesk AI - AI Front Desk for Modern Clinics",
  description:
    "HealthDesk AI handles patient questions, appointment scheduling, intake collection, and staff summaries for small clinics. Available 24/7.",
  keywords:
    "AI receptionist, clinic scheduling, medical front desk automation, appointment booking AI, patient intake",
  openGraph: {
    title: "HealthDesk AI - AI Front Desk for Modern Clinics",
    description:
      "HealthDesk AI handles patient questions, appointment scheduling, intake collection, and staff summaries for small clinics. Available 24/7.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HealthDesk AI - AI Front Desk for Modern Clinics",
    description:
      "HealthDesk AI handles patient questions, appointment scheduling, intake collection, and staff summaries for small clinics. Available 24/7.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('healthdesk-theme');
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = stored === 'dark' || (stored !== 'light' && systemDark);
                  if (isDark) document.documentElement.classList.add('dark');
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#F8FAFC] text-[#1E293B] dark:bg-slate-900 dark:text-slate-200">
        <Providers>
          <Navbar />
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
