"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="p-6 space-y-4">
          {/* Icon + Title */}
          <div className="flex items-start gap-3">
            {variant === "destructive" && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-base leading-tight">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={loading}
              className="min-w-[72px]"
            >
              {cancelLabel}
            </Button>
            <Button
              variant={variant}
              size="sm"
              onClick={onConfirm}
              disabled={loading}
              className={cn("min-w-[72px]", variant !== "destructive" && "bg-primary")}
            >
              {loading ? "Please wait…" : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
