"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  Heart,
  LogOut,
  UserCircle,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { VerifiedBadge } from "./VerifiedBadge";
import { LogoIcon, UsersIcon } from "./icons";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const STUDENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/apartments", label: "Apartments", icon: Building2 },
  { href: "/roommates", label: "Matches", icon: UsersIcon },
  { href: "/groups", label: "Groups", icon: MessageSquare },
  { href: "/saved", label: "Saved", icon: Heart },
];

const PROVIDER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/my-listings", label: "My Listings", icon: Building2 },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Admin Dashboard", icon: Shield },
];

const BOTTOM_NAV: NavItem[] = [
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const desktopSidebarRef = useRef<HTMLElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);

  const isProvider = user?.role === "provider";
  const isAdmin = user?.role === "admin";
  const roommateProfile = useQuery(
    api.roommateProfiles.getMyProfile,
    !isProvider && !isAdmin ? {} : "skip",
  );
  const isLookingForRoommates = !isProvider && !isAdmin && (roommateProfile?.isActive ?? true);

  const navItems = isAdmin
    ? ADMIN_NAV
    : isProvider
    ? PROVIDER_NAV
    : STUDENT_NAV.filter((item) => {
        if (!isLookingForRoommates && (item.href === "/roommates" || item.href === "/groups")) {
          return false;
        }
        return true;
      });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        expanded &&
        desktopSidebarRef.current &&
        !desktopSidebarRef.current.contains(event.target as Node)
      ) {
        setExpanded(false);
      }
      if (
        mobileOpen &&
        mobileSidebarRef.current &&
        !mobileSidebarRef.current.contains(event.target as Node) &&
        !(event.target as Element)?.closest("[data-mobile-toggle]")
      ) {
        setMobileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded, mobileOpen]);

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
      return;
    }
    if (theme === "dark") {
      setTheme("system");
      return;
    }
    setTheme("light");
  };

  const NavLink = ({ item, showLabel }: { item: NavItem; showLabel: boolean }) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        title={!showLabel ? item.label : undefined}
      >
        <div
          className={cn(
            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            !showLabel && "justify-center px-2",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {showLabel && <span className="truncate">{item.label}</span>}
          {showLabel && item.badge && (
            <span
              className={cn(
                "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold",
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {item.badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        ref={desktopSidebarRef}
        id="desktop-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-background transition-all duration-200 lg:flex",
          expanded ? "w-56" : "w-14",
        )}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute -right-3 top-14 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted"
        >
          {expanded ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        <div className={cn("flex items-center gap-2 border-b border-border px-3 py-3", !expanded && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-primary">
            <LogoIcon className="h-4 w-4 text-primary" />
          </div>
          {expanded && <span className="text-sm font-semibold">A&R Finder</span>}
        </div>

        {expanded && (
          <div className="border-b border-border px-3 py-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {isAdmin ? "Admin" : isProvider ? "Provider" : "Student"}
                  </span>
                  {!isProvider && !isAdmin && user?.isVerified && (
                    <VerifiedBadge showText={false} type="edu" className="h-3" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} showLabel={expanded} />
          ))}
        </nav>

        <div className={cn("border-t border-border px-2 py-3", !expanded && "flex justify-center")}>
          {expanded ? (
            <div className="flex items-center justify-between gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-all",
                  theme === "light" ? "bg-card shadow-sm" : "hover:bg-card/50",
                )}
              >
                <Sun className="h-3 w-3" />
                Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-all",
                  theme === "dark" ? "bg-card shadow-sm" : "hover:bg-card/50",
                )}
              >
                <Moon className="h-3 w-3" />
                Dark
              </button>
              <button
                onClick={() => setTheme("system")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-all",
                  theme === "system" ? "bg-card shadow-sm" : "hover:bg-card/50",
                )}
              >
                <Monitor className="h-3 w-3" />
                System
              </button>
            </div>
          ) : (
            <button
              onClick={cycleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              title={`Theme: ${theme}`}
            >
              {theme === "system" ? (
                <Monitor className="h-4 w-4" />
              ) : resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        <nav className="border-t border-border px-2 py-3">
          <div className="space-y-1">
            {BOTTOM_NAV.map((item) => (
              <NavLink key={item.href} item={item} showLabel={expanded} />
            ))}
            <button
              onClick={signOut}
              title={!expanded ? "Log Out" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive",
                !expanded && "justify-center px-2",
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {expanded && <span>Log Out</span>}
            </button>
          </div>
        </nav>
      </aside>

      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(!mobileOpen)} data-mobile-toggle>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-primary">
            <LogoIcon className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold">A&R Finder</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar Panel */}
      <aside
        ref={mobileSidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-background transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-primary">
              <LogoIcon className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold">A&R Finder</span>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
              {initials}
            </div>
            <div>
              <p className="font-medium">{user?.name}</p>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {isAdmin ? "Admin" : isProvider ? "Provider" : "Student"}
                </span>
                {!isProvider && !isAdmin && user?.isVerified && <VerifiedBadge showText={false} />}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} showLabel={true} />
          ))}
        </nav>

        <div className="border-t border-border px-3 py-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Theme</p>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme("light")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm transition-all",
                theme === "light" ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm transition-all",
                theme === "dark" ? "border-primary bg-primary/5" : "border-border",
              )}
            >
                <Moon className="h-4 w-4" />
                Dark
              </button>
            <button
              onClick={() => setTheme("system")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm transition-all",
                theme === "system" ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <Monitor className="h-4 w-4" />
              System
            </button>
          </div>
        </div>

        <nav className="border-t border-border px-3 py-3">
          {BOTTOM_NAV.map((item) => (
            <NavLink key={item.href} item={item} showLabel={true} />
          ))}
          <button
            onClick={() => {
              signOut();
              setMobileOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </nav>
      </aside>
    </>
  );
}
