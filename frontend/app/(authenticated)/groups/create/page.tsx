"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UsersRound, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

export default function CreateGroupPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const [groupData, setGroupData] = useState({
    name: "",
    targetBudgetMin: "",
    targetBudgetMax: "",
    targetMoveIn: "",
    targetLocation: "",
    notes: "",
  });

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const acceptedMatchUsers = useQuery(api.groups.getAcceptedMatchUsers);
  const createGroup = useMutation(api.groups.create);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const validateBudget = () => {
    const min = Number(groupData.targetBudgetMin);
    const max = Number(groupData.targetBudgetMax);
    if (min && max && max < min) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBudget()) {
      toast.error("Maximum budget must be greater than minimum budget");
      return;
    }
    setIsCreating(true);
    try {
      const groupId = await createGroup({
        name: groupData.name,
        notes: groupData.notes || undefined,
        targetBudgetMin: groupData.targetBudgetMin ? Number(groupData.targetBudgetMin) : undefined,
        targetBudgetMax: groupData.targetBudgetMax ? Number(groupData.targetBudgetMax) : undefined,
        targetMoveIn: groupData.targetMoveIn || undefined,
        targetLocation: groupData.targetLocation || undefined,
        inviteUserIds: selectedUserIds as Id<"users">[],
      });
      toast.success("Group created!");
      router.push(`/groups/${groupId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
          <UsersRound className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Create Group</h1>
          <p className="text-sm text-muted-foreground">Start your housing search together</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Group Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Group Details</CardTitle>
                <CardDescription>Basic info about your group</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="form-group">
                  <Label>Group Name *</Label>
                  <input
                    value={groupData.name}
                    onChange={(e) => setGroupData({ ...groupData, name: e.target.value })}
                    placeholder="Enter group name"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <Label>Notes</Label>
                  <textarea
                    value={groupData.notes}
                    onChange={(e) => setGroupData({ ...groupData, notes: e.target.value })}
                    placeholder="Enter a description or notes for the group"
                    className="form-textarea"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Group Preferences</CardTitle>
                <CardDescription>What the group is looking for</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="form-group">
                  <Label>Budget Range (per person, per month)</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <input
                        type="number"
                        placeholder="Enter min"
                        value={groupData.targetBudgetMin}
                        onChange={(e) =>
                          setGroupData({ ...groupData, targetBudgetMin: e.target.value })
                        }
                        className="form-input pl-7"
                      />
                    </div>
                    <span className="text-muted-foreground font-medium">to</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <input
                        type="number"
                        placeholder="Enter max"
                        value={groupData.targetBudgetMax}
                        onChange={(e) =>
                          setGroupData({ ...groupData, targetBudgetMax: e.target.value })
                        }
                        className="form-input pl-7"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <Label>Target Move-in Date</Label>
                  <input
                    type="date"
                    value={groupData.targetMoveIn}
                    onChange={(e) => setGroupData({ ...groupData, targetMoveIn: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <Label>Preferred Location</Label>
                  <input
                    value={groupData.targetLocation}
                    onChange={(e) =>
                      setGroupData({ ...groupData, targetLocation: e.target.value })
                    }
                    placeholder="Enter preferred location or neighborhood"
                    className="form-input"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Invite Members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invite Members</CardTitle>
                <CardDescription>Add roommates from your accepted matches</CardDescription>
              </CardHeader>
              <CardContent>
                {acceptedMatchUsers === undefined ? (
                  <p className="text-sm text-muted-foreground">Loading connections...</p>
                ) : acceptedMatchUsers.length > 0 ? (
                  <div className="space-y-3">
                    {acceptedMatchUsers.map(({ matchId, user, compatibilityScore }) => {
                      if (!user) return null;
                      const isSelected = selectedUserIds.includes(user._id);
                      return (
                        <button
                          key={matchId}
                          type="button"
                          onClick={() => toggleUser(user._id)}
                          className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
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
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "border-2 border-muted"
                            }`}
                          >
                            {isSelected && <Check className="h-4 w-4" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center">
                    <p className="mb-2 text-muted-foreground">No accepted matches yet</p>
                    <p className="text-sm text-muted-foreground">
                      Accept roommate matches first, then invite them to your group
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Group Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <h3 className="font-semibold">{groupData.name || "Untitled Group"}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedUserIds.length + 1} member{selectedUserIds.length + 1 !== 1 ? "s" : ""}
                </p>

                <div className="space-y-2 text-sm">
                  {selectedUserIds.map((uid) => {
                    const match = acceptedMatchUsers?.find((m) => m.user?._id === uid);
                    if (!match?.user) return null;
                    return (
                      <div key={uid} className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {(match.user.name ?? "?")
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </div>
                        <span>{match.user.name}</span>
                      </div>
                    );
                  })}
                </div>

                {selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selectedUserIds.map((uid) => {
                      const match = acceptedMatchUsers?.find((m) => m.user?._id === uid);
                      return (
                        <Badge key={uid} variant="secondary" className="text-xs">
                          {match?.user?.name?.split(" ")[0] ?? uid}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={!groupData.name || isCreating}
            >
              {isCreating ? (
                "Creating..."
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Create Group
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
