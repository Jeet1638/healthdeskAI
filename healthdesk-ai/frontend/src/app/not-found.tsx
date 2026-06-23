import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#F8FAFC] px-6">
      <section className="max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <p className="text-6xl font-bold text-[#0F766E]">404</p>
        <h1 className="mt-4 text-2xl font-bold text-[#0F172A]">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[#64748B]">
          This page does not exist or may have moved.
        </p>
        <Button asChild className="mt-6 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]">
          <Link href="/">Back to Home</Link>
        </Button>
      </section>
    </main>
  );
}
