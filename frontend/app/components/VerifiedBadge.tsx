"use client";

import { CheckCircle2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  /** Kept for API compatibility - edu type always shows text now */
  showText?: boolean;
  type?: "edu" | "business";
  className?: string;
}

export function VerifiedBadge({ showText = true, type = "edu", className }: VerifiedBadgeProps) {
  if (type === "business") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
          "bg-blue-500/10 text-blue-600 dark:text-blue-400",
          className,
        )}
        title="Verified provider"
      >
        <Shield className="h-3 w-3 shrink-0" />
        {showText && "Verified"}
      </span>
    );
  }

  // edu - always show ".edu verified" as a small tag
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
        "bg-green-500/10 text-green-600 dark:text-green-400",
        className,
      )}
      title=".edu email verified"
    >
      <CheckCircle2 className="h-3 w-3 shrink-0" />
      .edu verified
    </span>
  );
}
