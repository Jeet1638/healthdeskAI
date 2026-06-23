"use client";

import { motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type HealthSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type HealthSelectProps = {
  value: string;
  options: HealthSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  ariaLabel?: string;
};

export function HealthSelect({
  value,
  options,
  onValueChange,
  placeholder = "Select option",
  disabled = false,
  className,
  buttonClassName,
  menuClassName,
  ariaLabel,
}: HealthSelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger || typeof window === "undefined") {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const margin = 16;
    const gap = 8;
    const availableBelow = window.innerHeight - rect.bottom - margin;
    const availableAbove = rect.top - margin;
    const openAbove = availableBelow < 220 && availableAbove > availableBelow;
    const availableSpace = openAbove ? availableAbove : availableBelow;
    const maxHeight = Math.max(160, Math.min(280, availableSpace - gap));
    const left = Math.min(
      Math.max(rect.left, margin),
      Math.max(margin, window.innerWidth - rect.width - margin),
    );

    setMenuStyle({
      position: "fixed",
      left,
      width: rect.width,
      maxHeight,
      zIndex: 90,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
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

  const menu = (
    <motion.div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      style={menuStyle}
      className={cn(
        "overflow-auto rounded-2xl border border-[#E2E8F0] bg-white/96 p-2 text-[#0F172A] shadow-[0_20px_55px_rgba(15,23,42,0.18)] ring-1 ring-white/80 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/96 dark:text-slate-100 dark:ring-white/10",
        menuClassName,
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={option.disabled}
            onClick={() => {
              onValueChange(option.value);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-[#F0FDFA] hover:text-[#0F766E] focus:bg-[#F0FDFA] focus:text-[#0F766E] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-teal-950/45 dark:hover:text-teal-200 dark:focus:bg-teal-950/45 dark:focus:text-teal-200",
              isSelected && "bg-[#F0FDFA] text-[#0F766E] dark:bg-teal-950/45 dark:text-teal-200",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
          </button>
        );
      })}
    </motion.div>
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "group flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 text-left text-sm font-semibold text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.78)] transition-all hover:border-[#0F766E] hover:bg-white hover:shadow-[0_8px_22px_rgba(15,118,110,0.10)] focus-visible:border-[#0F766E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F766E]/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-[0_1px_2px_rgba(0,0,0,0.25)] dark:hover:border-[#0D9488] dark:hover:bg-slate-900",
          buttonClassName,
        )}
      >
        <span className={cn("truncate", !selected && "text-[#94A3B8]")}>
          {selected?.label ?? placeholder}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#CCFBF1] text-[#0F766E] transition-transform group-aria-expanded:rotate-180 dark:bg-teal-950 dark:text-teal-200">
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>

      {open && mounted ? createPortal(menu, document.body) : null}
    </div>
  );
}
