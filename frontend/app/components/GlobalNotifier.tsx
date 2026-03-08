"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Renders nothing - subscribes to Convex queries and fires toast
 * notifications for:
 *  • new incoming connection requests (with an Accept action button)
 *  • new messages in any group the user belongs to (via messageCount change)
 */
export function GlobalNotifier() {
  const router = useRouter();
  const { user } = useAuth();

  const incomingRequestsRaw = useQuery(api.roommateMatches.getIncomingRequests);
  const myGroupsRaw = useQuery(api.groups.getMyGroups);

  const incomingRequests = Array.isArray(incomingRequestsRaw) ? incomingRequestsRaw : [];
  const myGroups = Array.isArray(myGroupsRaw) ? myGroupsRaw : [];

  const respondMut = useMutation(api.roommateMatches.respondToRequest);

  // --- connection request toasts ---
  const seenConnectionIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const pending = incomingRequests.filter(
      (r) => r != null && (r as { status?: string }).status === "pending",
    );
    if (pending.length === 0) return;

    const newReqs = pending.filter((r) => !seenConnectionIds.current.has((r as { _id: string })._id));

    if (seenConnectionIds.current.size > 0 && newReqs.length > 0) {
      newReqs.forEach((req) => {
        const typedReq = req as { _id: string; sender?: { name?: string } };
        const name = typedReq.sender?.name ?? "Someone";
        toast(`${name} wants to connect!`, {
          action: {
            label: "Accept",
            onClick: async () => {
              try {
                await respondMut({ matchId: typedReq._id as Parameters<typeof respondMut>[0]["matchId"], status: "accepted" });
                toast.success(`Connected with ${name}`);
              } catch {
                toast.error("Failed to accept request");
              }
            },
          },
        });
      });
    }

    pending.forEach((r) => seenConnectionIds.current.add((r as { _id: string })._id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingRequests]);

  // --- new message toasts ---
  // Track the last seen text-message ID per group.
  const groupLatestTextIds = useRef<Record<string, string | null>>({});
  const initializedGroups = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (myGroups.length === 0) return;

    myGroups.forEach((group) => {
      const typedGroup = group as {
        _id: string;
        name?: string;
        latestTextMessage?: { id: string; senderId: string } | null;
      };
      const id: string = typedGroup._id;
      const latest = typedGroup.latestTextMessage ?? null;
      const latestId = latest?.id ?? null;

      if (!initializedGroups.current.has(id)) {
        // First time we see this group - baseline only.
        groupLatestTextIds.current[id] = latestId;
        initializedGroups.current.add(id);
        return;
      }

      const prevId = groupLatestTextIds.current[id] ?? null;
      groupLatestTextIds.current[id] = latestId;
      if (latestId && latestId !== prevId) {
        // Only notify for messages from others (skip own sends).
        if (latest?.senderId === user?._id) return;
        const groupName = typedGroup.name ?? "your group";
        toast(`New message in ${groupName}`, {
          action: {
            label: "View",
            onClick: () => router.push(`/groups/${id}`),
          },
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGroups, user?._id]);

  return null;
}
