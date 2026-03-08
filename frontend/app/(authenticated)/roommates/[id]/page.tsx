"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RoommateProfileView } from "../../../components/RoommateProfileView";
import { toast } from "sonner";

export default function RoommateProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromTab = searchParams.get("from") === "browse" ? "browse" : "smart";

  const profile = useQuery(api.roommateProfiles.getByUser, {
    userId: id as Id<"users">,
  });

  const connectionStatus = useQuery(api.roommateMatches.getConnectionStatus, {
    otherUserId: id as Id<"users">,
  });
  const compatibilityScore = useQuery(api.roommateMatches.getCompatibilityWithUser, {
    otherUserId: id as Id<"users">,
  });

  const sendRequest = useMutation(api.roommateMatches.sendConnectionRequest);

  const handleConnect = async () => {
    try {
      await sendRequest({ targetUserId: id as Id<"users"> });
      toast.success("Connection request sent!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send request.");
    }
  };

  if (profile === undefined || connectionStatus === undefined || compatibilityScore === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
        <h2 className="mb-4 text-xl font-bold">Profile Not Found</h2>
        <Link href={`/roommates?tab=${fromTab}`}>
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Roommates
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <button
        onClick={() => router.push(`/roommates?tab=${fromTab}`)}
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to roommates
      </button>

      <RoommateProfileView
        userId={id}
        connectionStatus={connectionStatus ?? "none"}
        onConnect={handleConnect}
        profile={{
          name: profile.user?.name || "Unknown",
          email: profile.user?.email,
          isVerified: profile.user?.isVerified,
          avatarUrl: profile.user?.avatarUrl,
          bio: profile.bio,
          budgetMin: profile.budgetMin,
          budgetMax: profile.budgetMax,
          moveInDate: profile.moveInDate,
          moveInFlexibility: profile.moveInFlexibility,
          leaseDuration: profile.leaseDuration,
          preferredLocations: profile.preferredLocations,
          lookingFor: profile.lookingFor,
          gender: profile.gender,
          genderPreference: profile.genderPreference,
          isActive: profile.isActive,
          lifestyle: profile.lifestyle,
          dealBreakers: profile.dealBreakers,
          aboutMeTags: profile.aboutMeTags,
          roommatePreferences: profile.roommatePreferences,
          contactInfo: profile.user?.contactInfo ?? [],
          photos: profile.photos?.map((p) => p.url) ?? [],
          college: profile.college ? { name: profile.college.name, shortName: profile.college.shortName } : null,
          compatibilityScore: compatibilityScore ?? undefined,
        }}
      />
    </div>
  );
}
