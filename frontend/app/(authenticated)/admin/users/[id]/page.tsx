"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/app/components/PageHeader";

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const detail = useQuery(
    api.admin.getUserDetail,
    user?.role === "admin" ? { userId: id as Id<"users"> } : "skip",
  );

  if (user?.role !== "admin") {
    return (
      <div className="p-4 lg:p-6">
        <p className="text-sm text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  if (detail === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="p-4 lg:p-6">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin Dashboard
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">User not found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        icon={Shield}
        title={detail.user.name}
        subtitle={`Admin view for ${detail.user.email}`}
        color="primary"
        className="mb-6"
      />

      <button
        onClick={() => router.push("/dashboard")}
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin Dashboard
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Row label="Name" value={detail.user.name} />
              <Row label="Role" value={detail.user.role} />
              <Row label="Email" value={detail.user.email} />
              <Row label="Verified" value={detail.user.isVerified ? "Yes" : "No"} />
            </CardContent>
          </Card>

          {detail.roommateProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Roommate Profile (Full Admin View)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{detail.roommateProfile.bio || "No bio provided."}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    Budget ${detail.roommateProfile.budgetMin ?? "?"}-${detail.roommateProfile.budgetMax ?? "?"}
                  </Badge>
                  <Badge variant="secondary">
                    Active: {detail.roommateProfile.isActive ? "Yes" : "No"}
                  </Badge>
                  <Badge variant="secondary">
                    College: {detail.roommateProfile.college?.shortName ?? "N/A"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {detail.providerProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Provider Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Row label="Company" value={detail.providerProfile.companyName} />
                <Row label="Verified" value={detail.providerProfile.verified ? "Yes" : "No"} />
                <Row label="Listings" value={String(detail.providerProfile.listings.length)} />
                <div className="space-y-1">
                  {detail.providerProfile.listings.slice(0, 8).map((listing) => (
                    <Link key={listing._id} href={`/apartments/${listing._id}`} className="block text-sm text-primary hover:underline">
                      {listing.title}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {detail.studentProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Student Profile</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Row label="Major" value={detail.studentProfile.major ?? "N/A"} />
                <Row label="Graduation Year" value={String(detail.studentProfile.graduationYear ?? "N/A")} />
                <Row label="College" value={detail.studentProfile.college?.name ?? "N/A"} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="Matches" value={String(detail.stats.matches)} />
              <Row label="Listings" value={String(detail.stats.listings)} />
              <Row label="Reports by User" value={String(detail.stats.reportsByUser)} />
              <Row label="Reports Against User" value={String(detail.stats.reportsAgainstUser)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Info (Admin)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contact records.</p>
              ) : (
                detail.contacts.map((contact) => (
                  <div key={contact._id} className="rounded-md border border-border p-2 text-sm">
                    <p className="font-medium">{contact.type}</p>
                    <p className="text-muted-foreground">{contact.value}</p>
                    <p className="text-xs text-muted-foreground">Public: {contact.isPublic ? "Yes" : "No"}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
