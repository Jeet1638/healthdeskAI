"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthShell } from "@/components/AuthShell";
import { GoogleLogo } from "@/components/GoogleLogo";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerUser } from "@/lib/api";

const signupSchema = z
  .object({
    name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
    clinicName: z.string().min(2, "Enter your clinic name"),
    terms: z.boolean().refine((value) => value, {
      message: "Accept the terms to continue",
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  });

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      clinicName: "",
      terms: false,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (loading) {
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    let redirectStarted = false;
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        clinic_name: values.clinicName,
        role: "admin",
      });
      const signInResult = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
        callbackUrl: "/dashboard",
      });

      if (!signInResult || signInResult.error) {
        throw new Error("Account created, but automatic sign-in failed. Please sign in.");
      }

      setSuccess("Clinic account created. Opening your dashboard.");
      toast.success("Clinic account created");
      redirectStarted = true;
      window.location.assign("/dashboard");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Sign up failed";
      setError(message.includes("400") ? "That email is already registered." : message);
    } finally {
      if (!redirectStarted) {
        setLoading(false);
      }
    }
  });

  return (
    <AuthShell
      title="Create your clinic workspace"
      subtitle="Start with one clinic, one admin, and secure access to the HealthDesk dashboard."
    >
      <div className="grid min-w-0 gap-4">
        {error && <div className="rounded-xl bg-[#FEF3C7] px-4 py-3 text-sm font-medium text-[#92400E]">{error}</div>}
        {success && <div className="rounded-xl bg-[#D1FAE5] px-4 py-3 text-sm font-medium text-[#065F46]">{success}</div>}

        <div className="grid min-w-0 gap-4">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="name">Full name</Label>
            <IconInput id="name" icon={<UserRound className="h-4 w-4" />} {...register("name")} />
            {errors.name && <FieldError message={errors.name.message} />}
          </div>

          <div className="grid min-w-0 gap-2">
            <Label htmlFor="email">Email</Label>
            <IconInput id="email" type="email" icon={<Mail className="h-4 w-4" />} {...register("email")} />
            {errors.email && <FieldError message={errors.email.message} />}
          </div>

          <div className="grid min-w-0 gap-2">
            <Label htmlFor="clinicName">Clinic name</Label>
            <IconInput id="clinicName" icon={<Building2 className="h-4 w-4" />} {...register("clinicName")} />
            {errors.clinicName && <FieldError message={errors.clinicName.message} />}
          </div>

          <div className="grid min-w-0 gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative min-w-0">
              <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                className="h-11 w-full rounded-lg border-[#CBD5E1] bg-[#F1F5F9] px-9"
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#1E293B] transition-colors hover:bg-[#F0FDFA] hover:text-[#0F766E] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0D9488]/40"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <FieldError message={errors.password.message} />}
          </div>

          <div className="grid min-w-0 gap-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative min-w-0">
              <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                className="h-11 w-full rounded-lg border-[#CBD5E1] bg-[#F1F5F9] px-9"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#1E293B] transition-colors hover:bg-[#F0FDFA] hover:text-[#0F766E] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0D9488]/40"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <FieldError message={errors.confirmPassword.message} />}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="h-auto min-w-0 justify-start whitespace-normal rounded-xl bg-[#F8FAFC] px-3 py-3 text-left text-sm text-[#1E293B] hover:bg-[#F0FDFA]"
          onClick={() => {
            const nextValue = !termsAccepted;
            setTermsAccepted(nextValue);
            setValue("terms", nextValue, { shouldValidate: true });
          }}
        >
          <span className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#CBD5E1] bg-white">
            {termsAccepted && <Check className="h-4 w-4 text-[#0F766E]" />}
          </span>
          I agree to use HealthDesk AI for clinic operations responsibly.
        </Button>
        {errors.terms && <FieldError message={errors.terms.message} />}

        <div className="grid min-w-0 gap-3">
          <Button
            type="button"
            onClick={() => void onSubmit()}
            disabled={loading}
            className="h-12 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]"
          >
            {loading ? <LoadingSpinner label="Creating account" /> : "Create Account"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="h-12 w-full rounded-xl border-[#E2E8F0] bg-white text-center leading-tight text-[#1E293B] whitespace-normal hover:bg-[#F8FAFC]"
          >
            <GoogleLogo />
            <span className="ml-3">Continue with Google</span>
          </Button>
          <p className="text-center text-sm leading-6 text-[#64748B]">
            Signing up with Google will create a new clinic account. You can add
            your clinic details in Settings.
          </p>
        </div>

        <p className="text-center text-sm text-[#64748B]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#0F766E] hover:text-[#0D9488]">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

function FieldError({ message }: { message?: string }) {
  return <p className="text-sm font-medium text-[#92400E]">{message}</p>;
}

function IconInput({
  icon,
  ...props
}: ComponentProps<typeof Input> & { icon: ReactNode }) {
  return (
    <div className="relative min-w-0">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">{icon}</span>
      <Input
        className="h-11 w-full rounded-lg border-[#CBD5E1] bg-[#F1F5F9] pl-9"
        {...props}
      />
    </div>
  );
}
