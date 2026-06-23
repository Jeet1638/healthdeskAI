"use client";

import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { cn } from "@/lib/utils";

type HealthDatePickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function todayAtMidnight() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function parseDateValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  const date = parseDateValue(value);
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function sameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function buildCalendarDays(monthDate: Date) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function HealthDatePicker({
  value,
  onValueChange,
  placeholder = "Select date",
  disabled = false,
  className,
  ariaLabel,
}: HealthDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? todayAtMidnight());
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const calendarId = useId();

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const today = useMemo(() => todayAtMidnight(), []);

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger || typeof window === "undefined") {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const margin = 16;
    const gap = 8;
    const popoverWidth = Math.min(rect.width, window.innerWidth - margin * 2);
    const left = Math.min(
      Math.max(rect.left, margin),
      Math.max(margin, window.innerWidth - popoverWidth - margin),
    );
    const availableBelow = window.innerHeight - rect.bottom - margin;
    const availableAbove = rect.top - margin;
    const openAbove = availableBelow < 380 && availableAbove > availableBelow;

    setMenuStyle({
      position: "fixed",
      left,
      width: popoverWidth,
      boxSizing: "border-box",
      zIndex: 90,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedDate && !open) {
      setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [open, selectedDate]);

  useLayoutEffect(() => {
    if (open) {
      updateMenuPosition();
    }
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const selectDate = (date: Date) => {
    onValueChange(formatDateValue(date));
    setOpen(false);
  };

  const popover = (
    <motion.div
      ref={popoverRef}
      id={calendarId}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      style={menuStyle}
      className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white/96 p-3 text-[#0F172A] shadow-[0_20px_55px_rgba(15,23,42,0.18)] ring-1 ring-white/80 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/96 dark:text-slate-100 dark:ring-white/10"
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-xl px-3 py-2 text-sm font-bold transition-colors hover:bg-[#F0FDFA] hover:text-[#0F766E] dark:hover:bg-teal-950/45 dark:hover:text-teal-200"
          onClick={() => setVisibleMonth(todayAtMidnight())}
        >
          {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(visibleMonth)}
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition-colors hover:bg-[#F0FDFA] hover:text-[#0F766E] dark:text-slate-300 dark:hover:bg-teal-950/45 dark:hover:text-teal-200"
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition-colors hover:bg-[#F0FDFA] hover:text-[#0F766E] dark:text-slate-300 dark:hover:bg-teal-950/45 dark:hover:text-teal-200"
            onClick={() => moveMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-bold text-[#64748B] dark:text-slate-400">
        {dayLabels.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date) => {
          const isSelected = selectedDate ? sameDate(date, selectedDate) : false;
          const isToday = sameDate(date, today);
          const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
          return (
            <button
              key={formatDateValue(date)}
              type="button"
              onClick={() => selectDate(date)}
              className={cn(
                "flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-all",
                isCurrentMonth
                  ? "text-[#0F172A] dark:text-slate-100"
                  : "text-[#94A3B8] dark:text-slate-500",
                "hover:bg-[#F0FDFA] hover:text-[#0F766E] dark:hover:bg-teal-950/45 dark:hover:text-teal-200",
                isToday && !isSelected && "ring-1 ring-[#0F766E]/25",
                isSelected &&
                  "bg-[#0F766E] text-white shadow-[0_8px_18px_rgba(15,118,110,0.25)] hover:bg-[#0F766E] hover:text-white",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-3 dark:border-slate-700">
        <button
          type="button"
          className="rounded-xl px-3 py-2 text-sm font-bold text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          onClick={() => {
            onValueChange("");
            setOpen(false);
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="rounded-xl bg-[#F0FDFA] px-3 py-2 text-sm font-bold text-[#0F766E] transition-colors hover:bg-[#CCFBF1] dark:bg-teal-950/45 dark:text-teal-200"
          onClick={() => selectDate(today)}
        >
          Today
        </button>
      </div>
    </motion.div>
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={calendarId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="group flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 text-left text-sm font-semibold text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.78)] transition-all hover:border-[#0F766E] hover:bg-white hover:shadow-[0_8px_22px_rgba(15,118,110,0.10)] focus-visible:border-[#0F766E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F766E]/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-[0_1px_2px_rgba(0,0,0,0.25)] dark:hover:border-[#0D9488] dark:hover:bg-slate-900"
      >
        <span className={cn("truncate", !value && "text-[#94A3B8]")}>
          {formatDisplayDate(value) || placeholder}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#CCFBF1] text-[#0F766E] transition-transform group-aria-expanded:scale-105 dark:bg-teal-950 dark:text-teal-200">
          {value ? <X className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
        </span>
      </button>

      {open && mounted ? createPortal(popover, document.body) : null}
    </div>
  );
}
