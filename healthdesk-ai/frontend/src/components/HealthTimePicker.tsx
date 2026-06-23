"use client";

import { useMemo } from "react";

import { HealthSelect, type HealthSelectOption } from "@/components/HealthSelect";

type HealthTimePickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  stepMinutes?: number;
  startHour?: number;
  endHour?: number;
};

function toDisplayTime(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }

  const marker = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${marker}`;
}

function buildTimeOptions(stepMinutes: number, startHour: number, endHour: number) {
  const options: HealthSelectOption[] = [];
  const start = startHour * 60;
  const end = endHour * 60;
  for (let totalMinutes = start; totalMinutes <= end; totalMinutes += stepMinutes) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    options.push({ value, label: toDisplayTime(value) });
  }
  return options;
}

export function HealthTimePicker({
  value,
  onValueChange,
  placeholder = "Select time",
  disabled = false,
  className,
  ariaLabel,
  stepMinutes = 10,
  startHour = 6,
  endHour = 20,
}: HealthTimePickerProps) {
  const options = useMemo(
    () => buildTimeOptions(stepMinutes, startHour, endHour),
    [endHour, startHour, stepMinutes],
  );
  const hasValue = options.some((option) => option.value === value);

  return (
    <HealthSelect
      value={hasValue ? value : ""}
      onValueChange={onValueChange}
      placeholder={hasValue ? toDisplayTime(value) : placeholder}
      disabled={disabled}
      className={className}
      ariaLabel={ariaLabel}
      options={options}
      buttonClassName="bg-white"
      menuClassName="max-h-72"
    />
  );
}
