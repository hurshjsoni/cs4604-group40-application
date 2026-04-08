"use client";

import type React from "react";
import { cn } from "@/lib/utils";

type SectionColor = "primary" | "blue" | "purple" | "green" | "red" | "orange" | "yellow";

interface PageHeaderProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  color?: SectionColor;
  action?: React.ReactNode;
  className?: string;
}

const colorMap: Record<SectionColor, { bg: string; icon: string }> = {
  primary: { bg: "bg-primary/10", icon: "text-primary" },
  blue:    { bg: "bg-blue-500/10",   icon: "text-blue-600 dark:text-blue-400" },
  purple:  { bg: "bg-purple-500/10", icon: "text-purple-600 dark:text-purple-400" },
  green:   { bg: "bg-green-500/10",  icon: "text-green-600 dark:text-green-400" },
  red:     { bg: "bg-red-500/10",    icon: "text-red-600 dark:text-red-400" },
  orange:  { bg: "bg-orange-500/10", icon: "text-orange-600 dark:text-orange-400" },
  yellow:  { bg: "bg-yellow-500/10", icon: "text-yellow-600 dark:text-yellow-400" },
};

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  color = "primary",
  action,
  className,
}: PageHeaderProps) {
  const colors = colorMap[color];

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", colors.bg)}>
          <Icon className={cn("h-5 w-5", colors.icon)} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
    </div>
  );
}
