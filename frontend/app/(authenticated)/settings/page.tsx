"use client";

import { Settings, Bell, Eye, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const isProvider = user?.role === "provider";

  const settings = useQuery(api.userSettings.get);
  const upsertSettings = useMutation(api.userSettings.upsert);
  const roommateProfile = useQuery(api.roommateProfiles.getMyProfile);
  const upsertRoommate = useMutation(api.roommateProfiles.upsert);

  const lookingForRoommates = roommateProfile?.isActive ?? false;

  const updateSetting = async (key: string, value: boolean) => {
    try {
      await upsertSettings({ [key]: value } as Parameters<typeof upsertSettings>[0]);
    } catch {
      toast.error("Failed to save setting");
    }
  };

  const toggleLFR = async (value: boolean) => {
    try {
      await upsertRoommate({ isActive: value });
      if (!value) {
        await upsertSettings({ showInBrowse: false, showContactInfo: false });
      }
      toast.success(value ? "Looking for roommates enabled" : "Looking for roommates disabled");
    } catch {
      toast.error("Failed to save setting");
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account preferences</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>How you want to be notified</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleSetting
              label="Email Notifications"
              description={
                isProvider
                  ? "Get notified about listing activity"
                  : "Get notified about new matches and messages"
              }
              checked={settings?.emailNotifications ?? true}
              onChange={(v) => updateSetting("emailNotifications", v)}
            />
            {!isProvider && (
              <ToggleSetting
                label="Match Alerts"
                description="Get notified when you have new roommate matches"
                checked={settings?.matchNotifications ?? true}
                onChange={(v) => updateSetting("matchNotifications", v)}
              />
            )}
          </CardContent>
        </Card>

        {!isProvider && (
          <>
            {/* Roommate Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5" />
                  Roommate Search
                </CardTitle>
                <CardDescription>Control your roommate matching visibility</CardDescription>
              </CardHeader>
              <CardContent>
                <ToggleSetting
                  label="Looking for Roommates"
                  description="Enable to appear in roommate search and get matched with others"
                  checked={lookingForRoommates}
                  onChange={toggleLFR}
                />
              </CardContent>
            </Card>

            {/* Privacy - only visible when looking for roommates */}
            {lookingForRoommates && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Eye className="h-5 w-5" />
                    Privacy
                  </CardTitle>
                  <CardDescription>Control who can see your information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ToggleSetting
                    label="Show Profile in Browse"
                    description="Allow others to discover your roommate profile"
                    checked={settings?.showInBrowse ?? false}
                    onChange={(v) => updateSetting("showInBrowse", v)}
                  />
                  <ToggleSetting
                    label="Show Contact Info"
                    description="Display contact info on your public profile"
                    checked={settings?.showContactInfo ?? false}
                    onChange={(v) => updateSetting("showContactInfo", v)}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {isProvider && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5" />
                Privacy
              </CardTitle>
              <CardDescription>Control your visibility</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleSetting
                label="Show Company Phone"
                description="Display phone number on listings"
                checked={true}
                onChange={() => {}}
              />
              <ToggleSetting
                label="Allow Direct Messages"
                description="Students can message you directly"
                checked={true}
                onChange={() => {}}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${disabled ? "pointer-events-none opacity-40" : ""}`}
    >
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
