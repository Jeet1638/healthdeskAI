"use client";

import { Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#F8FAFC] px-6">
      <section className="max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#CCFBF1] text-[#0F766E]">
          <Stethoscope className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-[#0F172A]">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-[#64748B]">
          The workspace hit an unexpected error. Reload this view and try again.
        </p>
        <Button
          type="button"
          className="mt-6 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]"
          onClick={reset}
        >
          Reload
        </Button>
      </section>
    </main>
  );
}
