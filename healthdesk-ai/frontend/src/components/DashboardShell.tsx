"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardList,
  MessageSquareText,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useSession } from "next-auth/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/EmptyState";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const chartData = [
  { day: "Mon", conversations: 28, appointments: 12 },
  { day: "Tue", conversations: 36, appointments: 16 },
  { day: "Wed", conversations: 42, appointments: 19 },
  { day: "Thu", conversations: 31, appointments: 14 },
  { day: "Fri", conversations: 47, appointments: 21 },
  { day: "Sat", conversations: 18, appointments: 8 },
];

const conversations = [
  { patient: "Olivia Martinez", topic: "Annual checkup", urgency: "low" },
  { patient: "Marcus Lee", topic: "Medication side effect", urgency: "high" },
  { patient: "Ava Thompson", topic: "New patient intake", urgency: "medium" },
];

export function DashboardShell({ page }: { page: "dashboard" | "conversations" | "appointments" | "patients" | "intake" | "settings" }) {
  const { data: session } = useSession();

  return (
    <ProtectedLayout>
      <main className="hd-page">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#0F766E]">
            {session?.user?.role ?? "Clinic"} workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">
            {pageTitle(page)}
          </h1>
          <p className="mt-2 text-[#64748B]">
            {pageDescription(page)}
          </p>
        </div>

        {page === "dashboard" ? <DashboardOverview /> : <FocusedPage page={page} />}
      </main>
    </ProtectedLayout>
  );
}

function DashboardOverview() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-3">
        <MetricCard icon={MessageSquareText} label="Open conversations" value="15" color="#0F766E" bg="#CCFBF1" />
        <MetricCard icon={CalendarDays} label="Appointments today" value="8" color="#2563EB" bg="#DBEAFE" />
        <MetricCard icon={ShieldAlert} label="Escalations" value="1" color="#EF4444" bg="#FEE2E2" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.65fr_0.35fr]">
        <Card className="rounded-2xl border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-[#0F172A]">Weekly activity</h2>
            <p className="mb-6 text-sm text-[#64748B]">Conversations and booked appointments.</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#F8FAFC" }}
                    contentStyle={{
                      background: "#0F172A",
                      border: "none",
                      borderRadius: 12,
                      color: "#FFFFFF",
                    }}
                  />
                  <Bar dataKey="conversations" fill="#0F766E" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="appointments" fill="#2563EB" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-[#0F172A]">Needs attention</h2>
            <div className="mt-5 grid gap-3">
              {conversations.map((item) => (
                <div key={item.patient} className="rounded-2xl border border-[#E2E8F0] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{item.patient}</p>
                      <p className="text-sm text-[#64748B]">{item.topic}</p>
                    </div>
                    <UrgencyBadge urgency={item.urgency} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FocusedPage({ page }: { page: Exclude<Parameters<typeof pageTitle>[0], "dashboard"> }) {
  const config = {
    conversations: {
      icon: MessageSquareText,
      title: "Conversation queue",
      message: "Use this workspace to scan urgency, review summaries, and pick up the next patient thread.",
    },
    appointments: {
      icon: CalendarDays,
      title: "Appointments workspace",
      message: "Track booked visits, service needs, provider context, and rescheduling requests from one view.",
    },
    patients: {
      icon: Users,
      title: "Patient directory",
      message: "Review patient context, contact details, appointment history, and intake status.",
    },
    intake: {
      icon: ClipboardList,
      title: "Intake review",
      message: "Check reason for visit, symptoms, insurance details, and missing fields before staff follow-up.",
    },
    settings: {
      icon: ShieldAlert,
      title: "Clinic settings",
      message: "Keep clinic profile details, operating hours, and staff workflow preferences aligned.",
    },
  }[page];

  return <EmptyState icon={config.icon} title={config.title} message={config.message} />;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <Card className="rounded-2xl border-[#E2E8F0] border-l-4 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ borderLeftColor: color }}>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <div className="text-4xl font-bold text-[#0F172A]">{value}</div>
          <div className="mt-1 text-sm font-medium text-[#64748B]">{label}</div>
        </div>
        <div className="rounded-full p-3" style={{ background: bg, color }}>
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const classes =
    urgency === "high"
      ? "bg-[#FEE2E2] text-[#991B1B]"
      : urgency === "medium"
        ? "bg-[#FEF3C7] text-[#92400E]"
        : "bg-[#D1FAE5] text-[#065F46]";

  return <Badge className={`rounded-full px-3 py-1 uppercase tracking-[0.08em] ${classes}`}>{urgency}</Badge>;
}

function pageTitle(page: "dashboard" | "conversations" | "appointments" | "patients" | "intake" | "settings") {
  const titles = {
    dashboard: "Dashboard",
    conversations: "Conversations",
    appointments: "Appointments",
    patients: "Patients",
    intake: "Intake",
    settings: "Settings",
  };
  return titles[page];
}

function pageDescription(page: "dashboard" | "conversations" | "appointments" | "patients" | "intake" | "settings") {
  const descriptions = {
    dashboard: "Monitor patient demand, booked visits, and escalation risk at a glance.",
    conversations: "Review patient messages with urgency labels and staff-ready summaries.",
    appointments: "Coordinate upcoming visits and booking requests.",
    patients: "Keep patient context close to every front-desk workflow.",
    intake: "Review structured intake details collected by the assistant.",
    settings: "Manage clinic profile, staff access, and operational preferences.",
  };
  return descriptions[page];
}
