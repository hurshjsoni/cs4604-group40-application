"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Building2, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { LogoIcon } from "./components/icons";
import type { UserRole } from "@/lib/types";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<UserRole>("student");

  /*
    globals.css sets `body { background-color: var(--background) }` (near white)
    which covers anything set on <html>. We need to override BOTH:
      - body.style.background  - shows the actual image for page content
      - html.style.backgroundColor - covers iOS rubber-band overscroll areas
        (top/bottom) that sit outside the body paint region
    Inline styles always beat CSS classes regardless of Tailwind layer order.
  */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.background;

    html.style.backgroundColor = "#0d0820";
    body.style.background = `url('/auth-bg.png') center/cover no-repeat #0d0820`;

    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.background = prevBodyBg;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) router.push("/dashboard");
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    /*
      Single wrapper - no position:fixed children.
      The bg-black/20 overlay sits on this element.
      min-h-screen is fine here because the real background is on <html>.
    */
    <div className="flex min-h-screen flex-col items-center justify-center bg-black/20 px-4 py-6">
      <div className="w-full max-w-[440px]">

        {/* Brand mark - no GPU-heavy transforms or blur */}
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/35 shadow-lg">
            <LogoIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">
              A&amp;R Finder
            </h1>
            <p className="text-xs text-white/70">
              Student housing, simplified.
            </p>
          </div>
        </div>

        {/*
          Card - NO backdrop-filter at all.
          backdrop-blur forces a GPU compositing layer. When the iOS keyboard
          opens it triggers a full compositing re-render which crashes Safari.
          A sufficiently opaque solid background achieves the same visual.
        */}
        <div className="w-full rounded-2xl border border-white/10 bg-black/65 px-5 py-5 shadow-xl">

          {/* Heading + mode switch */}
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight text-white">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-semibold text-white/85 underline-offset-4 hover:underline"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="font-semibold text-white/85 underline-offset-4 hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>

          {/* Role selector */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">
              I am a
            </p>
            <div className="flex gap-2">
              <RoleButton
                icon={GraduationCap}
                label="Student"
                selected={role === "student"}
                onClick={() => setRole("student")}
              />
              <RoleButton
                icon={Building2}
                label="Provider"
                selected={role === "provider"}
                onClick={() => setRole("provider")}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="mb-4 h-px bg-white/10" />

          {/* Form */}
          {mode === "signin" ? (
            <SignInForm role={role} />
          ) : (
            <SignUpForm role={role} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Role Button ──────────────────────────────────────────── */
function RoleButton({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
        selected
          ? "border-white/60 bg-white/20 text-white"
          : "border-white/15 bg-white/5 text-white/50 hover:border-white/30 hover:bg-white/10 hover:text-white/80"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      {selected && (
        <Check className="ml-auto h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      )}
    </button>
  );
}

/* ── Sign In ──────────────────────────────────────────────── */
function SignInForm({ role }: { role: UserRole }) {
  const { setRole } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        const code = (error as { code?: string }).code ?? "";
        const msg = (error as { message?: string }).message ?? "";
        if (
          code === "user_not_found" ||
          code === "email_not_found" ||
          /not found|no account|doesn't exist/i.test(msg)
        ) {
          toast.error("No account found with this email.");
        } else if (
          code === "invalid_password" ||
          /invalid password|incorrect password|wrong password/i.test(msg)
        ) {
          toast.error("Incorrect password.");
        } else {
          toast.error(msg || "Invalid email or password.");
        }
        return;
      }
      setRole(role);
    } catch {
      toast.error("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Email">
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="form-input w-full border-white/15 bg-white/10 text-white placeholder:text-white/30 focus:border-white/40 focus:ring-white/10"
        />
      </Field>
      <Field label="Password">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="form-input w-full border-white/15 bg-white/10 text-white placeholder:text-white/30 pr-10 focus:border-white/40 focus:ring-white/10"
          />
          <TogglePassword show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
        </div>
      </Field>
      <div className="pt-1">
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </div>
    </form>
  );
}

/* ── Sign Up ──────────────────────────────────────────────── */
function SignUpForm({ role }: { role: UserRole }) {
  const { setRole } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirm) return;
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await authClient.signUp.email({ name, email, password });
      if (error) {
        const code = (error as { code?: string }).code ?? "";
        const msg = (error as { message?: string }).message ?? "";
        if (code === "USER_ALREADY_EXISTS" || /already exists|already registered/i.test(msg)) {
          toast.error("An account with this email already exists.");
        } else {
          toast.error(msg || "Sign up failed. Please try again.");
        }
        return;
      }
      setRole(role);
      toast.success("Account created! Welcome to A&R Finder.");
    } catch {
      toast.error("Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Full Name">
        <input
          type="text"
          autoComplete="name"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="form-input w-full border-white/15 bg-white/10 text-white placeholder:text-white/30 focus:border-white/40 focus:ring-white/10"
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="form-input w-full border-white/15 bg-white/10 text-white placeholder:text-white/30 focus:border-white/40 focus:ring-white/10"
        />
      </Field>
      <Field label="Password">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="form-input w-full border-white/15 bg-white/10 text-white placeholder:text-white/30 pr-10 focus:border-white/40 focus:ring-white/10"
          />
          <TogglePassword show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
        </div>
      </Field>
      <Field label="Confirm Password">
        <input
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Enter password again"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className={`form-input w-full border-white/15 bg-white/10 text-white placeholder:text-white/30 focus:border-white/40 focus:ring-white/10 ${
            confirm && password !== confirm ? "border-red-400/60" : ""
          }`}
        />
        {confirm && password !== confirm && (
          <p className="mt-0.5 text-xs text-red-400">Passwords do not match</p>
        )}
      </Field>
      <div className="pt-0.5">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading || (!!confirm && password !== confirm)}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account
        </Button>
      </div>
    </form>
  );
}

/* ── Shared micro-components ──────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-white/70">{label}</label>
      {children}
    </div>
  );
}

function TogglePassword({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
