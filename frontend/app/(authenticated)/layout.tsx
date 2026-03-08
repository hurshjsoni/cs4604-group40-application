"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../components/Sidebar";
import { Onboarding } from "../components/Onboarding";
import { GlobalNotifier } from "../components/GlobalNotifier";
import { useAuth } from "@/lib/auth-context";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, isNewUser, user, role, completeOnboarding } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {isNewUser && role && role !== "admin" && user && (
        <Onboarding
          role={role}
          userName={user.name}
          userEmail={user.email}
          onComplete={completeOnboarding}
        />
      )}
      <GlobalNotifier />
      <Sidebar />
      <main className="pt-14 transition-all duration-200 lg:pl-14 lg:pt-0">
        <div className="min-h-screen bg-background">{children}</div>
      </main>
    </div>
  );
}
