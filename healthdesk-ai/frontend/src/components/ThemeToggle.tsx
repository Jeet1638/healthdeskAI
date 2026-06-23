"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { useTheme, type Theme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const CurrentIcon = options.find((option) => option.value === theme)?.icon ?? Monitor;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#64748B] transition-colors hover:bg-[#F0FDFA] hover:text-[#0F766E] dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Toggle theme"
      >
        <CurrentIcon className="h-5 w-5" />
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                theme === value
                  ? "bg-[#F0FDFA] text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-300"
                  : "text-[#1E293B] hover:bg-[#F8FAFC] dark:text-slate-300 dark:hover:bg-slate-700",
              )}
              onClick={() => {
                setTheme(value);
                setOpen(false);
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
