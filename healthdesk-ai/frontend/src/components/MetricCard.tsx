"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/Skeleton";

export function MetricCard({
  title,
  value,
  icon: Icon,
  accentColor,
  tintColor,
  loading,
  suffix = "",
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  accentColor: string;
  tintColor: string;
  loading?: boolean;
  suffix?: string;
}) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: 1.2, bounce: 0 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!loading) {
      motionValue.set(value);
    }
  }, [loading, motionValue, value]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      setDisplay(Number.isInteger(value) ? Math.round(latest).toLocaleString() : latest.toFixed(1));
    });
  }, [springValue, value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative min-h-[142px] min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:from-slate-800 dark:to-slate-900/95 dark:shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
    >
      <div className="absolute inset-x-4 top-0 h-1 rounded-b-full" style={{ backgroundColor: accentColor }} />

      <div className="flex h-full flex-col justify-between gap-5">
        <div className="grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_2.25rem] items-start gap-2">
          <p className="min-w-0 whitespace-normal text-[13px] font-semibold leading-[18px] text-[#475569] dark:text-slate-300">
            {title}
          </p>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ring-1 ring-white/80 dark:ring-slate-700/80"
            style={{ color: accentColor, backgroundColor: tintColor }}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div>
          {loading ? (
            <Skeleton className="h-12 w-28" />
          ) : (
            <div className="text-3xl font-bold tracking-normal text-[#0F172A] dark:text-slate-100">
              {display}
              {suffix}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
