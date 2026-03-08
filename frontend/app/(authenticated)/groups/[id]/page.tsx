"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  UserPlus,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Settings,
  Send,
  MessageCircle,
  X,
  Check,
  Search,
  Loader2,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { UsersIcon } from "@/app/components/icons";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import type { GroupWithDetails, GroupMemberWithUser, ApartmentListing } from "@/lib/types";

type Tab = "chat" | "listings" | "members";
type Modal = "settings" | "share" | "invite" | null;

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [newMessage, setNewMessage] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [isSending, setIsSending] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const groupId = id as Id<"roommateGroups">;

  const group = useQuery(api.groups.getById, { groupId });
  const {
    results: messagesDesc,
    status: messageStatus,
    loadMore,
  } = usePaginatedQuery(api.groupMessages.getByGroup, { groupId }, { initialNumItems: 50 });
  // Messages come newest-first from the paginated query; reverse for chronological display
  const messages = [...messagesDesc].reverse();
  const sharedListings = useQuery(api.groupSharedListings.getByGroup, { groupId });
  const sendMessage = useMutation(api.groupMessages.send);
  const leaveGroup = useMutation(api.groups.leaveGroup);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesDesc.length]);

  if (group === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (group === null) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
        <h2 className="mb-4 text-xl font-bold">Group Not Found</h2>
        <Link href="/groups">
          <Button size="lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Groups
          </Button>
        </Link>
      </div>
    );
  }

  const currentMember = (group as GroupWithDetails).members.find((m) => m.userId === user?._id);
  const isAdmin = currentMember?.role === "admin";

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    setIsSending(true);
    const content = newMessage;
    setNewMessage("");
    try {
      await sendMessage({ groupId, content });
    } catch {
      toast.error("Failed to send message");
      setNewMessage(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    try {
      await leaveGroup({ groupId });
      toast.success("Left the group");
      router.push("/groups");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to leave group");
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const statusColors = {
    searching: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    found_place: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    confirmed: "bg-green-500/10 text-green-600 dark:text-green-400",
    disbanded: "bg-muted text-muted-foreground",
  } as const;

  const statusLabels = {
    searching: "Searching",
    found_place: "Found Place",
    confirmed: "Confirmed",
    disbanded: "Disbanded",
  } as const;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-screen">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-3 lg:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
            <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">{group.name}</h1>
              <Badge className={statusColors[group.status as keyof typeof statusColors]}>
                {statusLabels[group.status as keyof typeof statusLabels]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {group.members.length} member{group.members.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setModal("settings")}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-red-600 hover:bg-red-500/10 hover:text-red-600"
            onClick={() => setShowLeaveConfirm(true)}
          >
            <LogOut className="h-4 w-4" />
            Leave
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-4 pt-3 pb-0 lg:px-6">
      <div className="mb-3 flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
            activeTab === "chat" ? "bg-card shadow-sm" : "text-muted-foreground"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab("listings")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
            activeTab === "listings" ? "bg-card shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Listings ({sharedListings?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("members")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
            activeTab === "members" ? "bg-card shadow-sm" : "text-muted-foreground"
          }`}
        >
          <UsersIcon className="h-4 w-4" />
          Members
        </button>
      </div>
      </div>

      {/* Tab content - fills remaining height and scrolls independently */}
      <div className="min-h-0 flex-1 overflow-hidden">

      {/* Chat Tab */}
      {activeTab === "chat" && (
        <div className="flex h-full flex-col">
          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 lg:px-6">
            {messageStatus === "LoadingFirstPage" ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-3 pb-2">
                {messageStatus !== "Exhausted" && (
                  <div className="flex justify-center pb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => loadMore(50)}
                      disabled={messageStatus === "LoadingMore"}
                    >
                      {messageStatus === "LoadingMore" ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Load older messages
                    </Button>
                  </div>
                )}
                {messages.map((msg) => {
                  const isSystem = msg.messageType === "system";
                  const isOwn = msg.senderId === user?._id;

                  if (isSystem) {
                    return (
                      <div key={msg._id} className="flex justify-center">
                        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg._id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`flex max-w-[85%] sm:max-w-[70%] gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
                        {/* Avatar - hidden on very small screens to save space */}
                        <div className="hidden xs:flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {(msg.sender?.name ?? "?")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`flex items-center gap-1.5 mb-1 ${isOwn ? "justify-end" : ""}`}
                          >
                            <span className="text-xs font-medium truncate max-w-[120px]">
                              {isOwn ? "You" : (msg.sender?.name ?? "Unknown")}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(msg._creationTime).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div
                            className={`rounded-2xl px-3 py-2 text-sm break-words ${
                              isOwn
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-card border border-border rounded-tl-sm"
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <MessageCircle className="mb-2 h-10 w-10" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Start the conversation!</p>
              </div>
            )}
          </div>

          {/* Message input - sticks to bottom */}
          <div className="shrink-0 border-t border-border bg-background px-4 py-3 lg:px-6">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                placeholder="Message…"
                className="form-input flex-1 min-w-0"
                disabled={isSending}
              />
              {/* h-10 matches form-input height exactly */}
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Listings Tab */}
      {activeTab === "listings" && (
        <div className="h-full overflow-y-auto px-4 py-3 lg:px-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Shared Listings</h2>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setModal("share")}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>

          {sharedListings === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sharedListings.length > 0 ? (
            <div className="space-y-3 pb-4">
              {sharedListings.map((shared) => (
                <SharedListingCard
                  key={shared._id}
                  shared={shared}
                  currentUserId={user?._id}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="mb-2 font-medium">No listings shared yet</p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Share apartments you find interesting with the group
                </p>
                <Button size="default" onClick={() => setModal("share")}>
                  Browse Apartments
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="h-full overflow-y-auto px-4 py-3 lg:px-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Members ({group.members.length})</h2>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setModal("invite")}
              >
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
            )}
          </div>

          <div className="space-y-3 pb-4">
            {(group as GroupWithDetails).members.map((member: GroupMemberWithUser) => (
              <Card key={member._id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
                      {(member.user?.name ?? "?")
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{member.user?.name ?? "Unknown"}</span>
                        {member.role === "admin" && (
                          <Badge variant="secondary" className="text-xs">Admin</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Group Info */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Group Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {group.targetBudgetMin && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-medium">
                    ${group.targetBudgetMin} – ${group.targetBudgetMax}/mo
                  </span>
                </div>
              )}
              {group.targetMoveIn && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Move-in</span>
                  <span className="font-medium">
                    {new Date(group.targetMoveIn).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {group.targetLocation && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">{group.targetLocation}</span>
                </div>
              )}
              {group.notes && (
                <>
                  <Separator />
                  <p className="text-muted-foreground">{group.notes}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      </div>{/* end tab content wrapper */}

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden">
            {modal === "settings" && (
              <SettingsModal group={group} onClose={() => setModal(null)} />
            )}
            {modal === "share" && (
              <ShareListingModal
                groupId={groupId}
                onClose={() => setModal(null)}
              />
            )}
            {modal === "invite" && (
              <InviteModal groupId={groupId} onClose={() => setModal(null)} />
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={showLeaveConfirm}
        title="Leave group?"
        description={`You'll be removed from "${group.name}". You can be re-invited later.`}
        confirmLabel="Leave"
        loading={isLeaving}
        onConfirm={handleLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
}

// ─── Settings Modal ─────────────────────────────────────────────────────────

function SettingsModal({ group, onClose }: { group: GroupWithDetails; onClose: () => void }) {
  const updateSettings = useMutation(api.groups.updateSettings);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    name: group.name,
    targetBudgetMin: group.targetBudgetMin?.toString() ?? "",
    targetBudgetMax: group.targetBudgetMax?.toString() ?? "",
    targetMoveIn: group.targetMoveIn ?? "",
    targetLocation: group.targetLocation ?? "",
    notes: group.notes ?? "",
    status: group.status as string,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        groupId: group._id as Id<"roommateGroups">,
        name: settings.name,
        notes: settings.notes || undefined,
        targetBudgetMin: settings.targetBudgetMin ? Number(settings.targetBudgetMin) : undefined,
        targetBudgetMax: settings.targetBudgetMax ? Number(settings.targetBudgetMax) : undefined,
        targetMoveIn: settings.targetMoveIn || undefined,
        targetLocation: settings.targetLocation || undefined,
        status: settings.status as "searching" | "found_place" | "confirmed" | "disbanded",
      });
      toast.success("Group settings saved");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Group Settings</CardTitle>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4 overflow-y-auto">
        <div className="form-group">
          <Label>Group Name</Label>
          <input
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <Label>Status</Label>
          <select
            value={settings.status}
            onChange={(e) => setSettings({ ...settings, status: e.target.value })}
            className="form-input"
          >
            <option value="searching">Searching</option>
            <option value="found_place">Found Place</option>
            <option value="confirmed">Confirmed</option>
            <option value="disbanded">Disbanded</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="form-group">
            <Label>Budget Min ($)</Label>
            <input
              type="number"
              value={settings.targetBudgetMin}
              onChange={(e) => setSettings({ ...settings, targetBudgetMin: e.target.value })}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <Label>Budget Max ($)</Label>
            <input
              type="number"
              value={settings.targetBudgetMax}
              onChange={(e) => setSettings({ ...settings, targetBudgetMax: e.target.value })}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <Label>Target Move-in</Label>
          <input
            type="date"
            value={settings.targetMoveIn}
            onChange={(e) => setSettings({ ...settings, targetMoveIn: e.target.value })}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <Label>Location</Label>
          <input
            value={settings.targetLocation}
            onChange={(e) => setSettings({ ...settings, targetLocation: e.target.value })}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <Label>Notes</Label>
          <textarea
            value={settings.notes}
            onChange={(e) => setSettings({ ...settings, notes: e.target.value })}
            className="form-textarea"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="default" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button size="default" onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </>
  );
}

// ─── Share Listing Modal ─────────────────────────────────────────────────────

function ShareListingModal({
  groupId,
  onClose,
}: {
  groupId: Id<"roommateGroups">;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sharing, setSharing] = useState<string | null>(null);
  const allListings = useQuery(api.apartmentListings.searchActive, {
    search: search.trim() || undefined,
    limit: 40,
  });
  const shareListing = useMutation(api.groupSharedListings.share);
  const filtered = (allListings ?? []) as ApartmentListing[];

  const handleShare = async (listingId: string) => {
    setSharing(listingId);
    try {
      await shareListing({
        groupId,
        listingId: listingId as Id<"apartmentListings">,
      });
      toast.success("Listing shared with the group");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to share listing");
    } finally {
      setSharing(null);
    }
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Share a Listing</CardTitle>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or city"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10"
          />
        </div>

        {allListings === undefined ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[320px] space-y-2 overflow-y-auto">
            {filtered.slice(0, 8).map((listing) => (
              <button
                key={listing._id}
                onClick={() => handleShare(listing._id)}
                disabled={sharing === listing._id}
                className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted disabled:opacity-60"
              >
                {listing.images?.[0] ? (
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="h-12 w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-12 w-16 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{listing.title}</p>
                  <p className="text-sm text-muted-foreground">
                    ${listing.rent}/mo · {listing.city}
                  </p>
                </div>
                {sharing === listing._id && (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No listings found</p>
            )}
          </div>
        )}
      </CardContent>
    </>
  );
}

// ─── Invite Modal ────────────────────────────────────────────────────────────

function InviteModal({
  groupId,
  onClose,
}: {
  groupId: Id<"roommateGroups">;
  onClose: () => void;
}) {
  const acceptedMatchUsers = useQuery(api.groups.getAcceptedMatchUsers);
  const inviteMembers = useMutation(api.groups.inviteMembers);
  const [selected, setSelected] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  const toggle = (uid: string) =>
    setSelected((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));

  const handleInvite = async () => {
    if (selected.length === 0) return;
    setInviting(true);
    try {
      await inviteMembers({ groupId, userIds: selected as Id<"users">[] });
      toast.success(`Invited ${selected.length} member${selected.length > 1 ? "s" : ""}`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Invite Members</CardTitle>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {acceptedMatchUsers === undefined ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : acceptedMatchUsers.length > 0 ? (
          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {acceptedMatchUsers.map(({ matchId, user, compatibilityScore }) => {
              if (!user) return null;
              const isSelected = selected.includes(user._id);
              return (
                <button
                  key={matchId}
                  type="button"
                  onClick={() => toggle(user._id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                    {(user.name ?? "?")
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {parseFloat(compatibilityScore.toFixed(2))}% match
                    </p>
                  </div>
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      isSelected ? "bg-primary text-primary-foreground" : "border-2 border-muted"
                    }`}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p className="mb-2">No accepted matches to invite</p>
            <p className="text-sm">Accept roommate matches first</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="default" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            size="default"
            onClick={handleInvite}
            disabled={selected.length === 0 || inviting}
            className="flex-1"
          >
            {inviting ? "Inviting..." : `Invite${selected.length > 0 ? ` (${selected.length})` : ""}`}
          </Button>
        </div>
      </CardContent>
    </>
  );
}

// ─── Shared Listing Card ─────────────────────────────────────────────────────

type VoteRecord = { userId: string; vote: "interested" | "neutral" | "not_interested"; comment?: string };
type SharedListingResolved = {
  _id: Id<"groupSharedListings">;
  listingId: Id<"apartmentListings">;
  listing: ({ images: string[]; title?: string; rent?: number; city?: string } & Record<string, unknown>) | null;
  sharedByUser?: { name?: string } | null;
  votes: VoteRecord[];
  status: "proposed" | "shortlisted" | "rejected";
  notes?: string;
};

function SharedListingCard({
  shared,
  currentUserId,
  isAdmin,
}: {
  shared: SharedListingResolved;
  currentUserId?: string;
  isAdmin: boolean;
}) {
  const castVote = useMutation(api.groupSharedListings.vote);
  const updateStatus = useMutation(api.groupSharedListings.updateStatus);

  const currentVote = shared.votes.find((v) => v.userId === currentUserId);
  const interestedCount = shared.votes.filter((v) => v.vote === "interested").length;
  const neutralCount = shared.votes.filter((v) => v.vote === "neutral").length;
  const notInterestedCount = shared.votes.filter((v) => v.vote === "not_interested").length;

  const statusColors = {
    proposed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    shortlisted: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
  } as const;

  const handleVote = async (vote: "interested" | "neutral" | "not_interested") => {
    try {
      await castVote({ sharedListingId: shared._id, vote });
    } catch {
      toast.error("Failed to record vote");
    }
  };

  const handleStatusChange = async (status: "proposed" | "shortlisted" | "rejected") => {
    try {
      await updateStatus({ sharedListingId: shared._id, status });
      toast.success("Status updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <Link href={`/apartments/${shared.listingId}`}>
            {shared.listing?.images?.[0] ? (
              <img
                src={shared.listing.images[0]}
                alt={shared.listing?.title}
                className="h-24 w-32 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="h-24 w-32 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-start justify-between gap-2">
              <Link href={`/apartments/${shared.listingId}`}>
                <h3 className="font-medium hover:underline">
                  {shared.listing?.title ?? "Listing"}
                </h3>
              </Link>
              <Badge className={statusColors[shared.status as keyof typeof statusColors]}>
                {shared.status.charAt(0).toUpperCase() + shared.status.slice(1)}
              </Badge>
            </div>

            <p className="mb-1 text-sm text-muted-foreground">
              ${shared.listing?.rent}/mo · {shared.listing?.city}
            </p>

            <p className="mb-3 text-xs text-muted-foreground">
              Shared by {shared.sharedByUser?.name ?? "someone"}
            </p>

            {/* Vote buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVote("interested")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  currentVote?.vote === "interested"
                    ? "bg-green-500/20 text-green-700"
                    : "bg-muted text-muted-foreground hover:bg-green-500/10 hover:text-green-700"
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                {interestedCount}
              </button>
              <button
                onClick={() => handleVote("neutral")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  currentVote?.vote === "neutral"
                    ? "bg-yellow-500/20 text-yellow-700"
                    : "bg-muted text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-700"
                }`}
              >
                <Minus className="h-3.5 w-3.5" />
                {neutralCount}
              </button>
              <button
                onClick={() => handleVote("not_interested")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  currentVote?.vote === "not_interested"
                    ? "bg-red-500/20 text-red-700"
                    : "bg-muted text-muted-foreground hover:bg-red-500/10 hover:text-red-700"
                }`}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                {notInterestedCount}
              </button>

              {isAdmin && (
                <select
                  value={shared.status}
                  onChange={(e) =>
                    handleStatusChange(e.target.value as "proposed" | "shortlisted" | "rejected")
                  }
                  className="ml-auto rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="proposed">Proposed</option>
                  <option value="shortlisted">Shortlist</option>
                  <option value="rejected">Reject</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
