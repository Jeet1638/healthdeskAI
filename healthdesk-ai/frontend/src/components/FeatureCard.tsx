"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full rounded-2xl border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <CardContent className="p-6">
          <div className="mb-5 inline-flex rounded-full bg-[#F0FDFA] p-3 text-[#0F766E]">
            <Icon className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-[#0F172A]">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-[#64748B]">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
