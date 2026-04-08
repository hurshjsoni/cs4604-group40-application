"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "fake_profile", label: "Fake or misleading profile" },
  { value: "spam", label: "Spam or scam" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "misleading_listing", label: "Misleading listing information" },
  { value: "other", label: "Other" },
];

interface ReportModalProps {
  targetType: "user" | "listing";
  targetId: string;
  targetName?: string;
  onClose: () => void;
}

export function ReportModal({ targetType, targetId, targetName, onClose }: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createReport = useMutation(api.reports.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }
    setIsSubmitting(true);
    try {
      const canonicalTargetId = `${targetType}:${targetId}`;
      await createReport({ targetType, targetId: canonicalTargetId, reason, description: description || undefined });
      toast.success("Report submitted. Thank you for helping keep the community safe.");
      onClose();
    } catch {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            <h2 className="font-semibold">
              Report {targetType === "user" ? "User" : "Listing"}
              {targetName ? `: ${targetName}` : ""}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Reason for report</label>
            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Additional details <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional context..."
              rows={3}
              className="form-textarea w-full"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Reports are reviewed by our team and kept confidential. Abuse of the report system may result in account suspension.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
