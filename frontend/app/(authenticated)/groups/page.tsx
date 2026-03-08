"use client";

import Link from "next/link";
import { PlusCircle, Building2, Calendar, MapPin, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UsersIcon } from "@/app/components/icons";
import type { GroupWithDetails } from "@/lib/types";
import { PageHeader } from "@/app/components/PageHeader";
import { EmptyState } from "@/app/components/EmptyState";

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

export default function GroupsPage() {
  const groups = useQuery(api.groups.getMyGroups);

  const loading = groups === undefined;

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        icon={MessageSquare}
        title="Roommate Groups"
        subtitle="Coordinate with potential roommates"
        color="green"
        action={
          <Link href="/groups/create">
            <Button size="sm" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              New Group
            </Button>
          </Link>
        }
      />

      {/* Info Card */}
      <Card className="mb-6 border-green-500/20 bg-green-500/5">
        <CardContent className="p-5">
          <h3 className="mb-3 font-semibold text-green-700 dark:text-green-400">
            How Groups Work
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-green-600" />
              Create a group when you find compatible roommates
            </li>
            <li className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              Chat with your group in real-time
            </li>
            <li className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-600" />
              Share and vote on apartment listings together
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Groups List */}
      {!loading && groups.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {(groups as GroupWithDetails[]).map((group) => (
            <GroupCard key={group._id} group={group} />
          ))}
        </div>
      ) : !loading ? (
        <EmptyState
          icon={MessageSquare}
          title="No groups yet"
          description="Create a group when you find compatible roommates through matching or browsing profiles."
          action={
            <Link href="/groups/create">
              <Button size="lg" className="gap-2">
                <PlusCircle className="h-5 w-5" />
                Create Your First Group
              </Button>
            </Link>
          }
        />
      ) : null}
    </div>
  );
}

function GroupCard({ group }: { group: GroupWithDetails }) {
  const status = group.status;

  return (
    <Link href={`/groups/${group._id}`}>
      <Card className="h-full transition-all hover:shadow-lg hover:ring-2 hover:ring-primary/20">
        <CardContent className="p-5">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <h3 className="text-lg font-semibold">{group.name}</h3>
            <Badge className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
          </div>

          {/* Members */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex -space-x-2">
              {group.members.slice(0, 4).map((member) => (
                <div
                  key={member._id}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-primary text-xs font-medium"
                  title={member.user?.name ?? "Member"}
                >
                  {(member.user?.name ?? "?")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {group.members.length} member{group.members.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Info */}
          <div className="space-y-2 text-sm text-muted-foreground">
            {group.targetBudgetMin && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  ${group.targetBudgetMin}–${group.targetBudgetMax}
                </span>
                /mo budget
              </div>
            )}
            <div className="flex items-center gap-4">
              {group.targetLocation && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {group.targetLocation}
                </div>
              )}
              {group.targetMoveIn && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(group.targetMoveIn).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Activity */}
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground border-t border-border pt-4">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              {group.messageCount} message{group.messageCount !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              {group.sharedListingCount} listing{group.sharedListingCount !== 1 ? "s" : ""}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
