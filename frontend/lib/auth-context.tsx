"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useConvexAuth } from "convex/react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { authClient } from "./auth-client";
import type { UserRole } from "./types";
import type { ContactInfo } from "./types";

interface ConvexUser {
  _id: string;
  _creationTime: number;
  email: string;
  name: string;
  role: "student" | "provider" | "admin";
  isVerified: boolean;
  avatarUrl?: string;
  onboardingComplete: boolean;
}

interface UserCompat {
  id: string;
  _id: string;
  email: string;
  name: string;
  role: UserRole;
  isVerified: boolean;
  avatarUrl: string | null;
  createdAt: string;
  contactInfo: ContactInfo[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isNewUser: boolean;
  user: UserCompat | null;
  convexUser: ConvexUser | null;
  provider: null;
  role: UserRole | null;
  signIn: () => void;
  signOut: () => void;
  setRole: (role: UserRole) => void;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated: convexAuthenticated, isLoading: convexLoading } =
    useConvexAuth();

  const convexUser = useQuery(
    api.users.getCurrentUser,
    convexAuthenticated ? {} : "skip",
  );

  const createOrGetUser = useMutation(api.users.createOrGetUser);
  const completeOnboardingMutation = useMutation(api.users.completeOnboarding);

  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const creationTriggeredRef = useRef(false);

  // When Convex is authenticated but there's no DB record yet, create one.
  useEffect(() => {
    if (
      convexAuthenticated &&
      convexUser === null &&
      !creationTriggeredRef.current
    ) {
      creationTriggeredRef.current = true;
      const storedRole = (typeof window !== "undefined"
        ? sessionStorage.getItem("pendingRole")
        : null) as UserRole | null;
      const requestedRole = pendingRole ?? storedRole ?? "student";
      const role = requestedRole === "provider" ? "provider" : "student";
      if (typeof window !== "undefined") sessionStorage.removeItem("pendingRole");
      createOrGetUser({ role }).catch(() => {
        creationTriggeredRef.current = false;
      });
    }
    if (convexUser) {
      creationTriggeredRef.current = false;
    }
  }, [convexAuthenticated, convexUser, pendingRole, createOrGetUser]);

  // If user signed in with a different role than their account (e.g. student selected Provider), show toast and keep actual role.
  const roleMismatchShownRef = useRef(false);
  useEffect(() => {
    if (!convexUser || roleMismatchShownRef.current) return;
    const storedRole = (typeof window !== "undefined"
      ? sessionStorage.getItem("pendingRole")
      : null) as UserRole | null;
    const selectedRole = pendingRole ?? storedRole;
    if (!selectedRole || selectedRole === convexUser.role) return;
    roleMismatchShownRef.current = true;
    const actual =
      convexUser.role === "student"
        ? "Student"
        : convexUser.role === "provider"
        ? "Provider"
        : "Admin";
    toast.error(`You're registered as a ${actual}. Please sign in with the correct account type.`);
    if (typeof window !== "undefined") sessionStorage.setItem("pendingRole", convexUser.role);
  }, [convexUser, pendingRole]);

  const user: UserCompat | null = convexUser
    ? {
        id: convexUser._id,
        _id: convexUser._id,
        email: convexUser.email,
        name: convexUser.name,
        role: convexUser.role as UserRole,
        isVerified: convexUser.isVerified,
        avatarUrl: convexUser.avatarUrl ?? null,
        createdAt: new Date(convexUser._creationTime).toISOString(),
        contactInfo: [],
      }
    : null;

  const role = (convexUser?.role as UserRole | null) ?? null;
  const isNewUser = convexUser ? !convexUser.onboardingComplete : false;

  const isLoading =
    convexLoading ||
    (convexAuthenticated && convexUser === undefined);

  const isAuthenticated = convexAuthenticated && !!convexUser;

  const signIn = useCallback(() => {
    // No-op: sign-in is handled directly via authClient in the UI
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
  }, []);

  const completeOnboarding = useCallback(() => {
    void completeOnboardingMutation().catch(() => {
      toast.error("Failed to complete onboarding. Please try again.");
    });
  }, [completeOnboardingMutation]);

  const setRole = useCallback(
    (newRole: UserRole) => {
      const safeRole = newRole === "provider" ? "provider" : "student";
      setPendingRole(safeRole);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pendingRole", safeRole);
      }
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isNewUser,
        user,
        convexUser: convexUser ?? null,
        provider: null,
        role,
        signIn,
        signOut,
        setRole,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
