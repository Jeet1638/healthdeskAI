"use client";

import { CalendarClock, RotateCcw, XCircle } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Appointment } from "@/types/api";

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function AppointmentTable({
  appointments,
  onReschedule,
  onCancel,
  loading,
  timeZone = "America/Phoenix",
}: {
  appointments: Appointment[];
  onReschedule: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  loading?: boolean;
  timeZone?: string;
}) {
  if (loading) {
    return <SkeletonRows rows={5} />;
  }

  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No appointments found"
        message="Booked visits and appointment requests will appear here."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-slate-700 dark:bg-slate-800">
      <Table>
        <TableHeader>
            <TableRow className="border-[#F1F5F9] dark:border-slate-700">
            <TableHead>Patient</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Date & Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((appointment) => (
            <TableRow key={appointment.id} className="border-[#F1F5F9] dark:border-slate-700">
              <TableCell className="font-semibold text-[#0F172A] dark:text-slate-100">{appointment.patient_name}</TableCell>
              <TableCell>{appointment.provider_name}</TableCell>
              <TableCell>{appointment.service_name}</TableCell>
              <TableCell>{formatDateTime(appointment.start_time, timeZone)}</TableCell>
              <TableCell>
                <StatusBadge status={appointment.status} type="appointment" />
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-[#64748B]">
                {appointment.reason || "No reason listed"}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-[#CBD5E1] text-[#0F766E] hover:bg-[#F0FDFA]"
                    onClick={() => onReschedule(appointment)}
                    disabled={appointment.status === "cancelled"}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Reschedule
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-[#FEE2E2] text-[#EF4444] hover:bg-[#FEE2E2]"
                    onClick={() => onCancel(appointment)}
                    disabled={appointment.status === "cancelled"}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
