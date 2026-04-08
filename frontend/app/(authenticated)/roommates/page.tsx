"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  AlertTriangle,
  Brain,
  UserPlus,
  Clock,
  Users,
  RotateCcw,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { VerifiedBadge } from "../../components/VerifiedBadge";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ContactInfoDisplay } from "../../components/ContactInfoDisplay";
import { AddToGroupModal } from "../../components/AddToGroupModal";
import { usePaginatedQuery, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { UsersIcon } from "@/app/components/icons";
import type { Id } from "@/convex/_generated/dataModel";
import type { College, RoommateMatch, RoommateProfileWithUser } from "@/lib/types";
import { PageHeader } from "@/app/components/PageHeader";
import { EmptyState } from "@/app/components/EmptyState";

type Tab = "smart" | "browse";

function fmt(score: number): string {
  return parseFloat(score.toFixed(2)).toString();
}

function formatCleanliness(value: string): string {
  const map: Record<string, string> = {
    very_clean: "Very Clean",
    clean: "Clean",
    moderate: "Moderate",
    relaxed: "Relaxed",
  };
  return map[value] ?? value.replace(/_/g, " ");
}

function formatSocial(value: string): string {
  const map: Record<string, string> = {
    introvert: "Introvert",
    ambivert: "Ambivert",
    extrovert: "Extrovert",
  };
  return map[value] ?? value.replace(/_/g, " ");
}

function formatSleep(value: string): string {
  const map: Record<string, string> = {
    early_bird: "Early Bird",
    night_owl: "Night Owl",
    flexible: "Flexible",
  };
  return map[value] ?? value.replace(/_/g, " ");
}


/* ================================================================
   Main Page
   ================================================================ */
export default function RoommatesPage() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-6" />}>
      <RoommatesPageContent />
    </Suspense>
  );
}

function RoommatesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const initialTab = searchParams.get("tab") === "browse" ? "browse" : "smart";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [suggestedCollapsed, setSuggestedCollapsed] = useState(false);
  const [passedCollapsed, setPassedCollapsed] = useState(true);
  const [computing, setComputing] = useState(false);

  // Browse tab filter state
  const [filterBudgetMin, setFilterBudgetMin] = useState("");
  const [filterBudgetMax, setFilterBudgetMax] = useState("");
  const [filterSleepSchedule, setFilterSleepSchedule] = useState("");
  const [filterCleanliness, setFilterCleanliness] = useState("");
  const [filterMoveIn, setFilterMoveIn] = useState("");
  const [filterSocialLevel, setFilterSocialLevel] = useState("");
  const [filterSmoking, setFilterSmoking] = useState("");
  const [filterDrinking, setFilterDrinking] = useState("");
  const [filterPets, setFilterPets] = useState("");
  const [filterCollegeId, setFilterCollegeId] = useState("");
  const defaultCollegeAppliedRef = useRef(false);

  const clearFilters = () => {
    setFilterBudgetMin("");
    setFilterBudgetMax("");
    setFilterSleepSchedule("");
    setFilterCleanliness("");
    setFilterMoveIn("");
    setFilterSocialLevel("");
    setFilterSmoking("");
    setFilterDrinking("");
    setFilterPets("");
    setFilterCollegeId("");
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/roommates?${params.toString()}`);
  };

  const convexMatches = useQuery(api.roommateMatches.getForUser, {}) ?? [];
  const incomingRequests = useQuery(api.roommateMatches.getIncomingRequests, {}) ?? [];
  const declinedMatches = useQuery(api.roommateMatches.getDeclinedForUser, {}) ?? [];
  const colleges = (useQuery(api.colleges.list) ?? []) as College[];
  const myRoommateProfile = useQuery(api.roommateProfiles.getMyProfile);
  const {
    results: browseProfiles,
    status: browsePaginationStatus,
    loadMore: loadMoreBrowseProfiles,
  } = usePaginatedQuery(api.roommateProfiles.listActivePaginated, {
    collegeId: filterCollegeId ? (filterCollegeId as Id<"colleges">) : undefined,
  }, { initialNumItems: 24 });

  useEffect(() => {
    if (defaultCollegeAppliedRef.current) return;
    if (myRoommateProfile === undefined) return;
    defaultCollegeAppliedRef.current = true;
    if (myRoommateProfile?.collegeId) {
      setFilterCollegeId(myRoommateProfile.collegeId as string);
    }
  }, [myRoommateProfile]);

  const hasActiveFilters = !!(
    filterBudgetMin || filterBudgetMax || filterSleepSchedule ||
    filterCleanliness || filterMoveIn || filterSocialLevel ||
    filterSmoking || filterDrinking || filterPets ||
    (filterCollegeId && filterCollegeId !== myRoommateProfile?.collegeId)
  );
  const computeMatchesMut = useMutation(api.roommateMatches.computeMatches);
  const respondMut = useMutation(api.roommateMatches.respondToRequest);
  const dismissMut = useMutation(api.roommateMatches.dismissMatch);
  const restoreMut = useMutation(api.roommateMatches.restoreMatch);
  const sendRequestMut = useMutation(api.roommateMatches.sendConnectionRequest);
  const acceptFromUserMut = useMutation(api.roommateMatches.acceptConnectionFromUser);

  const allMatches = (convexMatches as RoommateMatch[]).filter((m) => m != null && m.status != null);
  const smartMatches = allMatches.filter((m) => m.matchType !== "manual");
  const pendingSmartMatches = smartMatches
    .filter((m) => m.status === "suggested")
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  const passedSmartMatches = (declinedMatches as RoommateMatch[]).filter(
    (m) => m != null && m.status != null,
  );

  const manualMatches = allMatches.filter((m) => m.matchType === "manual");
  const pendingOutgoing = manualMatches.filter((m) => m.status === "pending");
  const acceptedConnections = manualMatches.filter((m) => m.status === "accepted");

  const pendingIncoming = (incomingRequests as RoommateMatch[]).filter(
    (r) => r != null && r.status === "pending",
  );

  const filteredProfiles = ((browseProfiles ?? []) as RoommateProfileWithUser[])
    .filter((p) => p?.userId !== user?._id)
    .filter((profile) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          profile.user?.name?.toLowerCase().includes(q) ||
          profile.bio?.toLowerCase().includes(q) ||
          profile.preferredLocations?.some((l) => l.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (filterBudgetMin && (profile.budgetMax ?? Infinity) < parseInt(filterBudgetMin)) return false;
      if (filterBudgetMax && (profile.budgetMin ?? 0) > parseInt(filterBudgetMax)) return false;
      if (filterSleepSchedule && profile.lifestyle?.sleepSchedule !== filterSleepSchedule) return false;
      if (filterCleanliness && profile.lifestyle?.cleanliness !== filterCleanliness) return false;
      if (filterSocialLevel && profile.lifestyle?.socialLevel !== filterSocialLevel) return false;
      if (filterSmoking && profile.lifestyle?.smoking !== filterSmoking) return false;
      if (filterDrinking && profile.lifestyle?.drinking !== filterDrinking) return false;
      if (filterPets && profile.lifestyle?.pets !== filterPets) return false;
      if (filterMoveIn && profile.moveInDate) {
        const profileDate = new Date(profile.moveInDate);
        const filterDate = new Date(filterMoveIn);
        if (profileDate > filterDate) return false;
      }
      return true;
    });

  const handleComputeMatches = async () => {
    setComputing(true);
    try {
      const result = await computeMatchesMut();
      toast.success(`Found ${(result as { matchCount?: number })?.matchCount ?? 0} matches`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Match computation failed");
    } finally {
      setComputing(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    try {
      await sendRequestMut({ targetUserId: targetUserId as Id<"users"> });
      toast.success("Connection request sent!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send request");
    }
  };

  const handleAcceptFromUser = async (fromUserId: string) => {
    try {
      await acceptFromUserMut({ fromUserId: fromUserId as Id<"users"> });
      toast.success("Connection accepted!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to accept connection");
    }
  };

  const handleRespond = async (matchId: string, status: "accepted" | "declined") => {
    try {
      await respondMut({ matchId: matchId as Id<"roommateMatches">, status });
      toast.success(status === "accepted" ? "Connection accepted!" : "Request declined");
    } catch {
      toast.error("Failed to respond to request");
    }
  };

  const totalBadge = pendingSmartMatches.length + pendingIncoming.length;

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        icon={UsersIcon}
        title="Matches"
        subtitle="Find and connect with potential roommates"
        color="purple"
      />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => switchTab("smart")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all ${
            activeTab === "smart" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Smart
          {totalBadge > 0 && (
            <Badge className="ml-1 bg-purple-600 px-1.5 py-0.5 text-[10px]">
              {totalBadge}
            </Badge>
          )}
        </button>
        <button
          onClick={() => switchTab("browse")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all ${
            activeTab === "browse" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="h-4 w-4" />
          Browse
        </button>
      </div>

      {/* ── Smart Tab ─────────────────────────────────────────────── */}
      {activeTab === "smart" && (
        <div className="space-y-6">
          {/* Find Matches Banner */}
          <Card className="border-purple-500/20 bg-purple-500/5">
            <CardContent className="flex items-start gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="mb-1 font-semibold text-purple-700 dark:text-purple-400">
                  Smart Matching
                </h3>
                <p className="text-sm text-muted-foreground">
                  Analyzes 15+ lifestyle factors - sleep schedule, cleanliness, social preferences, and budget -
                  and only matches you with students at{" "}
                  <span className="font-medium text-foreground">
                    {(myRoommateProfile as { college?: { name: string } } | null | undefined)?.college?.name ?? "your college"}
                  </span>
                  .
                </p>
                <Button
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={handleComputeMatches}
                  disabled={computing}
                >
                  <Sparkles className="h-4 w-4" />
                  {computing ? "Computing…" : "Find Matches"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* College not set warning */}
          {myRoommateProfile !== undefined && !myRoommateProfile?.collegeId && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Set your college for better matches</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Smart matching pairs you with students from the same college.{" "}
                    <Link href="/profile" className="text-primary underline underline-offset-2">
                      Update your profile
                    </Link>{" "}
                    to set your college.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 1. Connected */}
          {acceptedConnections.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-green-600 dark:text-green-400">
                <Users className="h-4 w-4" />
                Connected ({acceptedConnections.length})
              </h2>
              <div className="space-y-3">
                {acceptedConnections.map((match) => (
                  <ConnectedMatchCard key={match._id} match={match} />
                ))}
              </div>
            </section>
          )}

          {/* 2. Incoming connection requests */}
          {pendingIncoming.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                  {pendingIncoming.length}
                </span>
                Connection Requests
              </h2>
              <div className="space-y-3">
                {pendingIncoming.map((req) => (
                  <IncomingRequestCard
                    key={req._id}
                    request={req}
                    onAccept={() => handleRespond(req._id, "accepted")}
                    onDecline={() => handleRespond(req._id, "declined")}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 3. Sent (pending outgoing) */}
          {pendingOutgoing.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-muted-foreground text-sm">
                <Clock className="h-4 w-4" />
                Sent Requests ({pendingOutgoing.length})
              </h2>
              <div className="space-y-3">
                {pendingOutgoing.map((match) => (
                  <SentRequestCard key={match._id} match={match} />
                ))}
              </div>
            </section>
          )}

          {/* 4. Suggested (collapsible, sorted best first) */}
          {pendingSmartMatches.length > 0 && (
            <section>
              <button
                className="mb-3 flex w-full items-center justify-between text-left"
                onClick={() => setSuggestedCollapsed((v) => !v)}
              >
                <h2 className="flex items-center gap-2 font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs text-white">
                    {pendingSmartMatches.length}
                  </span>
                  Suggested Matches
                  <span className="text-xs font-normal text-muted-foreground">
                    (best match first)
                  </span>
                </h2>
                {suggestedCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {!suggestedCollapsed && (
                <div className="space-y-4">
                  {pendingSmartMatches.map((match) => (
                    <SmartMatchCard
                      key={match._id}
                      match={match}
                      expanded={expandedMatch === match._id}
                      onToggle={() =>
                        setExpandedMatch(expandedMatch === match._id ? null : match._id)
                      }
                      onConnect={() => handleSendRequest(match.matchedUserId)}
                      onPass={async () => {
                        try {
                          await dismissMut({ matchId: match._id as Id<"roommateMatches"> });
                          toast.success("Match passed");
                        } catch (err: unknown) {
                          toast.error(err instanceof Error ? err.message : "Failed to pass match");
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 5. Passed matches */}
          {passedSmartMatches.length > 0 && (
            <section>
              <button
                className="mb-3 flex w-full items-center justify-between text-left"
                onClick={() => setPassedCollapsed((v) => !v)}
              >
                <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <X className="h-4 w-4" />
                  Passed ({passedSmartMatches.length})
                </h2>
                {passedCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {!passedCollapsed && (
                <div className="space-y-2">
                  {passedSmartMatches.map((match) => (
                    <Card key={match._id} className="opacity-60">
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          {(match.matchedUser?.name || "?")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {match.matchedUser?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(match.compatibilityScore)}% compatibility
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 gap-1.5 text-xs"
                          onClick={async () => {
                            try {
                              await restoreMut({
                                matchId: match._id as Id<"roommateMatches">,
                              });
                              toast.success("Match restored to suggestions");
                            } catch (err: unknown) {
                              toast.error(err instanceof Error ? err.message : "Failed to restore");
                            }
                          }}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Empty state */}
          {pendingSmartMatches.length === 0 &&
            acceptedConnections.length === 0 &&
            pendingIncoming.length === 0 &&
            pendingOutgoing.length === 0 &&
            passedSmartMatches.length === 0 && (
              <EmptyState
                icon={Sparkles}
                title="No matches yet"
                description="Complete your roommate profile and click Find Matches to get started"
                action={
                  <div className="flex gap-3">
                    <Link href="/profile">
                      <Button variant="outline" size="default">Complete Profile</Button>
                    </Link>
                    <Button size="default" onClick={handleComputeMatches} disabled={computing}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Find Matches
                    </Button>
                  </div>
                }
              />
            )}
        </div>
      )}

      {/* ── Browse Tab ────────────────────────────────────────────── */}
      {activeTab === "browse" && (
        <div className="space-y-4">
          {/* Search + Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, bio, or location…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input pl-10"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="lg"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge className="ml-1 h-5 w-5 border border-primary-foreground/30 bg-primary-foreground text-primary p-0 flex items-center justify-center text-xs">
                  {[filterBudgetMin, filterBudgetMax, filterSleepSchedule, filterCleanliness, filterMoveIn, filterSocialLevel, filterSmoking, filterDrinking, filterPets, (filterCollegeId && filterCollegeId !== myRoommateProfile?.collegeId) ? filterCollegeId : ""].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="form-group sm:col-span-2 lg:col-span-1">
                    <label className="form-label flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5" />
                      College
                    </label>
                    <select
                      value={filterCollegeId}
                      onChange={(e) => setFilterCollegeId(e.target.value)}
                      className="form-select"
                    >
                      <option value="">All Colleges</option>
                      {colleges.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Budget Range</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={filterBudgetMin}
                        onChange={(e) => setFilterBudgetMin(e.target.value)}
                        className="form-input"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={filterBudgetMax}
                        onChange={(e) => setFilterBudgetMax(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sleep Schedule</label>
                    <select value={filterSleepSchedule} onChange={(e) => setFilterSleepSchedule(e.target.value)} className="form-select">
                      <option value="">Any</option>
                      <option value="early_bird">Early Bird</option>
                      <option value="night_owl">Night Owl</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cleanliness</label>
                    <select value={filterCleanliness} onChange={(e) => setFilterCleanliness(e.target.value)} className="form-select">
                      <option value="">Any</option>
                      <option value="very_clean">Very Clean</option>
                      <option value="clean">Clean</option>
                      <option value="moderate">Moderate</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Move-in By</label>
                    <input
                      type="date"
                      value={filterMoveIn}
                      onChange={(e) => setFilterMoveIn(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-border pt-4">
                  <div className="form-group">
                    <label className="form-label">Social Level</label>
                    <select value={filterSocialLevel} onChange={(e) => setFilterSocialLevel(e.target.value)} className="form-select">
                      <option value="">Any</option>
                      <option value="extrovert">Extrovert</option>
                      <option value="ambivert">Ambivert</option>
                      <option value="introvert">Introvert</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Smoking</label>
                    <select value={filterSmoking} onChange={(e) => setFilterSmoking(e.target.value)} className="form-select">
                      <option value="">Any</option>
                      <option value="never">Non-Smoker</option>
                      <option value="outside_only">Outside Only</option>
                      <option value="yes">Smoker</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Drinking</label>
                    <select value={filterDrinking} onChange={(e) => setFilterDrinking(e.target.value)} className="form-select">
                      <option value="">Any</option>
                      <option value="never">Never</option>
                      <option value="socially">Socially</option>
                      <option value="regularly">Regularly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pets</label>
                    <select value={filterPets} onChange={(e) => setFilterPets(e.target.value)} className="form-select">
                      <option value="">Any</option>
                      <option value="no_pets">No Pets</option>
                      <option value="have_pet">Has Pets</option>
                      <option value="want_pet">Wants Pet</option>
                    </select>
                  </div>
                </div>
                {hasActiveFilters && (
                  <div className="border-t border-border pt-4 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-muted-foreground">
                      <X className="h-4 w-4" />
                      Clear all filters
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <p className="text-sm text-muted-foreground">
            {filteredProfiles.length} roommate{filteredProfiles.length !== 1 ? "s" : ""} found
            {(searchQuery || hasActiveFilters) ? " (filtered)" : ""}
          </p>

          {filteredProfiles.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProfiles.map((profile) => (
                  <BrowseProfileCard
                    key={profile._id}
                    profile={profile}
                    onConnect={handleSendRequest}
                    onAcceptFromUser={handleAcceptFromUser}
                  />
                ))}
              </div>
              {browsePaginationStatus === "CanLoadMore" && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => loadMoreBrowseProfiles(24)}>
                    Load More
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={UsersIcon}
              title="No profiles found"
              description="Try adjusting your search or filters"
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Browse Profile Card - no "Add to Group" here
   ================================================================ */
function BrowseProfileCard({
  profile,
  onConnect,
  onAcceptFromUser,
}: {
  profile: RoommateProfileWithUser;
  onConnect: (userId: string) => Promise<void>;
  onAcceptFromUser: (userId: string) => Promise<void>;
}) {
  const router = useRouter();
  const name = profile.user?.name || "Unknown";
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase();
  const photoUrl = profile.photos?.[0]?.url || profile.user?.avatarUrl;
  const lifestyle = profile.lifestyle || {};

  const connectionStatus = useQuery(api.roommateMatches.getConnectionStatus, {
    otherUserId: profile.userId as Id<"users">,
  });
  const compatibilityScore = useQuery(api.roommateMatches.getCompatibilityWithUser, {
    otherUserId: profile.userId as Id<"users">,
  });
  const [isActing, setIsActing] = useState(false);

  const handleConnectClick = async () => {
    if (isActing) return;
    setIsActing(true);
    try {
      await onConnect(profile.userId);
    } finally {
      setIsActing(false);
    }
  };

  const handleAcceptClick = async () => {
    if (isActing) return;
    setIsActing(true);
    try {
      await onAcceptFromUser(profile.userId);
    } finally {
      setIsActing(false);
    }
  };

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-5">
        <div className="mb-4 flex items-start gap-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-purple-500/20"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-lg font-semibold text-purple-600">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{name}</h3>
              {profile.user?.isVerified && <VerifiedBadge showText={false} />}
            </div>
            {profile.college && (
              <div className="flex items-center gap-1 text-xs font-medium text-primary mt-0.5">
                <GraduationCap className="h-3 w-3 shrink-0" />
                <span className="truncate">{profile.college.shortName}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">
              {profile.budgetMin && profile.budgetMax
                ? `$${profile.budgetMin}–$${profile.budgetMax}/mo`
                : "Budget not set"}
            </p>
            <p className="text-xs font-medium text-primary mt-0.5">
              {typeof compatibilityScore === "number"
                ? `${fmt(compatibilityScore)}% compatibility`
                : "Compatibility unavailable"}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-700 hover:bg-purple-500/10 hover:text-purple-800"
            onClick={() => router.push(`/roommates/${profile.userId}?from=browse&ai=1`)}
            title={`Ask AI about ${name}`}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>

        {profile.bio?.trim() ? (
          <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
            {profile.bio}
          </p>
        ) : (
          <p className="mb-4 line-clamp-2 text-sm italic text-muted-foreground">
            No description
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-1.5">
          {lifestyle.cleanliness && (
            <Badge variant="secondary" className="capitalize text-xs py-0.5">
              {`Cleanliness: ${formatCleanliness(lifestyle.cleanliness)}`}
            </Badge>
          )}
          {lifestyle.socialLevel && (
            <Badge variant="secondary" className="capitalize text-xs py-0.5">
              {`Social: ${formatSocial(lifestyle.socialLevel)}`}
            </Badge>
          )}
          {lifestyle.sleepSchedule && (
            <Badge variant="secondary" className="text-xs py-0.5">
              {`Sleep: ${formatSleep(lifestyle.sleepSchedule)}`}
            </Badge>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Link href={`/roommates/${profile.userId}?from=browse`} className="block">
            <Button variant="outline" size="default" className="w-full">
              View Profile
            </Button>
          </Link>

          {connectionStatus === "connected" ? (
            <Badge className="justify-center bg-green-500/10 py-1.5 text-green-700 dark:text-green-400 text-xs">
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Connected - add to group from Smart tab
            </Badge>
          ) : connectionStatus === "sent" ? (
            <Badge className="justify-center bg-muted py-1.5 text-muted-foreground text-xs">
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Request Sent
            </Badge>
          ) : connectionStatus === "received" ? (
            <Button
              size="default"
              variant="outline"
              className="w-full gap-2 border-blue-500/40 text-blue-600 hover:bg-blue-500/5"
              onClick={handleAcceptClick}
              disabled={isActing}
            >
              <Check className="h-4 w-4" />
              {isActing ? "Accepting..." : "Accept Connection"}
            </Button>
          ) : (
            <Button size="default" className="w-full gap-2" onClick={handleConnectClick} disabled={isActing}>
              <UserPlus className="h-4 w-4" />
              {isActing ? "Connecting..." : "Connect"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ================================================================
   Incoming Request Card
   ================================================================ */
function IncomingRequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: RoommateMatch;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const sender = request.sender;
  const name = sender?.name || "Unknown";
  const initials = name.split(" ").map((n) => n[0]).join("");
  const photoUrl = request.photos?.[0]?.url || sender?.avatarUrl;
  const [isActing, setIsActing] = useState(false);

  const handleAccept = async () => {
    if (isActing) return;
    setIsActing(true);
    try {
      await onAccept();
    } finally {
      setIsActing(false);
    }
  };

  const handleDecline = async () => {
    if (isActing) return;
    setIsActing(true);
    try {
      await onDecline();
    } finally {
      setIsActing(false);
    }
  };

  return (
    <Card className="border-blue-500/20 bg-blue-500/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="h-12 w-12 rounded-full object-cover shrink-0" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/10 font-medium text-blue-600">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{name}</h3>
              {sender?.isVerified && <VerifiedBadge showText={false} />}
            </div>
            {request.profile?.college && (
              <div className="flex items-center gap-1 text-xs font-medium text-primary mt-0.5">
                <GraduationCap className="h-3 w-3 shrink-0" />
                <span>{request.profile.college.shortName}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">
              {fmt(request.compatibilityScore)}% compatibility · wants to connect
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={handleDecline} disabled={isActing} className="flex-1 gap-1.5">
            <X className="h-3.5 w-3.5" />
            {isActing ? "Working..." : "Decline"}
          </Button>
          <Button size="sm" onClick={handleAccept} disabled={isActing} className="flex-1 gap-1.5">
            <Check className="h-3.5 w-3.5" />
            {isActing ? "Working..." : "Accept"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ================================================================
   Sent Request Card
   ================================================================ */
function SentRequestCard({ match }: { match: RoommateMatch }) {
  const matchedUser = match.matchedUser;
  const name = matchedUser?.name || "Unknown";
  const initials = name.split(" ").map((n) => n[0]).join("");
  const photoUrl = match.photos?.[0]?.url || matchedUser?.avatarUrl;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="h-10 w-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-sm">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm">{name}</h3>
            <p className="text-xs text-muted-foreground">
              {fmt(match.compatibilityScore)}% compatibility
            </p>
          </div>
          <Badge className="shrink-0 bg-muted text-muted-foreground text-xs">
            <Clock className="mr-1 h-3 w-3" />
            Awaiting response
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

/* ================================================================
   Smart Match Card (suggested, lowest → highest)
   ================================================================ */
function SmartMatchCard({
  match,
  expanded,
  onToggle,
  onConnect,
  onPass,
}: {
  match: RoommateMatch;
  expanded: boolean;
  onToggle: () => void;
  onConnect: () => void;
  onPass: () => void;
}) {
  const matchedUser = match.matchedUser;
  const profile = match.profile;
  const breakdown = match.matchBreakdown;
  const name = matchedUser?.name || "Unknown";
  const initials = name.split(" ").map((n) => n[0]).join("");
  const photoUrl = match.photos?.[0]?.url;
  const score = match.compatibilityScore;

  const scoreColor =
    score >= 80
      ? "bg-emerald-700 text-white border border-white/20 shadow-md"
      : score >= 60
        ? "bg-amber-600 text-white border border-white/20 shadow-md"
        : "bg-rose-700 text-white border border-white/20 shadow-md";

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        {/* Row 1: avatar + info + expand toggle */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10 text-lg font-semibold text-purple-600">
                {initials}
              </div>
            )}
            <div
              className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${scoreColor}`}
            >
              {fmt(score)}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{name}</h3>
              {matchedUser?.isVerified && <VerifiedBadge showText={false} />}
            </div>
            {profile?.college && (
              <div className="flex items-center gap-1 text-xs font-medium text-primary mt-0.5">
                <GraduationCap className="h-3 w-3 shrink-0" />
                <span className="truncate">{profile.college.shortName}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">
              {profile?.budgetMin && profile?.budgetMax
                ? `$${profile.budgetMin}–$${profile.budgetMax}/mo`
                : "Budget not set"}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onToggle} className="px-2 shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Row 2: action buttons */}
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={onPass} className="flex-1 gap-1.5">
            <X className="h-3.5 w-3.5" />
            Pass
          </Button>
          <Button size="sm" onClick={onConnect} className="flex-1 gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Connect
          </Button>
        </div>
      </div>

      {expanded && breakdown && (
        <div className="border-t border-border bg-muted/30 p-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h4 className="mb-3 text-sm font-medium">Compatibility Breakdown</h4>
              <div className="space-y-2">
                <ScoreBar label="Budget" score={breakdown.budgetScore} />
                <ScoreBar label="Schedule" score={breakdown.scheduleScore} />
                <ScoreBar label="Cleanliness" score={breakdown.cleanlinessScore} />
                <ScoreBar label="Social" score={breakdown.socialScore} />
                <ScoreBar label="Lifestyle" score={breakdown.lifestyleScore} />
                <ScoreBar label="Location" score={breakdown.locationScore} />
              </div>

              {breakdown.matchedCriteria?.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-2 text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                    Matched Criteria
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {breakdown.matchedCriteria.map((c) => (
                      <Badge key={c} variant="secondary" className="bg-green-500/10 text-green-700 text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {breakdown.potentialConflicts?.length > 0 && (
                <div className="mt-3">
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-yellow-600 uppercase tracking-wide">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Things to Discuss
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {breakdown.potentialConflicts.map((c) => (
                      <Badge key={c} variant="secondary" className="bg-yellow-500/10 text-yellow-700 text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              {breakdown.aiInsight && (
                <div className="mb-4 rounded-lg bg-purple-500/10 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                    <Brain className="h-3.5 w-3.5" />
                    AI Insight
                  </div>
                  <p className="text-sm">{breakdown.aiInsight}</p>
                </div>
              )}

              {(profile?.bio || profile?.lifestyle) && (
                <div className="rounded-lg border border-border p-3">
                  <h4 className="mb-2 text-sm font-medium">About {name.split(" ")[0]}</h4>
                  {profile?.bio && (
                    <p className="mb-2 text-sm text-muted-foreground line-clamp-3">{profile.bio}</p>
                  )}
                  {profile?.lifestyle && (
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {profile.lifestyle.cleanliness && (
                        <p>Cleanliness: <span className="capitalize">{profile.lifestyle.cleanliness}</span></p>
                      )}
                      {profile.lifestyle.socialLevel && (
                        <p>Social: <span className="capitalize">{profile.lifestyle.socialLevel}</span></p>
                      )}
                      {profile.lifestyle.smoking && (
                        <p>Smoking: <span className="capitalize">{profile.lifestyle.smoking}</span></p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ================================================================
   Connected Match Card - Add to Group lives here
   ================================================================ */
function ConnectedMatchCard({ match }: { match: RoommateMatch }) {
  const matchedUser = match.matchedUser;
  const name = matchedUser?.name || "Unknown";
  const initials = name.split(" ").map((n) => n[0]).join("");
  const photoUrl = match.photos?.[0]?.url || matchedUser?.avatarUrl;
  const [showContact, setShowContact] = useState(false);
  const [addToGroup, setAddToGroup] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const disconnectMut = useMutation(api.roommateMatches.disconnectUser);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectMut({ otherUserId: match.matchedUserId as Id<"users"> });
      toast.success(`Disconnected from ${name}`);
      setShowDisconnectModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <>
      <Card className="border-green-500/20">
        <CardContent className="p-4">
          {/* Row 1: avatar + info + remove button */}
          <div className="flex items-center gap-3">
            {photoUrl ? (
              <img src={photoUrl} alt={name} className="h-12 w-12 rounded-full object-cover shrink-0" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500/10 font-medium text-green-600">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-medium truncate">{name}</h3>
                {matchedUser?.isVerified && <VerifiedBadge showText={false} />}
                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 text-xs">
                  {fmt(match.compatibilityScore)}% match
                </Badge>
              </div>
              {match.profile?.college && (
                <div className="flex items-center gap-1 text-xs font-medium text-primary mt-0.5">
                  <GraduationCap className="h-3 w-3 shrink-0" />
                  <span>{match.profile.college.shortName}</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">
                {match.profile?.budgetMin && match.profile?.budgetMax
                  ? `$${match.profile.budgetMin}–$${match.profile.budgetMax}/mo`
                  : "Budget not set"}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDisconnectModal(true)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* Row 2: action buttons */}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 gap-1.5"
              onClick={() => setAddToGroup(true)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add to Group
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setShowContact((v) => !v)}
            >
              {showContact ? "Hide" : "Contact"}
            </Button>
            <Link href={`/roommates/${match.matchedUserId}?from=smart`}>
              <Button size="sm" variant="outline">
                Profile
              </Button>
            </Link>
          </div>

          {showContact && matchedUser?.contactInfo?.length ? (
            <div className="mt-4 border-t border-border pt-4">
              <ContactInfoDisplay contacts={matchedUser.contactInfo} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDisconnectModal}
        title="Remove connection?"
        description={`You and ${name} will no longer be connected. This cannot be undone.`}
        confirmLabel="Remove"
        loading={disconnecting}
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnectModal(false)}
      />

      {addToGroup && (
        <AddToGroupModal
          targetUserId={match.matchedUserId}
          targetName={name}
          onClose={() => setAddToGroup(false)}
        />
      )}
    </>
  );
}

/* ================================================================
   Score Bar
   ================================================================ */
function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-sm text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium tabular-nums">{fmt(score)}%</span>
    </div>
  );
}
