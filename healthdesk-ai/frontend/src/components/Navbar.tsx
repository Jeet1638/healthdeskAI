"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getMyClinic } from "@/lib/api";

const publicLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#for-clinics", label: "For Clinics" },
  { href: "/chat", label: "Talk to the Assistant" },
];

const privateLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessageSquareText },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/intake", label: "Intake", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const blur = useTransform(scrollY, [0, 80], ["blur(0px)", "blur(14px)"]);
  const [clinicName, setClinicName] = useState("Clinic workspace");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const isAuthenticated = status === "authenticated";
  const isPatientAssistantPage = pathname === "/chat";
  const showAuthenticatedNavigation = isAuthenticated && !isPatientAssistantPage;

  useEffect(() => {
    let mounted = true;
    if (!session?.access_token) {
      return;
    }
    getMyClinic(session.access_token)
      .then((clinic) => {
        if (mounted) {
          setClinicName(clinic.name);
        }
      })
      .catch(() => {
        if (mounted) {
          setClinicName("Clinic workspace");
        }
      });
    return () => {
      mounted = false;
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [profileOpen]);

  const navLinks = showAuthenticatedNavigation ? privateLinks : publicLinks;

  return (
    <motion.header
      style={{ backdropFilter: blur }}
      className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white/88"
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-[#0F172A]">
          <span className="rounded-full bg-[#CCFBF1] p-2">
            <Stethoscope className="h-5 w-5 text-[#0F766E]" />
          </span>
          <span className="text-lg font-bold tracking-normal">HealthDesk AI</span>
        </Link>

        <nav className="hidden items-center gap-6 xl:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[#1E293B] transition-colors hover:text-[#0F766E]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <ThemeToggle />
          {showAuthenticatedNavigation ? (
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#1E293B] transition-colors hover:bg-[#F0FDFA] hover:text-[#0F766E] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0D9488]/40"
                onClick={() => setProfileOpen((value) => !value)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                  <UserRound className="mr-2 h-4 w-4 text-[#0F766E]" />
                  {session.user?.name ?? "Profile"}
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    role="menu"
                    className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-[0_24px_70px_rgba(15,23,42,0.12)]"
                  >
                    <div className="px-3 py-3">
                      <span className="block text-sm font-bold text-[#0F172A]">
                        {session.user?.name ?? "Clinic user"}
                      </span>
                      <span className="mt-1 block text-xs font-medium text-[#64748B]">
                        {clinicName}
                      </span>
                    </div>
                    <div className="h-px bg-[#F1F5F9]" />
                    <Link
                      href="/settings"
                      role="menuitem"
                      className="mt-2 flex items-center rounded-xl px-3 py-2 text-sm font-medium text-[#1E293B] transition-colors hover:bg-[#F0FDFA] hover:text-[#0F766E]"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Settings className="mr-2 h-4 w-4 text-[#0F766E]" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-[#1E293B] transition-colors hover:bg-[#F0FDFA] hover:text-[#0F766E]"
                      onClick={() => {
                        setProfileOpen(false);
                        void signOut({ callbackUrl: "/" });
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4 text-[#0F766E]" />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Button asChild variant="ghost" className="rounded-xl hover:bg-[#F0FDFA]">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild className="rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="outline" size="icon" className="rounded-xl border-[#CBD5E1] xl:hidden" />
            }
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="right" className="h-full w-[min(92vw,380px)] border-[#E2E8F0] bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4 pr-8">
              <SheetTitle className="text-left text-lg font-bold text-[#0F172A]">Navigation</SheetTitle>
              <ThemeToggle />
            </div>
            <div className="mt-8 grid gap-3">
              {navLinks.map((link) => (
                <Button
                  key={link.href}
                  asChild
                  variant="ghost"
                  className="justify-start rounded-xl text-[#1E293B] hover:bg-[#F0FDFA] hover:text-[#0F766E]"
                  onClick={() => setMobileOpen(false)}
                >
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
              {!showAuthenticatedNavigation ? (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    className="justify-start rounded-xl text-[#1E293B] hover:bg-[#F0FDFA] hover:text-[#0F766E]"
                  >
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      Login
                    </Link>
                  </Button>
                  <Button asChild className="mt-2 rounded-xl bg-[#0F766E] text-white hover:bg-[#0D9488]">
                    <Link href="/signup" onClick={() => setMobileOpen(false)}>
                      Sign Up
                    </Link>
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  className="justify-start rounded-xl text-[#1E293B] hover:bg-[#F0FDFA] hover:text-[#0F766E]"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <LogOut className="mr-2 h-4 w-4 text-[#0F766E]" />
                  Logout
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </motion.header>
  );
}
