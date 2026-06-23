"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart2,
  Bell,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const features = [
  {
    icon: MessageSquare,
    title: "Instant Patient Responses",
    body: "Answers clinic FAQs, hours, services, and insurance questions the moment a patient asks - day or night.",
  },
  {
    icon: Calendar,
    title: "Appointment Scheduling",
    body: "Lets patients book, reschedule, or cancel appointments directly through the chat - no phone tag needed.",
  },
  {
    icon: ClipboardList,
    title: "Intake Collection",
    body: "Gathers reason for visit, insurance, and preferences before the appointment so your staff arrives prepared.",
  },
  {
    icon: FileText,
    title: "AI Conversation Summaries",
    body: "Every patient interaction gets a clean staff-ready summary automatically - no manual notes required.",
  },
  {
    icon: AlertTriangle,
    title: "Emergency Escalation",
    body: "Detects urgent symptoms instantly, directs patients to call 911, and flags the conversation for immediate staff review.",
  },
  {
    icon: BarChart2,
    title: "Staff Analytics Dashboard",
    body: "Real-time charts and metrics show inquiry volume, booking rates, peak hours, and escalation trends.",
  },
];

const socialStats = [
  { icon: Zap, phrase: "Responds in < 3 seconds", label: "Instant answers" },
  { icon: Clock, phrase: "24 / 7 Availability", label: "Always online" },
  { icon: Calendar, phrase: "Zero Missed Appointments", label: "Capture every request" },
  { icon: AlertTriangle, phrase: "Emergency Escalation in Real Time", label: "Urgent routing" },
  { icon: ShieldCheck, phrase: "No Medical Advice - Ever", label: "Administrative only" },
];

const steps = [
  {
    title: "Connect Your Clinic",
    body: "Sign up, enter your clinic details, providers, services, hours, and FAQs. Takes under 10 minutes.",
  },
  {
    title: "AI Learns Your Clinic",
    body: "HealthDesk AI is instantly grounded in your real clinic context - no generic answers, no hallucinated information.",
  },
  {
    title: "Patients Get Instant Help",
    body: "Patients chat or speak with the assistant and get real answers, book appointments, and submit intake - all without calling.",
  },
];

const clinicTypes = [
  "General Practice",
  "Pediatrics",
  "Physical Therapy",
  "Dental",
  "Dermatology",
  "Mental Health",
  "Chiropractic",
  "Urgent Care",
  "Women's Health",
  "Sports Medicine",
];

const clinicBenefits = [
  "Works with your existing scheduling flow",
  "No EHR integration required to get started",
  "Staff dashboard requires no technical training",
  "Escalation rules fully configurable",
  "Handles new and returning patients differently",
  "Available in English (multilingual coming soon)",
];

export default function Home() {
  return (
    <main className="bg-[#F8FAFC]">
      <section className="overflow-hidden px-6 pb-20 pt-16 sm:pt-20">
        <div className="mx-auto max-w-[1280px] text-center">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-[800px]"
          >
            <span className="inline-flex items-center rounded-full border border-[#CCFBF1] bg-white px-4 py-2 text-sm font-semibold text-[#0F766E] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <Sparkles className="mr-2 h-4 w-4" />
              AI-powered front desk for small clinics
            </span>
            <h1 className="mt-7 text-[36px] font-bold leading-tight tracking-normal text-[#0F172A] sm:text-[56px]">
              Your Clinic&apos;s AI Front Desk,
              <br />
              Working Around the Clock
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mt-6 max-w-[760px] text-lg leading-8 text-[#64748B]"
          >
            HealthDesk AI handles patient questions, appointment scheduling,
            intake collection, and staff summaries - so your team focuses on
            care, not paperwork.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button
              asChild
              className="h-14 rounded-xl bg-[#0F766E] px-8 text-lg text-white hover:bg-[#0D9488]"
            >
              <Link href="/chat">Talk to HealthDesk AI</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-14 rounded-xl border-[#0F766E] bg-white px-8 text-lg text-[#0F766E] hover:bg-[#F0FDFA]"
            >
              <Link href="/dashboard">View Staff Dashboard</Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-3"
          >
            <span className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#1E293B]">
              <span className="mr-2 h-2.5 w-2.5 animate-pulse rounded-full bg-[#10B981]" />
              Responds in seconds
            </span>
            <span className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#1E293B]">
              <Clock className="mr-2 h-4 w-4 text-[#0F766E]" />
              Available 24 / 7
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: [0, -10, 0] }}
            transition={{
              opacity: { duration: 0.6, delay: 0.4 },
              y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.6 },
            }}
            className="mx-auto mt-10 max-w-4xl rounded-2xl border border-[#E2E8F0] bg-white p-4 text-left shadow-lg sm:p-5"
          >
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Conversations", "142", "#0F766E"],
                ["Appointments", "38", "#2563EB"],
                ["Escalations", "2", "#EF4444"],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  <p className="text-xs font-semibold text-[#64748B]">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-[#0F172A]">{value}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-[#E2E8F0]">
                    <div className="h-1.5 rounded-full" style={{ width: "68%", backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0F172A]">Inquiry volume</p>
                <p className="text-xs text-[#64748B]">Last 7 days</p>
              </div>
              <div className="flex h-24 items-end gap-2 sm:h-28">
                {[38, 52, 44, 70, 58, 82, 76].map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end rounded-t-lg bg-[#F1F5F9]">
                    <div
                      className="w-full rounded-t-lg bg-[#0F766E]"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#F0FDFA] px-6 py-6">
        <div className="mx-auto grid max-w-[1280px] gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {socialStats.map((stat, index) => (
            <div
              key={stat.phrase}
              className={cn(
                "text-center",
                index > 0 && "lg:border-l lg:border-[#CCFBF1]",
              )}
            >
              <stat.icon className="mx-auto h-5 w-5 text-[#0F766E]" />
              <p className="mt-2 text-sm font-bold text-[#0F172A]">{stat.phrase}</p>
              <p className="mt-1 text-xs text-[#64748B]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="px-6 py-20">
        <div className="mx-auto max-w-[1280px]">
          <SectionHeader
            title="Everything Your Front Desk Handles - Automated"
            subtitle="One AI assistant manages the entire patient interaction before they ever reach your staff."
          />
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => (
              <motion.article
                key={feature.title}
                variants={fadeUp}
                transition={{ duration: 0.45 }}
                className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#F0FDFA] text-[#0F766E]">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-[#0F172A]">{feature.title}</h3>
                <p className="mt-3 text-base leading-7 text-[#64748B]">{feature.body}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#F0FDFA] px-6 py-20">
        <div className="mx-auto max-w-[1280px]">
          <SectionHeader
            title="Live in Three Steps"
            subtitle="No long setup. No training your team on new software."
          />
          <div className="relative mt-12 grid gap-8 md:grid-cols-3">
            <div className="absolute left-[16%] right-[16%] top-6 hidden border-t-2 border-dashed border-[#99F6E4] md:block" />
            {steps.map((step, index) => (
              <motion.article
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="relative text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0F766E] text-xl font-bold text-white shadow-lg">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-[#0F172A]">{step.title}</h3>
                <p className="mt-3 text-base leading-7 text-[#64748B]">{step.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="for-clinics" className="px-6 py-20">
        <div className="mx-auto max-w-[1280px]">
          <SectionHeader
            title="Built for Small Clinics"
            subtitle="Whether you run a single-provider practice or a multi-provider clinic, HealthDesk AI fits without custom development."
          />
          <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="flex flex-wrap gap-3">
              {clinicTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#1E293B] transition-colors hover:border-[#0F766E] hover:text-[#0F766E]"
                >
                  {type}
                </span>
              ))}
            </div>
            <div className="grid gap-4">
              {clinicBenefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0F766E]" />
                  <p className="text-base text-[#1E293B]">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F0FDFA] px-6 py-20">
        <div className="mx-auto max-w-[1280px]">
          <SectionHeader title="Medical Safety Built In" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="mx-auto mt-10 max-w-2xl rounded-2xl border border-[#E2E8F0] border-l-4 border-l-[#EF4444] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            <AlertTriangle className="h-10 w-10 text-[#EF4444]" />
            <h3 className="mt-5 text-2xl font-bold text-[#0F172A]">
              HealthDesk AI Never Gives Medical Advice
            </h3>
            <p className="mt-4 leading-7 text-[#64748B]">
              The assistant is strictly limited to scheduling, clinic
              information, and administrative support. If a patient mentions
              chest pain, difficulty breathing, stroke symptoms, or any
              emergency language, the assistant immediately directs them to call
              911 and creates an urgent alert for clinic staff.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center rounded-full border border-[#10B981]/25 bg-[#D1FAE5] px-4 py-2 text-sm font-semibold text-[#065F46] dark:border-[#D1FAE5]/20 dark:bg-[#064E3B] dark:text-[#D1FAE5]">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Safe Escalation
              </span>
              <span className="inline-flex items-center rounded-full border border-[#0F766E]/25 bg-[#CCFBF1] px-4 py-2 text-sm font-semibold text-[#134E4A] dark:border-[#CCFBF1]/20 dark:bg-[#0F766E] dark:text-white">
                <Bell className="mr-2 h-4 w-4" />
                Staff Alerted Instantly
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-6 py-20">
        <motion.figure
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-2xl rounded-2xl bg-[#F0FDFA] p-10 text-center"
        >
          <div className="text-6xl font-bold leading-none text-[#0F766E]">&ldquo;</div>
          <blockquote className="mt-4 text-xl italic leading-8 text-[#0F172A]">
            We stopped missing after-hours booking requests the week we
            launched. Patients love getting instant answers, and our front desk
            actually has time to focus on patients in the office.
          </blockquote>
          <figcaption className="mt-7 flex items-center justify-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0F766E] font-bold text-white">
              SG
            </span>
            <span className="text-left">
              <span className="block font-bold text-[#0F172A]">Dr. Sarah Greene</span>
              <span className="block text-sm text-[#64748B]">General Practice, Phoenix AZ</span>
            </span>
          </figcaption>
        </motion.figure>
      </section>

      <section className="bg-[#0F766E] px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-4xl font-bold text-white">Your Front Desk Should Never Sleep</h2>
          <p className="mt-5 text-lg leading-8 text-teal-100">
            Join clinics already using HealthDesk AI to respond faster, book
            more appointments, and reduce front-desk overload.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild className="h-14 rounded-xl bg-white px-8 text-[#0F766E] hover:bg-[#F0FDFA]">
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-14 rounded-xl border-white bg-transparent px-8 text-white hover:bg-white hover:text-[#0F766E]"
            >
              <Link href="/chat">Talk to the Assistant</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="bg-[#0F172A] px-6 py-12">
        <div className="mx-auto grid max-w-[1280px] gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-white">
              <span className="rounded-full bg-white/10 p-2">
                <Stethoscope className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold">HealthDesk AI</span>
            </Link>
            <p className="mt-4 text-sm text-slate-400">AI-powered front desk for modern clinics.</p>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              HealthDesk AI does not provide medical advice, diagnosis, or
              treatment. It only supports scheduling, clinic information, and
              administrative workflows.
            </p>
          </div>
          <FooterColumn title="Product" links={[
            ["Features", "/#features"],
            ["How It Works", "/#how-it-works"],
            ["For Clinics", "/#for-clinics"],
          ]} />
          <FooterColumn title="Account" links={[
            ["Sign Up", "/signup"],
            ["Log In", "/login"],
            ["Staff Dashboard", "/dashboard"],
          ]} />
          <FooterColumn title="Legal & Contact" links={[
            ["Privacy Policy", "#"],
            ["Terms of Use", "#"],
            ["hello@healthdesk.ai", "mailto:hello@healthdesk.ai"],
          ]} />
        </div>
        <div className="mx-auto mt-10 max-w-[1280px] border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
          © 2026 HealthDesk AI. All rights reserved.
        </div>
      </footer>
    </main>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="text-3xl font-bold tracking-normal text-[#0F172A] sm:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-base leading-7 text-[#64748B] sm:text-lg">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<[string, string]>;
}) {
  return (
    <div>
      <h3 className="font-bold text-white">{title}</h3>
      <div className="mt-4 grid gap-3">
        {links.map(([label, href]) => (
          <Link key={label} href={href} className="text-sm text-slate-300 transition-colors hover:text-white">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
