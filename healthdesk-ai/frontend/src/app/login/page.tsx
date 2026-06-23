"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthShell } from "@/components/AuthShell";
import { GoogleLogo } from "@/components/GoogleLogo";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const callbackUrl = "/dashboard";

  useEffect(() => {
    const authError = searchParams.get("error");
    if (!authError) {
      return;
    }

    const message =
      authError === "OAuthAccountNotLinked"
        ? "This email is already registered with a password. Please log in with your email and password."
        : authError === "OAuthSignin" || authError === "OAuthCallback"
          ? "Google sign-in failed. Please try again."
          : "Sign-in failed. Please try again.";
    setError(message);
    toast.error(message);
  }, [searchParams]);

  const onSubmit = handleSubmit(async (values) => {
    if (loading) {
      return;
    }
    setLoading(true);
    setError("");
    let redirectStarted = false;
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
        callbackUrl,
      });

      if (!result || result.error) {
        setError("Email or password is incorrect.");
        return;
      }

      toast.success("Welcome back to HealthDesk AI");
      redirectStarted = true;
      window.location.assign(callbackUrl);
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      if (!redirectStarted) {
        setLoading(false);
      }
    }
  });

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage conversations, appointments, patients, and clinic settings."
    >
      <div className="grid gap-5">
        {error && (
          <div className="rounded-xl bg-[#FEF3C7] px-4 py-3 text-sm font-medium text-[#92400E]">
            {error}
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              id="email"
              type="email"
              className="h-11 rounded-lg border-[#CBD5E1] bg-[#F1F5F9] pl-9"
              {...register("email")}
            />
          </div>
          {errors.email && <p className="text-sm font-medium text-[#92400E]">{errors.email.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              className="h-11 rounded-lg border-[#CBD5E1] bg-[#F1F5F9] px-9"
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
          {errors.password && <p className="text-sm font-medium text-[#92400E]">{errors.password.message}</p>}
        </div>

        <Button
          type="button"
          onClick={() => void onSubmit()}
          disabled={loading}
          className="h-12 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]"
        >
          {loading ? <LoadingSpinner label="Signing in" /> : "Sign In"}
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

        <p className="text-center text-sm text-[#64748B]">
          New to HealthDesk AI?{" "}
          <Link href="/signup" className="font-semibold text-[#0F766E] hover:text-[#0D9488]">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
