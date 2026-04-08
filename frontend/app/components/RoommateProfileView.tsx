"use client";

import {
  MapPin,
  Calendar,
  DollarSign,
  UserPlus,
  Flag,
  Moon,
  Sun,
  Sparkles,
  Users,
  Home,
  Volume2,
  Check,
  Clock,
  X,
  Plus,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { VerifiedBadge } from "./VerifiedBadge";
import { ContactInfoDisplay } from "./ContactInfoDisplay";
import { ReportModal } from "./ReportModal";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ContactInfo } from "@/lib/types";
import { toast } from "sonner";

interface ProfileData {
  name: string;
  email?: string;
  isVerified?: boolean;
  avatarUrl?: string | null;
  bio?: string;
  budgetMin?: number;
  budgetMax?: number;
  moveInDate?: string;
  moveInFlexibility?: string;
  leaseDuration?: string;
  preferredLocations?: string[];
  lookingFor?: string;
  gender?: string;
  genderPreference?: string;
  isActive?: boolean;
  lifestyle?: {
    sleepSchedule?: string;
    wakeUpTime?: string;
    bedTime?: string;
    cleanliness?: string;
    cleaningFrequency?: string;
    socialLevel?: string;
    guestFrequency?: string;
    overnightGuests?: string;
    noiseLevel?: string;
    studyEnvironment?: string;
    musicPreference?: string;
    smoking?: string;
    drinking?: string;
    pets?: string;
    yearInSchool?: string;
    workSchedule?: string;
    temperaturePreference?: string;
    cookingFrequency?: string;
    [key: string]: string | string[] | undefined;
  };
  dealBreakers?: string[];
  aboutMeTags?: string[];
  roommatePreferences?: string[];
  contactInfo?: ContactInfo[];
  photos?: string[];
  college?: { name: string; shortName: string } | null;
  compatibilityScore?: number;
}

type ConnectionStatus = "connected" | "sent" | "received" | "none";

interface RoommateProfileViewProps {
  profile: ProfileData;
  isPreview?: boolean;
  userId?: string;
  connectionStatus?: ConnectionStatus;
  onConnect?: () => Promise<void>;
}

function fmt(val: string | undefined): string {
  return val ? val.replace(/_/g, " ") : "N/A";
}

function AddToGroupModal({
  targetName,
  groups,
  onClose,
  onInvite,
  onCreate,
}: {
  targetName: string;
  groups: Array<{ _id: string; name: string; memberCount?: number; members?: Array<{ userId: string }> }>;
  onClose: () => void;
  onInvite: (groupId: string) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
}) {
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold">Add {targetName} to Group</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto p-4 space-y-2">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">You have no groups yet.</p>
          )}
          {groups.map((g) => (
            <button
              key={g._id}
              disabled={loading !== null}
              onClick={async () => {
                setLoading(g._id);
                try { await onInvite(g._id); } finally { setLoading(null); }
              }}
              className="w-full flex items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted transition-colors disabled:opacity-50"
            >
              <span className="font-medium text-sm">{g.name}</span>
              <span className="text-xs text-muted-foreground">{g.memberCount ?? g.members?.length ?? 0} members</span>
            </button>
          ))}
        </div>
        <div className="border-t border-border p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Create New Group</p>
          <div className="flex gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newGroupName.trim()) {
                  setLoading("new");
                  onCreate(newGroupName.trim()).finally(() => setLoading(null));
                }
              }}
            />
            <Button
              size="sm"
              disabled={!newGroupName.trim() || loading !== null}
              onClick={async () => {
                setLoading("new");
                try { await onCreate(newGroupName.trim()); } finally { setLoading(null); }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoommateProfileView({ profile, isPreview, userId, connectionStatus = "none", onConnect }: RoommateProfileViewProps) {
  const [showContact, setShowContact] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAddToGroup, setShowAddToGroup] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const lifestyle = profile.lifestyle || {};
  const initials = profile.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "??";
  const mainPhoto = profile.photos?.[0] || profile.avatarUrl;
  const ScheduleIcon = lifestyle.sleepSchedule === "night_owl" ? Moon : Sun;

  const myGroups = useQuery(api.groups.getMyGroups);
  const inviteMembers = useMutation(api.groups.inviteMembers);
  const createGroup = useMutation(api.groups.create);

  const handleConnect = async () => {
    if (!onConnect) return;
    setConnecting(true);
    try {
      await onConnect();
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {isPreview && (
        <p className="text-center text-sm text-muted-foreground mb-2">
          This is how others see your profile when browsing
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* Photos carousel */}
                {mainPhoto ? (
                  <img src={mainPhoto} alt={profile.name} className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-primary/20" />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold">
                    {initials}
                  </div>
                )}
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold">{profile.name}</h1>
                    {profile.isVerified && <VerifiedBadge />}
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {profile.isActive && (
                      <Badge className="bg-green-500/10 text-green-600">Active</Badge>
                    )}
                  </div>
                  {profile.bio?.trim() ? (
                    <p className="mb-4 text-muted-foreground">{profile.bio}</p>
                  ) : (
                    <p className="mb-4 italic text-muted-foreground">No description</p>
                  )}

                  <div className="flex flex-wrap gap-3 text-sm">
                    {profile.college && (
                      <div className="flex items-center gap-1 text-xs font-medium text-primary">
                        <GraduationCap className="h-3 w-3 shrink-0" />
                        {profile.college.shortName}
                      </div>
                    )}
                    {profile.budgetMin != null && profile.budgetMax != null && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        ${profile.budgetMin}-${profile.budgetMax}/mo
                      </div>
                    )}
                    {typeof profile.compatibilityScore === "number" && (
                      <div className="flex items-center gap-1 text-xs font-medium text-primary">
                        {profile.compatibilityScore}% compatibility
                      </div>
                    )}
                    {profile.moveInDate && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Move-in: {new Date(profile.moveInDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </div>
                    )}
                    {profile.preferredLocations && profile.preferredLocations.length > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {profile.preferredLocations.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional photos */}
              {(profile.photos?.length ?? 0) > 1 && (
                <>
                  <Separator className="my-4" />
                  <div className="flex gap-3 overflow-x-auto">
                    {profile.photos!.map((photo, i) => (
                      <img key={i} src={photo} alt={`Photo ${i + 1}`} className="h-24 w-24 shrink-0 rounded-xl object-cover border border-border" />
                    ))}
                  </div>
                </>
              )}

              <Separator className="my-4" />

              {!isPreview && (
                <div className="flex flex-wrap gap-2">
                  {connectionStatus === "connected" && (
                    <Button onClick={() => setShowContact(!showContact)}>
                      {showContact ? "Hide Contact Info" : "View Contact Info"}
                    </Button>
                  )}

                  {connectionStatus === "none" && onConnect && (
                    <Button onClick={handleConnect} disabled={connecting} className="gap-1.5">
                      <UserPlus className="h-4 w-4" />
                      {connecting ? "Sending…" : "Connect"}
                    </Button>
                  )}
                  {connectionStatus === "sent" && (
                    <Button variant="outline" disabled className="gap-1.5">
                      <Clock className="h-4 w-4" />
                      Request Sent
                    </Button>
                  )}
                  {connectionStatus === "received" && (
                    <Link href="/roommates">
                      <Button variant="outline" className="gap-1.5">
                        <Check className="h-4 w-4" />
                        Accept Request
                      </Button>
                    </Link>
                  )}
                  {connectionStatus === "connected" && (
                    <Button variant="outline" className="gap-1.5" onClick={() => setShowAddToGroup(true)}>
                      <UserPlus className="h-4 w-4" />
                      Add to Group
                    </Button>
                  )}

                  {userId && (
                    <Button variant="ghost" size="icon" onClick={() => setShowReport(true)} title="Report user">
                      <Flag className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              )}

              {showReport && userId && (
                <ReportModal
                  targetType="user"
                  targetId={userId}
                  targetName={profile.name}
                  onClose={() => setShowReport(false)}
                />
              )}

              {showAddToGroup && userId && (
                <AddToGroupModal
                  targetName={profile.name}
                  groups={(myGroups ?? []) as Array<{ _id: string; name: string; memberCount?: number; members?: Array<{ userId: string }> }>}
                  onClose={() => setShowAddToGroup(false)}
                  onInvite={async (groupId) => {
                    await inviteMembers({ groupId: groupId as Id<"roommateGroups">, userIds: [userId as Id<"users">] });
                    toast.success(`${profile.name} added to group!`);
                    setShowAddToGroup(false);
                  }}
                  onCreate={async (name) => {
                    await createGroup({ name, inviteUserIds: [userId as Id<"users">] });
                    toast.success(`Group created and ${profile.name} invited!`);
                    setShowAddToGroup(false);
                  }}
                />
              )}

              {(showContact || isPreview) && profile.contactInfo && profile.contactInfo.length > 0 && (
                <div className={`${!isPreview ? "mt-4" : ""} rounded-lg bg-muted/50 p-4`}>
                  <h3 className="mb-3 font-medium">Contact Information</h3>
                  <ContactInfoDisplay contacts={profile.contactInfo.filter((c) => c.isPublic)} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lifestyle Details */}
          {Object.keys(lifestyle).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Lifestyle & Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  {(lifestyle.wakeUpTime || lifestyle.bedTime) && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <ScheduleIcon className="h-4 w-4 text-muted-foreground" />
                        Sleep & Schedule
                      </h4>
                      <div className="space-y-2 text-sm">
                        {lifestyle.wakeUpTime && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Wake Up</span>
                            <span>{fmt(lifestyle.wakeUpTime)}</span>
                          </div>
                        )}
                        {lifestyle.bedTime && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Bed Time</span>
                            <span>{fmt(lifestyle.bedTime)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {lifestyle.cleanliness && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        Cleanliness
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Standards</span>
                          <span className="capitalize">{fmt(lifestyle.cleanliness)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {lifestyle.socialLevel && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Social
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Social Level</span>
                          <span className="capitalize">{lifestyle.socialLevel}</span>
                        </div>
                        {lifestyle.guestFrequency && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Guests</span>
                            <span className="capitalize">{lifestyle.guestFrequency}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {lifestyle.noiseLevel && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <Volume2 className="h-4 w-4 text-muted-foreground" />
                        Environment
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Noise Level</span>
                          <span className="capitalize">{fmt(lifestyle.noiseLevel)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="grid gap-4 sm:grid-cols-1">
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Lifestyle</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {lifestyle.smoking && (
                        <Badge variant="secondary" className="text-xs">
                          {lifestyle.smoking === "never" ? "Non-smoker" : `Smoking: ${lifestyle.smoking}`}
                        </Badge>
                      )}
                      {lifestyle.drinking && (
                        <Badge variant="secondary" className="text-xs">
                          {lifestyle.drinking === "never" ? "Non-drinker" : `Drinking: ${lifestyle.drinking}`}
                        </Badge>
                      )}
                      {lifestyle.pets && (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {lifestyle.pets === "no_pets" ? "No pets" : fmt(lifestyle.pets)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* About Me */}
          {profile.aboutMeTags && profile.aboutMeTags.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">About Me</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.aboutMeTags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Looking For */}
          {profile.roommatePreferences && profile.roommatePreferences.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Looking For in a Roommate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.roommatePreferences.map((pref, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">{pref}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deal Breakers */}
          {profile.dealBreakers && profile.dealBreakers.length > 0 && (
            <Card className="border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">Deal Breakers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.dealBreakers.map((db, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-red-500/10 text-red-600">{db}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {(profile.lookingFor || profile.genderPreference || profile.leaseDuration || profile.moveInFlexibility) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Looking For</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {profile.lookingFor && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Roommates</span>
                    <span className="capitalize">{fmt(profile.lookingFor)}</span>
                  </div>
                )}
                {profile.genderPreference && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Gender Pref</span>
                    <span className="capitalize">{fmt(profile.genderPreference)}</span>
                  </div>
                )}
                {profile.gender && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Gender</span>
                    <span className="capitalize">{fmt(profile.gender)}</span>
                  </div>
                )}
                {profile.leaseDuration && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Lease</span>
                    <span className="capitalize">{fmt(profile.leaseDuration)}</span>
                  </div>
                )}
                {profile.moveInFlexibility && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Move-in Flexibility</span>
                    <span className="capitalize">{fmt(profile.moveInFlexibility)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {profile.preferredLocations && profile.preferredLocations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Preferred Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {profile.preferredLocations.map((loc) => (
                    <Badge key={loc} variant="outline">
                      <MapPin className="mr-1 h-3 w-3" />
                      {loc}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!isPreview && (
            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-purple-700 dark:text-purple-400">Interested?</span>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  Use our matching system to see detailed compatibility scores.
                </p>
                <Link href="/roommates">
                  <Button size="sm" className="w-full">View Matches</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
