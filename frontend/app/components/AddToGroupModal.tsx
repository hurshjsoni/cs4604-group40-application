"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Loader2, UserPlus, PlusCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { GroupWithDetails } from "@/lib/types";

interface AddToGroupModalProps {
  targetUserId: string;
  targetName: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  searching: "Searching",
  found_place: "Found Place",
  confirmed: "Confirmed",
  disbanded: "Disbanded",
};

export function AddToGroupModal({ targetUserId, targetName, onClose }: AddToGroupModalProps) {
  const myGroups = useQuery(api.groups.getMyGroups);
  const inviteMembers = useMutation(api.groups.inviteMembers);
  const [adding, setAdding] = useState<string | null>(null);
  const groups = (myGroups ?? []) as GroupWithDetails[];

  const handleAdd = async (groupId: string) => {
    setAdding(groupId);
    try {
      await inviteMembers({
        groupId: groupId as Id<"roommateGroups">,
        userIds: [targetUserId as Id<"users">],
      });
      toast.success(`Added ${targetName} to the group`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add to group");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet on mobile, centred card on desktop */}
      <Card className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="font-semibold text-base">Add to Group</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick a group or start a new one
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {myGroups === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {groups.length > 0 && (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <button
                      key={group._id}
                      onClick={() => handleAdd(group._id)}
                      disabled={!!adding}
                      className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-60"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{group.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.members?.length ?? 0} member{(group.members?.length ?? 0) !== 1 ? "s" : ""}
                          {" · "}
                          {STATUS_LABELS[group.status] ?? group.status}
                        </p>
                      </div>
                      {adding === group._id ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0 ml-3 text-muted-foreground" />
                      ) : (
                        <UserPlus className="h-4 w-4 shrink-0 ml-3 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <Link
                href="/groups/create"
                onClick={onClose}
                className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-foreground"
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                Create new group with {targetName.split(" ")[0]}
              </Link>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
