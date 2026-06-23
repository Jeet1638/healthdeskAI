"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  MessageSquare,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/components/ChartCard";
import { MetricCard } from "@/components/MetricCard";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/hooks/useAnalytics";
import { getMyClinic, getProviders } from "@/lib/api";

const statusColors = {
  scheduled: "#0F766E",
  rescheduled: "#F59E0B",
  cancelled: "#EF4444",
  completed: "#10B981",
  no_show: "#94A3B8",
};

const tooltipStyle = {
  background: "#0F172A",
  border: "none",
  borderRadius: 12,
  color: "#FFFFFF",
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data, loading, error, refetch } = useAnalytics();
  const [clinicName, setClinicName] = useState("Clinic workspace");
  const [showSetupBanner, setShowSetupBanner] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!session?.access_token) {
      return;
    }
    getMyClinic(session.access_token)
      .then((clinic) => {
        if (mounted) {
          setClinicName(clinic.name);
        }
      })
      .catch(() => {
        if (mounted) {
          setClinicName("Clinic workspace");
        }
      });
    return () => {
      mounted = false;
    };
  }, [session?.access_token]);

  useEffect(() => {
    let mounted = true;
    if (!session?.access_token || typeof window === "undefined") {
      return;
    }
    if (window.localStorage.getItem("setup_banner_dismissed") === "true") {
      return;
    }
    getProviders()
      .then((providers) => {
        if (mounted) {
          setShowSetupBanner(providers.length === 0);
        }
      })
      .catch(() => {
        if (mounted) {
          setShowSetupBanner(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [session?.access_token]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return "Good morning";
    }
    if (hour < 17) {
      return "Good afternoon";
    }
    return "Good evening";
  }, []);

  const formattedToday = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const hasNoData = useMemo(() => {
    const overview = data.overview;
    return [
      overview.total_conversations,
      overview.booked_appointments,
      overview.rescheduled_appointments,
      overview.cancelled_appointments,
      overview.open_escalations,
      overview.pending_intake_forms,
      overview.booking_conversion_rate,
    ].every((value) => Number(value) === 0);
  }, [data.overview]);

  return (
    <ProtectedLayout>
      <main className="hd-page">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#0F766E]">Clinic workspace</p>
          <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">Dashboard</h1>
          <p className="mt-2 text-[#64748B]">Monitor patient demand, booked visits, and escalation risk at a glance.</p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-8 flex flex-col gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A]">
              {greeting}, {session?.user?.name ?? "there"}
            </h2>
            <p className="mt-2 text-[#64748B]">{clinicName} - Staff Dashboard</p>
          </div>
          <p className="text-sm font-semibold text-[#64748B]">{formattedToday}</p>
        </motion.section>

        {showSetupBanner ? (
          <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#0F766E] bg-[#F0FDFA] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium text-[#134E4A]">
              Welcome to HealthDesk AI! Complete your clinic setup to get started.
            </p>
            <div className="flex items-center gap-3">
              <Button asChild className="rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]">
                <Link href="/settings">Set Up Clinic</Link>
              </Button>
              <button
                type="button"
                className="rounded-lg p-2 text-[#134E4A] transition-colors hover:bg-white"
                aria-label="Dismiss setup banner"
                onClick={() => {
                  window.localStorage.setItem("setup_banner_dismissed", "true");
                  setShowSetupBanner(false);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#FEE2E2] bg-[#FEE2E2] p-4 text-[#991B1B]">
            <span>{error}</span>
            <Button type="button" variant="outline" onClick={() => void refetch()}>Retry</Button>
          </div>
        ) : null}

        <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard title="Total Conversations" value={data.overview.total_conversations} icon={MessageSquare} accentColor="#0F766E" tintColor="#CCFBF1" loading={loading} />
          <MetricCard title="Booked Appointments" value={data.overview.booked_appointments} icon={Calendar} accentColor="#2563EB" tintColor="#DBEAFE" loading={loading} />
          <MetricCard title="Active Escalations" value={data.overview.open_escalations} icon={AlertTriangle} accentColor="#EF4444" tintColor="#FEE2E2" loading={loading} />
          <MetricCard title="Pending Intake Forms" value={data.overview.pending_intake_forms} icon={ClipboardList} accentColor="#7C3AED" tintColor="#EDE9FE" loading={loading} />
          <MetricCard title="Rescheduled" value={data.overview.rescheduled_appointments} icon={RefreshCw} accentColor="#F59E0B" tintColor="#FEF3C7" loading={loading} />
          <MetricCard title="Cancelled" value={data.overview.cancelled_appointments} icon={XCircle} accentColor="#64748B" tintColor="#F1F5F9" loading={loading} />
        </section>

        {!loading && hasNoData ? (
          <section className="mt-6 flex min-h-[360px] items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="max-w-md">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F0FDFA] text-[#0F766E]">
                <ClipboardList className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-[#0F172A]">Your dashboard is ready</h2>
              <p className="mt-3 leading-7 text-[#64748B]">
                Data will appear here as patients start using the assistant and
                appointments are booked.
              </p>
              <Button asChild className="mt-6 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]">
                <Link href="/settings">Configure Your Clinic</Link>
              </Button>
            </div>
          </section>
        ) : (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Inquiries per day" loading={loading}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.inquiriesByDay}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 12 }} tickFormatter={(value: string) => value.slice(5)} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="#0F766E" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Appointment status breakdown" loading={loading}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.appointmentStatus}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="status" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {data.appointmentStatus.map((item) => (
                    <Cell key={item.status} fill={statusColors[item.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Peak inquiry hours" loading={loading}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.peakHours}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#2563EB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Most common question categories" loading={loading}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.commonQuestions}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="category" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#7C3AED" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>
        )}
      </main>
    </ProtectedLayout>
  );
}
