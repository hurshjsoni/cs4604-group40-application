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

function readPendingRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem("pendingRole");
  if (value === "student" || value === "provider" || value === "admin") {
    return value;
  }
  return null;
}

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
      const storedRole = readPendingRole();
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

  // Enforce role-aware sign-in: valid credentials are not enough if the selected role is wrong.
  const roleMismatchSignOutRef = useRef(false);
  useEffect(() => {
    if (!convexUser) return;
    const storedRole = readPendingRole();
    const selectedRole = pendingRole ?? storedRole;
    if (!selectedRole || selectedRole === convexUser.role || roleMismatchSignOutRef.current) return;
    roleMismatchSignOutRef.current = true;
    toast.error("Please select the correct role for this account.");
    // Explicitly terminate the valid auth session when role selection is wrong
    // so protected routes never load under a mismatched role choice.
    void authClient
      .signOut()
      .finally(() => {
        setPendingRole(null);
        if (typeof window !== "undefined") sessionStorage.removeItem("pendingRole");
        roleMismatchSignOutRef.current = false;
      });
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

  const selectedRole = pendingRole ?? readPendingRole();
  const hasRoleMismatch = !!convexUser && !!selectedRole && selectedRole !== convexUser.role;
  const isAuthenticated = convexAuthenticated && !!convexUser && !hasRoleMismatch;

  const signIn = useCallback(() => {
    // No-op: sign-in is handled directly via authClient in the UI
  }, []);

  const signOut = useCallback(async () => {
    setPendingRole(null);
    if (typeof window !== "undefined") sessionStorage.removeItem("pendingRole");
    await authClient.signOut();
  }, []);

  const completeOnboarding = useCallback(() => {
    void completeOnboardingMutation().catch(() => {
      toast.error("Failed to complete onboarding. Please try again.");
    });
  }, [completeOnboardingMutation]);

  const setRole = useCallback(
    (newRole: UserRole) => {
      setPendingRole(newRole);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pendingRole", newRole);
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
