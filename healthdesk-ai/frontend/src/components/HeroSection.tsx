"use client";

import { motion } from "framer-motion";
import { CalendarCheck, MessageCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#F8FAFC]">
      <div className="pointer-events-none absolute left-1/2 top-16 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#CCFBF1] opacity-55 blur-3xl" />
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1280px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex rounded-full border border-[#99F6E4] bg-white px-4 py-2 text-sm font-semibold text-[#134E4A] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            Safer intake, faster scheduling, calmer staff days
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-7 max-w-4xl text-5xl font-bold tracking-normal text-[#0F172A] sm:text-6xl"
          >
            AI Front Desk for Modern Clinics
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mt-6 max-w-2xl text-lg leading-8 text-[#64748B]"
          >
            HealthDesk AI answers patient questions, collects intake details,
            books appointments, and escalates urgent conversations to staff with
            context already attached.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Button asChild className="rounded-xl bg-[#0F766E] px-6 py-6 text-white hover:bg-[#0D9488]">
              <Link href="/chat">Talk to HealthDesk AI</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-[#0F766E] bg-white px-6 py-6 text-[#0F766E] hover:bg-[#F0FDFA]"
            >
              <Link href="/dashboard">View Dashboard</Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24 }}
          className="relative z-10"
        >
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Live front desk</p>
                <p className="text-xs text-[#64748B]">Sunrise Family Clinic</p>
              </div>
              <span className="rounded-full bg-[#D1FAE5] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#065F46]">
                Online
              </span>
            </div>
            <div className="grid gap-3 py-5">
              <div className="ml-auto max-w-[80%] rounded-2xl bg-[#F1F5F9] px-4 py-3 text-sm text-[#1E293B]">
                I need to reschedule my physical therapy visit.
              </div>
              <div className="max-w-[86%] rounded-2xl bg-[#F0FDFA] px-4 py-3 text-sm text-[#134E4A]">
                I can help. What day works best, and should I keep Dr. Aisha Patel?
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: MessageCircle, label: "15 open chats", color: "#0F766E" },
                  { icon: CalendarCheck, label: "8 booked today", color: "#2563EB" },
                  { icon: ShieldAlert, label: "1 escalation", color: "#EF4444" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[#E2E8F0] bg-white p-3">
                    <item.icon className="mb-3 h-5 w-5" style={{ color: item.color }} />
                    <p className="text-xs font-semibold text-[#0F172A]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
