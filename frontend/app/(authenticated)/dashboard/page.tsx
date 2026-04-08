"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Building2,
  Heart,
  TrendingUp,
  PlusCircle,
  Sparkles,
  Calendar,
  MapPin,
  ChevronRight,
  ChevronDown,
  Home,
  Shield,
  Users,
  AlertTriangle,
  UserPlus,
  Trash2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, Pie, PieChart, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ApartmentListing, RoommateMatch, InterestedStudent, MyListing } from "@/lib/types";
import { PageHeader } from "@/app/components/PageHeader";
import { toast } from "sonner";

export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === "admin") {
    return <AdminDashboard />;
  }

  if (user?.role === "provider") {
    return <ProviderDashboard />;
  }

  return <StudentDashboard />;
}

function StudentDashboard() {
  const { user } = useAuth();

  const activeListingsCount = useQuery(api.apartmentListings.countActive);
  const latestListings = useQuery(api.apartmentListings.latestActive, { limit: 6 }) ?? [];
  const matches = useQuery(api.roommateMatches.getForUser, {});
  const saved = useQuery(api.savedListings.getByUser, {});
  const studentProfile = useQuery(api.studentProfiles.getMyProfile);
  const roommateProfile = useQuery(api.roommateProfiles.getMyProfile);
  const userPhotos = useQuery(
    api.userPhotos.getByUser,
    user?._id ? { userId: user._id as Id<"users"> } : "skip",
  );
  const contacts = useQuery(
    api.contactInfo.getByUser,
    user?._id ? { userId: user._id as Id<"users"> } : "skip",
  );

  const activeListings = latestListings as ApartmentListing[];
  const pendingMatches = ((matches ?? []) as RoommateMatch[]).filter((m) => m.status === "suggested");
  const savedCount = saved?.length ?? 0;

  const computeCompletion = () => {
    const fields = [
      !!user?.name,
      !!studentProfile?.collegeId,
      !!studentProfile?.major,
      !!studentProfile?.graduationYear,
      !!(roommateProfile?.bio),
      (userPhotos?.length ?? 0) > 0,
      (contacts?.length ?? 0) > 0,
    ];
    if (roommateProfile?.isActive) {
      fields.push(
        !!roommateProfile?.budgetMin,
        !!roommateProfile?.budgetMax,
        !!roommateProfile?.moveInDate,
      );
    }
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  };
  const profileCompletion = computeCompletion();
  const showProfileCompletionStatus = profileCompletion < 100;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={Home}
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}`}
        subtitle="Your housing search at a glance"
        color="primary"
        className="mb-6 sm:mb-8"
      />

      <div
        className={`mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 ${
          showProfileCompletionStatus ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        <StatCard
          label="Available"
          value={activeListingsCount ?? 0}
          icon={Building2}
          href="/apartments"
          color="blue"
        />
        <StatCard
          label="New Matches"
          value={pendingMatches.length}
          icon={Sparkles}
          href="/roommates"
          color="purple"
        />
        <StatCard
          label="Saved"
          value={savedCount}
          icon={Heart}
          href="/saved"
          color="red"
        />
        {showProfileCompletionStatus && (
          <StatCard
            label="Profile"
            value={`${profileCompletion}%`}
            icon={TrendingUp}
            href="/profile"
            color="green"
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div
          className={`space-y-6 ${
            showProfileCompletionStatus ? "lg:col-span-2" : "lg:col-span-3"
          }`}
        >
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <ActionButton href="/apartments" icon={Building2} label="Browse Apartments" color="blue" />
              <ActionButton href="/roommates" icon={Sparkles} label="Find Roommates" color="purple" />
            </CardContent>
          </Card>

          {pendingMatches.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-base">New Matches</CardTitle>
                </div>
                <Link href="/roommates">
                  <Button variant="ghost" size="sm" className="gap-1">
                    View All <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingMatches.slice(0, 2).map((match) => (
                  <div
                    key={match._id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 font-semibold">
                        {(match.matchedUserId?.substring(0, 2) || "??").toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">Roommate Match</p>
                        <p className="text-sm text-muted-foreground">
                          {parseFloat((match.compatibilityScore ?? 0).toFixed(2))}% compatible
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">New</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">New Listings</CardTitle>
              <Link href="/apartments">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeListings.length > 0 ? (
                activeListings.slice(0, 3).map((listing) => (
                  <Link key={listing._id} href={`/apartments/${listing._id}`}>
                    <div className="flex gap-4 rounded-lg p-3 transition-colors hover:bg-muted">
                      {listing.images?.[0] && (
                        <div
                          className="h-16 w-24 shrink-0 rounded-lg bg-cover bg-center"
                          style={{ backgroundImage: `url(${listing.images[0]})` }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{listing.title}</p>
                        <p className="text-sm text-muted-foreground">
                          ${listing.rent}/mo {listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms} BR`}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {listing.city}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  No listings available yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {showProfileCompletionStatus && (
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="text-muted-foreground">Completion</span>
                      <span className="font-medium">{profileCompletion}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${profileCompletion}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Complete your profile to improve matching accuracy.
                  </p>
                  <Link href="/profile">
                    <Button size="default" variant="outline" className="w-full">
                      Edit Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "reviewed" | "resolved">("pending");
  const [search, setSearch] = useState("");
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "student" as "student" | "provider" | "admin",
  });
  const [creating, setCreating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);

  const analytics = useQuery(api.admin.getAnalytics);
  const reports = useQuery(api.admin.listReports, { status: statusFilter, limit: 120 }) ?? [];
  const users = useQuery(api.admin.listUsers, { search, limit: 200 }) ?? [];
  const createUser = useMutation(api.admin.createUser);
  const deleteUser = useMutation(api.admin.deleteUser);
  const setReportStatus = useMutation(api.admin.setReportStatus);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error("Please complete all new user fields.");
      return;
    }
    setCreating(true);
    try {
      await createUser(newUser);
      toast.success("User created.");
      setNewUser({ name: "", email: "", password: "", role: "student" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    const yes = window.confirm(`Delete user ${email}? This action cannot be undone.`);
    if (!yes) return;
    setDeletingUserId(userId);
    try {
      await deleteUser({ userId: userId as Id<"users"> });
      toast.success("User deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user.");
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleReportStatus = async (reportId: string, status: "reviewed" | "resolved") => {
    setUpdatingReportId(reportId);
    try {
      await setReportStatus({ reportId: reportId as Id<"reports">, status });
      toast.success(`Report marked as ${status}.`);
    } catch {
      toast.error("Failed to update report status.");
    } finally {
      setUpdatingReportId(null);
    }
  };

  const totals = analytics?.totals;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={Shield}
        title="Admin Dashboard"
        subtitle="Platform analytics, user management, and moderation tools"
        color="primary"
        className="mb-6 sm:mb-8"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Users" value={totals?.users ?? 0} icon={Users} href="/dashboard" color="blue" />
        <StatCard label="Providers" value={totals?.providers ?? 0} icon={Building2} href="/dashboard" color="green" />
        <StatCard label="Listings" value={totals?.activeListings ?? 0} icon={Home} href="/dashboard" color="purple" />
        <StatCard label="Pending Reports" value={totals?.pendingReports ?? 0} icon={AlertTriangle} href="/dashboard" color="red" />
      </div>

      {/* Analytics Charts */}
      {analytics && <AdminCharts analytics={analytics} />}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <MetricRow label="Students" value={totals?.students ?? 0} />
              <MetricRow label="Providers" value={totals?.providers ?? 0} />
              <MetricRow label="Admins" value={totals?.admins ?? 0} />
              <MetricRow label="Verified Users" value={totals?.verifiedUsers ?? 0} />
              <MetricRow label="Total Listings" value={totals?.listings ?? 0} />
              <MetricRow label="Roommate Profiles Active" value={totals?.activeRoommateProfiles ?? 0} />
              <MetricRow label="Reports (All)" value={totals?.reports ?? 0} />
              <MetricRow label="Resolved Reports" value={totals?.resolvedReports ?? 0} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Moderation Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(["pending", "reviewed", "resolved"] as const).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status}
                  </Button>
                ))}
              </div>
              <div className="space-y-3">
                {reports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reports found for this status.</p>
                ) : (
                  reports.map((report) => (
                    <div key={report._id} className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge variant="secondary">{report.reason}</Badge>
                        <Badge variant={report.status === "pending" ? "destructive" : "outline"}>
                          {report.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Reporter: {report.reporter?.email ?? "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Target: {report.targetType}{" "}
                        {report.targetHref ? (
                          <Link href={report.targetHref} className="font-medium text-primary hover:underline">
                            View item
                          </Link>
                        ) : (
                          <span className="text-foreground">Unavailable</span>
                        )}
                      </p>
                      {report.description ? (
                        <p className="mt-2 text-sm">{report.description}</p>
                      ) : null}
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingReportId === report._id || report.status !== "pending"}
                          onClick={() => handleReportStatus(report._id, "reviewed")}
                        >
                          {updatingReportId === report._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark Reviewed"}
                        </Button>
                        <Button
                          size="sm"
                          disabled={updatingReportId === report._id || report.status === "resolved"}
                          onClick={() => handleReportStatus(report._id, "resolved")}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create User</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-3">
                <input
                  className="form-input"
                  placeholder="Full name"
                  value={newUser.name}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  className="form-input"
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                />
                <input
                  className="form-input"
                  type="password"
                  placeholder="Temporary password"
                  value={newUser.password}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                />
                <select
                  className="form-select"
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      role: e.target.value as "student" | "provider" | "admin",
                    }))
                  }
                >
                  <option value="student">Student</option>
                  <option value="provider">Provider</option>
                  <option value="admin">Admin</option>
                </select>
                <Button type="submit" className="w-full gap-2" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Create User
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manage Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                className="form-input"
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No users found.</p>
                ) : (
                  users.map((u) => (
                    <div key={u._id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <Link href={`/admin/users/${u._id}`} className="truncate text-sm font-medium text-primary hover:underline">
                            {u.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <Badge variant="outline">{u.role}</Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {u.hasProviderProfile ? "Provider profile" : u.hasStudentProfile ? "Student profile" : "No profile"}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={deletingUserId === u._id}
                          onClick={() => handleDeleteUser(u._id, u.email)}
                        >
                          {deletingUserId === u._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Admin Charts Section
   ────────────────────────────────────────────── */

type AnalyticsData = NonNullable<ReturnType<typeof useQuery<typeof api.admin.getAnalytics>>>;

function AdminCharts({ analytics }: { analytics: AnalyticsData }) {
  return (
    <div className="mb-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <UserCompositionChart totals={analytics.totals} />
      <ListingRentChart data={analytics.listingsByRentRange} />
      <ReportsByReasonChart data={analytics.reportsByReason} />
    </div>
  );
}

/* ─── Chart 1: User Composition (Donut) ─── */

const userCompositionConfig = {
  students: { label: "Students", color: "oklch(0.65 0.16 250)" },
  providers: { label: "Providers", color: "oklch(0.65 0.17 155)" },
  admins: { label: "Admins", color: "oklch(0.75 0.15 45)" },
} satisfies ChartConfig;

function UserCompositionChart({ totals }: { totals: AnalyticsData["totals"] }) {
  const data = [
    { role: "students", count: totals.students, fill: "var(--color-students)" },
    { role: "providers", count: totals.providers, fill: "var(--color-providers)" },
    { role: "admins", count: totals.admins, fill: "var(--color-admins)" },
  ];

  const totalUsers = totals.users;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-muted-foreground" />
          User Composition
        </CardTitle>
        <CardDescription>{totalUsers} total users on the platform</CardDescription>
      </CardHeader>
      <CardContent>
        {totalUsers === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No users registered yet
          </div>
        ) : (
          <ChartContainer config={userCompositionConfig} className="mx-auto aspect-square h-[200px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="role" hideLabel />} />
              <Pie
                data={data}
                dataKey="count"
                nameKey="role"
                innerRadius={50}
                outerRadius={80}
                strokeWidth={2}
                stroke="var(--background)"
              >
                <LabelList
                  dataKey="count"
                  className="fill-foreground font-medium"
                  stroke="none"
                  fontSize={12}
                  formatter={(value) => (Number(value) > 0 ? `${value}` : "")}
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="role" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Chart 2: Listing Rent Distribution (Bar) ─── */

const rentChartConfig = {
  count: { label: "Listings", color: "oklch(0.75 0.15 45)" },
} satisfies ChartConfig;

function ListingRentChart({ data }: { data: AnalyticsData["listingsByRentRange"] }) {
  const hasData = data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Rent Distribution
        </CardTitle>
        <CardDescription>Active listings by monthly rent range</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No active listings to display
          </div>
        ) : (
          <ChartContainer config={rentChartConfig} className="h-[200px] w-full">
            <BarChart
              data={data}
              margin={{ top: 16, right: 4, bottom: 0, left: -12 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="range"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              >
                <LabelList
                  dataKey="count"
                  position="top"
                  className="fill-foreground"
                  fontSize={11}
                  formatter={(value) => (Number(value) > 0 ? `${value}` : "")}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Chart 3: Reports by Reason (Horizontal Bar) ─── */

const reportsChartConfig = {
  count: { label: "Reports", color: "oklch(0.55 0.16 25)" },
} satisfies ChartConfig;

function ReportsByReasonChart({ data }: { data: AnalyticsData["reportsByReason"] }) {
  const entries = Object.entries(data)
    .map(([reason, count]) => ({
      reason: reason.charAt(0).toUpperCase() + reason.slice(1).replace(/_/g, " "),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Reports by Category
        </CardTitle>
        <CardDescription>
          {entries.length > 0
            ? `${entries.reduce((s, e) => s + e.count, 0)} total reports across ${entries.length} categories`
            : "No reports submitted yet"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No reports to display
          </div>
        ) : (
          <ChartContainer config={reportsChartConfig} className="h-[200px] w-full">
            <BarChart
              data={entries}
              layout="vertical"
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                dataKey="reason"
                type="category"
                tickLine={false}
                axisLine={false}
                width={90}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
              >
                <LabelList
                  dataKey="count"
                  position="right"
                  className="fill-foreground"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ProviderDashboard() {
  const { user } = useAuth();

  const providerProfile = useQuery(api.providerProfiles.getMyProfile);
  const myListings = useQuery(api.apartmentListings.getMyListings) ?? [];
  const interestedStudents = useQuery(api.savedListings.getStudentsInterestedInMyListings) ?? [];

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={Home}
        title={providerProfile?.companyName || user?.name || "Dashboard"}
        subtitle="Manage your listings"
        color="primary"
        className="mb-6 sm:mb-8"
        action={
          <Link href="/my-listings/create" className="block w-full sm:w-auto">
            <Button size="sm" className="w-full gap-2 sm:w-auto">
              <PlusCircle className="h-4 w-4" />
              New Listing
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Active"
          value={(myListings as MyListing[]).filter((l) => l.isActive).length}
          icon={Building2}
          href="/my-listings"
          color="blue"
        />
        <StatCard
          label="Total"
          value={myListings.length}
          icon={Calendar}
          href="/my-listings"
          color="green"
        />
        <StatCard
          label="Interested"
          value={interestedStudents.length}
          icon={Heart}
          href="/dashboard"
          color="purple"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="space-y-6">
        {/* Listings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Your Listings</CardTitle>
            <Link href="/my-listings">
              <Button variant="ghost" size="sm" className="gap-1">
                Manage <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {myListings.length > 0 ? (
              <div className="space-y-3">
                {(myListings as MyListing[]).slice(0, 4).map((listing) => (
                  <Link key={listing._id} href={`/my-listings/${listing._id}/edit`}>
                    <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted">
                      {listing.images?.[0] && (
                        <div
                          className="h-12 w-16 shrink-0 rounded-lg bg-cover bg-center"
                          style={{ backgroundImage: `url(${listing.images[0]})` }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{listing.title}</p>
                        <p className="text-xs text-muted-foreground">${listing.rent}/mo</p>
                      </div>
                      <Badge variant={listing.isActive ? "default" : "secondary"}>
                        {listing.isActive ? "Active" : "Hidden"}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="mb-3 text-sm text-muted-foreground">No listings yet</p>
                <Link href="/my-listings/create">
                  <Button size="default">Create Listing</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interested Students */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              <CardTitle className="text-base">Students Interested in Your Listings</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Students who saved your listings and agreed to share their contact info.
            </p>
          </CardHeader>
          <CardContent>
            {interestedStudents.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No interested students yet. Students who save your listings and consent to share their info will appear here.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(interestedStudents as InterestedStudent[]).map((item) => (
                  <StudentCard key={item.savedId} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentCard({ item }: { item: InterestedStudent }) {
  const [expanded, setExpanded] = useState(false);
  const initials = (item.student.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const normalizedStudentEmail = item.student.email?.trim().toLowerCase() ?? "";
  const hasMatchingEmailContact = (item.contacts ?? []).some(
    (contact) =>
      contact.type === "email" &&
      contact.value.trim().toLowerCase() === normalizedStudentEmail,
  );

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 p-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.student.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.listing?.title || "your listing"}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-1">
          {!hasMatchingEmailContact && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Email:</span>{" "}
              {item.student.email || "No email"}
            </p>
          )}
          {item.contacts?.map((c) => (
            <p key={c._id} className="text-xs text-muted-foreground">
              <span className="font-medium capitalize text-foreground">
                {c.customLabel || c.type}:
              </span>{" "}
              {c.value}
            </p>
          ))}
          {(!item.contacts || item.contacts.length === 0) && !item.student.email && (
            <p className="text-xs text-muted-foreground italic">No contact info provided</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  color,
  compact,
  className,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  href: string;
  color: "blue" | "purple" | "red" | "green" | "orange";
  compact?: boolean;
  className?: string;
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  };

  return (
    <Link href={href} className={className}>
      <Card className="transition-all hover:shadow-md">
        <CardContent className={compact ? "flex flex-col items-center gap-1.5 p-3 text-center sm:flex-row sm:gap-3 sm:p-4 sm:text-left" : "flex items-center gap-4 p-4"}>
          <div className={`flex shrink-0 items-center justify-center rounded-xl ${colors[color]} ${compact ? "h-8 w-8 sm:h-12 sm:w-12" : "h-12 w-12"}`}>
            <Icon className={compact ? "h-4 w-4 sm:h-6 sm:w-6" : "h-6 w-6"} />
          </div>
          <div>
            <p className={compact ? "text-lg font-bold sm:text-2xl" : "text-2xl font-bold"}>{value}</p>
            <p className={compact ? "text-xs text-muted-foreground sm:text-sm" : "text-sm text-muted-foreground"}>{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ActionButton({
  href,
  icon: Icon,
  label,
  color,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  color: "blue" | "purple" | "green";
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400",
    purple: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 dark:text-purple-400",
    green: "bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400",
  };

  return (
    <Link href={href}>
      <div className={`flex items-center gap-3 rounded-xl p-4 transition-colors ${colors[color]}`}>
        <Icon className="h-5 w-5" />
        <span className="font-medium">{label}</span>
      </div>
    </Link>
  );
}
