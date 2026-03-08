"use client";

import type React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** When true, wraps in a Card. Defaults to true. */
  card?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  card = true,
}: EmptyStateProps) {
  const content = (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", !card && className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-muted-foreground text-sm">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );

  if (!card) return content;

  return (
    <Card className={className}>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}
