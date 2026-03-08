"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { User, Save, Eye, EyeOff, X, Plus, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "../../components/VerifiedBadge";
import { ContactInfoForm } from "../../components/ContactInfoDisplay";
import { RoommateProfileView } from "../../components/RoommateProfileView";
import { useAuth } from "@/lib/auth-context";
import { authClient } from "@/lib/auth-client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ContactInfo, ContactType, LifestylePreferences, College } from "@/lib/types";

// Time options for bedtime/wake time
const bedtimeOptions = [
  { value: "before_9pm", label: "Before 9 PM" },
  { value: "9pm_10pm", label: "9 PM - 10 PM" },
  { value: "10pm_11pm", label: "10 PM - 11 PM" },
  { value: "11pm_12am", label: "11 PM - 12 AM" },
  { value: "12am_1am", label: "12 AM - 1 AM" },
  { value: "1am_2am", label: "1 AM - 2 AM" },
  { value: "after_2am", label: "After 2 AM" },
];

const wakeTimeOptions = [
  { value: "before_6am", label: "Before 6 AM" },
  { value: "6am_7am", label: "6 AM - 7 AM" },
  { value: "7am_8am", label: "7 AM - 8 AM" },
  { value: "8am_9am", label: "8 AM - 9 AM" },
  { value: "9am_10am", label: "9 AM - 10 AM" },
  { value: "10am_11am", label: "10 AM - 11 AM" },
  { value: "after_11am", label: "After 11 AM" },
];

const lookingForToCountMap: Record<string, string> = {
  single_roommate: "1",
  multiple_roommates: "2",
  any: "5+",
};

const countToLookingForMap: Record<string, "single_roommate" | "multiple_roommates" | "any"> = {
  "1": "single_roommate",
  "2": "multiple_roommates",
  "3": "multiple_roommates",
  "4": "multiple_roommates",
  "5+": "any",
};

function normalizeGenderPreferenceForUI(
  preference: string | undefined,
  gender: string | undefined,
): "no_preference" | "male" | "female" {
  if (preference === "male" || preference === "female" || preference === "no_preference") {
    return preference;
  }
  if (preference === "same_gender") {
    return gender === "male" || gender === "female" ? gender : "no_preference";
  }
  return "no_preference";
}

function getDietaryPreferenceFromLifestyle(
  lifestyle: Partial<LifestylePreferences> | undefined,
): string {
  const restrictions = lifestyle?.dietaryRestrictions;
  if (!Array.isArray(restrictions) || restrictions.length === 0) return "";
  return restrictions[0] ?? "";
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isProvider = user?.role === "provider";

  if (isAdmin) {
    return <AdminProfilePage />;
  }

  if (isProvider) {
    return <ProviderProfilePage />;
  }

  return <StudentProfilePage />;
}

function AdminProfilePage() {
  const { user } = useAuth();

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Admin Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your admin account details and security</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Information</CardTitle>
            <CardDescription>Your platform administrator account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="form-group">
                <Label>Name</Label>
                <input value={user?.name || ""} readOnly className="form-input bg-muted" />
              </div>
              <div className="form-group">
                <Label>Role</Label>
                <input value="Admin" readOnly className="form-input bg-muted" />
              </div>
            </div>
            <div className="form-group">
              <Label>Email</Label>
              <input value={user?.email || ""} readOnly className="form-input bg-muted" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Privacy & Security</CardTitle>
            <CardDescription>Manage visibility and security settings for your admin account</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordSection />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentProfilePage() {
  const { user } = useAuth();
  const [showPreview, setShowPreview] = useState(false);

  // Convex queries
  const studentProfile = useQuery(api.studentProfiles.getMyProfile);
  const roommateProfile = useQuery(api.roommateProfiles.getMyProfile);
  const colleges = useQuery(api.colleges.list) ?? [];
  const userPhotos = useQuery(
    api.userPhotos.getByUser,
    user?._id ? { userId: user._id as Id<"users"> } : "skip",
  );
  const convexContacts = useQuery(
    api.contactInfo.getByUser,
    user?._id ? { userId: user._id as Id<"users"> } : "skip",
  );

  // Convex mutations
  const updateUser = useMutation(api.users.updateUser);
  const upsertStudent = useMutation(api.studentProfiles.upsert);
  const upsertRoommate = useMutation(api.roommateProfiles.upsert);
  const computeMatches = useMutation(api.roommateMatches.computeMatches);
  const setContactsMut = useMutation(api.contactInfo.set);
  const generateUploadUrl = useMutation(api.userPhotos.generateUploadUrl);
  const savePhotoMut = useMutation(api.userPhotos.savePhoto);
  const removePhotoMut = useMutation(api.userPhotos.removePhoto);
  const upsertSettings = useMutation(api.userSettings.upsert);

  const [contactInfo, setContactInfo] = useState<ContactInfo[]>([]);
  const contactsInitializedRef = useRef(false);
  useEffect(() => {
    if (contactsInitializedRef.current) return;
    if (convexContacts === undefined) return;
    contactsInitializedRef.current = true;
    queueMicrotask(() => {
      setContactInfo(
        convexContacts.map((c) => ({
          _id: c._id,
          userId: c.userId,
          type: c.type as ContactType,
          value: c.value,
          customLabel: c.customLabel ?? null,
          isPublic: c.isPublic,
        })),
      );
    });
  }, [convexContacts]);

  const photoUrls = (userPhotos ?? []).map((p) => p.url);
  const [localPhotos, setLocalPhotos] = useState<string[]>([]);
  const profilePhotos = photoUrls.length > 0 ? photoUrls : localPhotos;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const existingCount = userPhotos?.length ?? 0;
    const remaining = 3 - existingCount;
    const toAdd = Array.from(files).slice(0, remaining);
    for (const [index, file] of toAdd.entries()) {
      try {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!result.ok) {
          throw new Error("Upload failed");
        }
        const { storageId } = (await result.json()) as { storageId?: Id<"_storage"> };
        if (!storageId) {
          throw new Error("Upload response missing storage id");
        }
        await savePhotoMut({ storageId, sortOrder: existingCount + index });
        toast.success("Photo uploaded!");
      } catch (err) {
        console.error("Photo upload failed:", err);
        toast.error("Failed to upload photo. Please try again.");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = async (index: number) => {
    try {
      if (userPhotos && userPhotos[index]) {
        await removePhotoMut({ photoId: userPhotos[index]._id });
      } else {
        setLocalPhotos((prev) => prev.filter((_, i) => i !== index));
      }
      toast.success("Photo removed.");
    } catch (err) {
      console.error("Photo remove failed:", err);
      toast.error("Failed to remove photo.");
    }
  };

  const [lookingForRoommates, setLookingForRoommates] = useState(
    roommateProfile?.isActive ?? true,
  );

  const isEduVerified = (() => {
    const email = user?.email || "";
    return email.endsWith(".edu");
  })();

  const cleanlinessToSlider = useMemo<Record<string, number>>(
    () => ({ relaxed: 1, moderate: 3, clean: 4, very_clean: 5 }),
    [],
  );
  const socialToSlider = useMemo<Record<string, number>>(
    () => ({ introvert: 2, ambivert: 3, extrovert: 4 }),
    [],
  );
  const noiseToSlider = useMemo<Record<string, number>>(
    () => ({ very_quiet: 1, quiet: 2, moderate: 3, lively: 5 }),
    [],
  );

  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    collegeId: (studentProfile?.collegeId ?? roommateProfile?.collegeId ?? "") as string,
    major: studentProfile?.major || "",
    graduationYear: studentProfile?.graduationYear?.toString() || "",
    customGraduationYear: "",
    bio: roommateProfile?.bio || "",
    budgetMin: roommateProfile?.budgetMin?.toString() || "",
    budgetMax: roommateProfile?.budgetMax?.toString() || "",
    moveInDate: roommateProfile?.moveInDate || "",
    moveInFlexibility: roommateProfile?.moveInFlexibility || "",
    leaseLength: roommateProfile?.leaseDuration || "",
    preferredLocations: roommateProfile?.preferredLocations?.join(", ") || "",
    gender: roommateProfile?.gender || "",
    genderPreference: normalizeGenderPreferenceForUI(roommateProfile?.genderPreference, roommateProfile?.gender),
    lookingFor: roommateProfile?.lookingFor
      ? lookingForToCountMap[roommateProfile.lookingFor] || "1"
      : "1",
    dietaryPreference: getDietaryPreferenceFromLifestyle(
      roommateProfile?.lifestyle as Partial<LifestylePreferences> | undefined,
    ),
  });

  const [schedule, setSchedule] = useState({
    bedtime: roommateProfile?.lifestyle?.bedTime || "",
    wakeTime: roommateProfile?.lifestyle?.wakeUpTime || "",
  });

  const [sliders, setSliders] = useState({
    cleanliness: cleanlinessToSlider[roommateProfile?.lifestyle?.cleanliness || ""] || 4,
    socialLevel: socialToSlider[roommateProfile?.lifestyle?.socialLevel || ""] || 3,
    noiseLevel: noiseToSlider[roommateProfile?.lifestyle?.noiseLevel || ""] || 2,
  });

  const [lifestyle, setLifestyle] = useState<Partial<LifestylePreferences>>(
    (roommateProfile?.lifestyle as Partial<LifestylePreferences>) || {},
  );

  const [avoids, setAvoids] = useState<string[]>(roommateProfile?.dealBreakers || []);
  const [newAvoid, setNewAvoid] = useState("");

  const [preferences, setPreferences] = useState<string[]>(roommateProfile?.roommatePreferences || []);
  const [newPreference, setNewPreference] = useState("");

  const addAvoid = () => {
    if (newAvoid.trim() && !avoids.includes(newAvoid.trim())) {
      setAvoids([...avoids, newAvoid.trim()]);
      setNewAvoid("");
    }
  };

  const removeAvoid = (avoid: string) => {
    setAvoids(avoids.filter((a) => a !== avoid));
  };

  const addPreference = () => {
    if (newPreference.trim() && !preferences.includes(newPreference.trim())) {
      setPreferences([...preferences, newPreference.trim()]);
      setNewPreference("");
    }
  };

  const removePreference = (pref: string) => {
    setPreferences(preferences.filter((p) => p !== pref));
  };

  const [aboutMe, setAboutMe] = useState<string[]>(roommateProfile?.aboutMeTags || []);
  const [newAboutMe, setNewAboutMe] = useState("");

  const addAboutMe = () => {
    if (newAboutMe.trim() && !aboutMe.includes(newAboutMe.trim())) {
      setAboutMe([...aboutMe, newAboutMe.trim()]);
      setNewAboutMe("");
    }
  };

  const removeAboutMe = (item: string) => {
    setAboutMe(aboutMe.filter((a) => a !== item));
  };

  const userSettings = useQuery(api.userSettings.get);

  // Refs and state for required-field validation (scroll + highlight)
  const refName = useRef<HTMLInputElement>(null);
  const refEmail = useRef<HTMLInputElement>(null);
  const refCollege = useRef<HTMLSelectElement>(null);
  const refCustomGraduationYear = useRef<HTMLInputElement>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  const [privacySettings, setPrivacySettings] = useState({
    showInBrowse: false,
    showContactInfo: false,
  });

  // Sync all state once when Convex data first loads (useState only uses initial value once)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (!user) return;
    if (studentProfile === undefined || roommateProfile === undefined || userSettings === undefined) return;
    initializedRef.current = true;

    queueMicrotask(() => {
      setProfile({
        name: user?.name || "",
        email: user?.email || "",
        collegeId: ((studentProfile?.collegeId ?? roommateProfile?.collegeId ?? "") as string),
        major: studentProfile?.major || "",
        graduationYear: studentProfile?.graduationYear?.toString() || "",
        customGraduationYear: "",
        bio: roommateProfile?.bio || "",
        budgetMin: roommateProfile?.budgetMin?.toString() || "",
        budgetMax: roommateProfile?.budgetMax?.toString() || "",
        moveInDate: roommateProfile?.moveInDate || "",
        moveInFlexibility: roommateProfile?.moveInFlexibility || "",
        leaseLength: roommateProfile?.leaseDuration || "",
        preferredLocations: roommateProfile?.preferredLocations?.join(", ") || "",
        gender: roommateProfile?.gender || "",
        genderPreference: normalizeGenderPreferenceForUI(roommateProfile?.genderPreference, roommateProfile?.gender),
        lookingFor: roommateProfile?.lookingFor
          ? lookingForToCountMap[roommateProfile.lookingFor] || "1"
          : "1",
        dietaryPreference: getDietaryPreferenceFromLifestyle(
          roommateProfile?.lifestyle as Partial<LifestylePreferences> | undefined,
        ),
      });
      setSchedule({
        bedtime: roommateProfile?.lifestyle?.bedTime || "",
        wakeTime: roommateProfile?.lifestyle?.wakeUpTime || "",
      });
      setSliders({
        cleanliness: cleanlinessToSlider[roommateProfile?.lifestyle?.cleanliness || ""] || 4,
        socialLevel: socialToSlider[roommateProfile?.lifestyle?.socialLevel || ""] || 3,
        noiseLevel: noiseToSlider[roommateProfile?.lifestyle?.noiseLevel || ""] || 2,
      });
      setLifestyle((roommateProfile?.lifestyle as Partial<LifestylePreferences>) || {});
      setAvoids(roommateProfile?.dealBreakers || []);
      setPreferences(roommateProfile?.roommatePreferences || []);
      setAboutMe(roommateProfile?.aboutMeTags || []);
      setLookingForRoommates(roommateProfile?.isActive ?? false);
      setPrivacySettings({
        showInBrowse: userSettings?.showInBrowse ?? false,
        showContactInfo: userSettings?.showContactInfo ?? false,
      });
    });
  }, [studentProfile, roommateProfile, user, userSettings, cleanlinessToSlider, socialToSlider, noiseToSlider]);

  // Re-sync college if it updates after initial load (e.g. post-onboarding)
  useEffect(() => {
    const savedCollege = (studentProfile?.collegeId ?? roommateProfile?.collegeId ?? "") as string;
    if (savedCollege && !profile.collegeId) {
      queueMicrotask(() => {
        setProfile((prev) => ({ ...prev, collegeId: savedCollege }));
      });
    }
  }, [studentProfile?.collegeId, roommateProfile?.collegeId, profile.collegeId]);

  const validateBudget = () => {
    const min = Number(profile.budgetMin);
    const max = Number(profile.budgetMax);
    if (min && max && max < min) return false;
    return true;
  };

  const cleanlinessMap = ["relaxed", "relaxed", "moderate", "clean", "very_clean"] as const;
  const socialMap = ["introvert", "introvert", "ambivert", "extrovert", "extrovert"] as const;
  const noiseMap = ["very_quiet", "quiet", "moderate", "moderate", "lively"] as const;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvalidFields(new Set());

    // Required fields: name, email, college; customGraduationYear when graduation year is "other"
    const missing: string[] = [];
    if (!profile.name?.trim()) missing.push("name");
    if (!profile.email?.trim()) missing.push("email");
    if (!profile.collegeId) missing.push("collegeId");
    if (profile.graduationYear === "other" && (!profile.customGraduationYear?.trim() || profile.customGraduationYear.length !== 4)) {
      missing.push("customGraduationYear");
    }
    if (missing.length > 0) {
      setInvalidFields(new Set(missing));
      toast.error("Please fill in all required fields.");
      const order = ["name", "email", "collegeId", "customGraduationYear"] as const;
      const first = order.find((f) => missing.includes(f));
      const refMap: Record<string, React.RefObject<HTMLElement | null>> = {
        name: refName,
        email: refEmail,
        collegeId: refCollege,
        customGraduationYear: refCustomGraduationYear,
      };
      if (first) {
        const el = refMap[first]?.current;
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }
      return;
    }
    if (!validateBudget()) {
      toast.error("Maximum budget must be greater than minimum budget");
      return;
    }
    if (profile.graduationYear === "other" && (!profile.customGraduationYear || profile.customGraduationYear.length !== 4)) {
      toast.error("Please enter a valid 4-digit graduation year");
      return;
    }

    try {
      await updateUser({
        name: profile.name || undefined,
        email: profile.email || undefined,
      });

      const gradYear = profile.graduationYear === "other"
        ? Number(profile.customGraduationYear)
        : profile.graduationYear ? Number(profile.graduationYear) : undefined;

      if (profile.collegeId) {
        await upsertStudent({
          collegeId: profile.collegeId as Id<"colleges">,
          graduationYear: gradYear,
          major: profile.major || undefined,
        });
      }

      const contactsToSave = contactInfo.filter((c) => c.value?.trim());
      await setContactsMut({
        contacts: contactsToSave.map((c) => ({
          type: c.type,
          value: c.value,
          customLabel: c.customLabel || undefined,
          isPublic: c.isPublic,
        })),
      });

      if (lookingForRoommates) {
        await upsertRoommate({
          collegeId: profile.collegeId ? (profile.collegeId as Id<"colleges">) : undefined,
          budgetMin: profile.budgetMin ? Number(profile.budgetMin) : undefined,
          budgetMax: profile.budgetMax ? Number(profile.budgetMax) : undefined,
          moveInDate: profile.moveInDate || undefined,
          moveInFlexibility: (profile.moveInFlexibility as "exact" | "within_week" | "within_month" | "flexible") || undefined,
          leaseDuration: (profile.leaseLength as "semester" | "academic_year" | "full_year" | "flexible") || undefined,
          bio: profile.bio || undefined,
          gender: (profile.gender as "male" | "female") || undefined,
          genderPreference: (profile.genderPreference as "male" | "female" | "no_preference") || undefined,
          lookingFor: countToLookingForMap[profile.lookingFor] || undefined,
          isActive: true,
          preferredLocations: profile.preferredLocations ? profile.preferredLocations.split(",").map((s) => s.trim()).filter(Boolean) : [],
          lifestyle: Object.fromEntries(Object.entries({
            cleanliness: cleanlinessMap[sliders.cleanliness - 1],
            socialLevel: socialMap[sliders.socialLevel - 1],
            noiseLevel: noiseMap[sliders.noiseLevel - 1],
            bedTime: schedule.bedtime || undefined,
            wakeUpTime: schedule.wakeTime || undefined,
            smoking: lifestyle.smoking || undefined,
            drinking: lifestyle.drinking || undefined,
            pets: lifestyle.pets || undefined,
            guestFrequency: lifestyle.guestFrequency || undefined,
            dietaryRestrictions: profile.dietaryPreference
              ? [profile.dietaryPreference]
              : undefined,
          }).filter(([, v]) => v !== undefined)),
          dealBreakers: avoids,
          aboutMeTags: aboutMe,
          roommatePreferences: preferences,
        });
        computeMatches().catch(() => {});
      } else {
        // Persist the disabled state so it survives page reload
        await upsertRoommate({ isActive: false });
      }

      await upsertSettings({
        showInBrowse: privacySettings.showInBrowse,
        showContactInfo: privacySettings.showContactInfo,
      });

      toast.success("Profile saved successfully!");
    } catch (err) {
      console.error("Profile save failed:", err);
      toast.error("Failed to save profile. Please try again.");
    }
  };

  const selectedCollege = (colleges as College[]).find((c) => c._id === profile.collegeId);

  const sliderLabels = {
    cleanliness: ["Very Relaxed", "Relaxed", "Moderate", "Clean", "Very Clean"],
    socialLevel: ["Very Introverted", "Introverted", "Ambivert", "Extroverted", "Very Extroverted"],
    noiseLevel: ["Silent", "Very Quiet", "Moderate", "Some Noise", "Lively"],
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Your Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your profile and preferences</p>
          </div>
        </div>
        {lookingForRoommates && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "Edit Profile" : "Preview"}
          </Button>
        )}
      </div>

      {showPreview ? (
        <RoommateProfileView
          isPreview
          profile={{
            name: profile.name,
            email: profile.email,
            isVerified: isEduVerified,
            bio: profile.bio,
            budgetMin: profile.budgetMin ? Number(profile.budgetMin) : undefined,
            budgetMax: profile.budgetMax ? Number(profile.budgetMax) : undefined,
            moveInDate: profile.moveInDate,
            moveInFlexibility: profile.moveInFlexibility,
            preferredLocations: profile.preferredLocations ? profile.preferredLocations.split(",").map((s) => s.trim()).filter(Boolean) : [],
            genderPreference: profile.genderPreference,
            isActive: lookingForRoommates,
            lifestyle: {
              ...lifestyle,
              cleanliness: ["relaxed", "relaxed", "moderate", "clean", "very_clean"][sliders.cleanliness - 1],
              socialLevel: ["introvert", "introvert", "ambivert", "extrovert", "extrovert"][sliders.socialLevel - 1],
              noiseLevel: ["very_quiet", "quiet", "moderate", "moderate", "lively"][sliders.noiseLevel - 1],
              bedTime: schedule.bedtime,
              wakeUpTime: schedule.wakeTime,
            },
            dealBreakers: avoids,
            aboutMeTags: aboutMe,
            roommatePreferences: preferences,
            contactInfo: contactInfo,
            photos: profilePhotos,
            college: selectedCollege ? { name: selectedCollege.name, shortName: selectedCollege.shortName } : null,
          }}
        />
      ) : (
      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Profile Photos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile Photos</CardTitle>
                <CardDescription>Upload up to 3 photos. These appear on your browse profile.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 max-w-sm">
                  {[0, 1, 2].map((idx) => {
                    const photo = profilePhotos[idx];
                    if (photo) {
                      return (
                        <div key={idx} className="group relative aspect-[3/4] rounded-xl overflow-hidden border border-border">
                          <img src={photo} alt={`Profile ${idx + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X className="h-6 w-6" />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${
                          idx === 0 && profilePhotos.length === 0
                            ? "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                        }`}
                      >
                        <Camera className="h-6 w-6" />
                        <span className="text-xs font-medium">{idx === 0 && profilePhotos.length === 0 ? "Add Photo" : "Add"}</span>
                      </button>
                    );
                  })}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  {profilePhotos.length}/3 photos · Visible to others when browsing profiles
                </p>
              </CardContent>
            </Card>

            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic Information</CardTitle>
                <CardDescription>Your public profile details. Fields marked with * are required.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="form-group">
                    <Label>Full Name *</Label>
                    <input
                      ref={refName}
                      value={profile.name}
                      onChange={(e) => { setProfile({ ...profile, name: e.target.value }); setInvalidFields((s) => { const n = new Set(s); n.delete("name"); return n; }); }}
                      placeholder="Enter your full name"
                      className={`form-input ${invalidFields.has("name") ? "border-red-500 ring-2 ring-red-500/20" : ""}`}
                      required
                    />
                    {invalidFields.has("name") && (
                      <p className="mt-1 text-xs text-red-500">Full name is required</p>
                    )}
                  </div>
                  <div className="form-group">
                    <Label>Email *</Label>
                    <div className="relative">
                      <input
                        ref={refEmail}
                        value={profile.email}
                        onChange={(e) => { setProfile({ ...profile, email: e.target.value }); setInvalidFields((s) => { const n = new Set(s); n.delete("email"); return n; }); }}
                        placeholder="Enter your email"
                        className={`form-input pr-24 ${invalidFields.has("email") ? "border-red-500 ring-2 ring-red-500/20" : ""}`}
                        required
                      />
                      {isEduVerified && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <VerifiedBadge showText={false} />
                        </div>
                      )}
                    </div>
                    {invalidFields.has("email") && (
                      <p className="mt-1 text-xs text-red-500">Email is required</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="form-group">
                    <Label>College *</Label>
                    <select
                      ref={refCollege}
                      value={profile.collegeId}
                      onChange={(e) => { setProfile({ ...profile, collegeId: e.target.value }); setInvalidFields((s) => { const n = new Set(s); n.delete("collegeId"); return n; }); }}
                      className={`form-select ${invalidFields.has("collegeId") ? "border-red-500 ring-2 ring-red-500/20" : ""}`}
                      required
                    >
                      <option value="" disabled>Select your college</option>
                      {(colleges as College[]).map((college) => (
                        <option key={college._id} value={college._id}>
                          {college.name}
                        </option>
                      ))}
                    </select>
                    {invalidFields.has("collegeId") && (
                      <p className="mt-1 text-xs text-red-500">College is required</p>
                    )}
                  </div>
                  <div className="form-group">
                    <Label>Graduation Year</Label>
                    <select
                      value={profile.graduationYear}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfile({ ...profile, graduationYear: val, customGraduationYear: val === "other" ? profile.customGraduationYear : "" });
                      }}
                      className="form-select"
                    >
                      <option value="">Select year</option>
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                      <option value="2028">2028</option>
                      <option value="2029">2029</option>
                      <option value="2030">2030</option>
                      <option value="2031">2031</option>
                      <option value="other">Other</option>
                    </select>
                    {profile.graduationYear === "other" && (
                      <input
                        ref={refCustomGraduationYear}
                        type="text"
                        placeholder="Enter your graduation year"
                        value={profile.customGraduationYear}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setProfile({ ...profile, customGraduationYear: v });
                          setInvalidFields((s) => { const n = new Set(s); n.delete("customGraduationYear"); return n; });
                        }}
                        className={`form-input mt-2 ${invalidFields.has("customGraduationYear") ? "border-red-500 ring-2 ring-red-500/20" : ""}`}
                        required
                        pattern="\d{4}"
                        title="Enter a valid 4-digit year"
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <Label>Major</Label>
                  <input
                    value={profile.major}
                    onChange={(e) => setProfile({ ...profile, major: e.target.value })}
                    placeholder="Enter your major"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <Label>Bio</Label>
                  <textarea
                    placeholder="Enter your bio (optional)"
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="form-textarea"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Looking for Roommates Toggle */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Looking for Roommates</p>
                    <p className="text-sm text-muted-foreground">
                      Enable to show your roommate profile and preferences
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !lookingForRoommates;
                      setLookingForRoommates(next);
                      if (!next) {
                        setShowPreview(false);
                      }
                    }}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      lookingForRoommates ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                        lookingForRoommates ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>

            {lookingForRoommates && (
            <>
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Information</CardTitle>
                <CardDescription>How potential roommates can reach you</CardDescription>
              </CardHeader>
              <CardContent>
                <ContactInfoForm contacts={contactInfo} onChange={setContactInfo} />
              </CardContent>
            </Card>

            {/* Lifestyle */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lifestyle</CardTitle>
                <CardDescription>Your daily habits and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Sleep Schedule */}
                <div>
                  <Label className="mb-3 block font-medium">Sleep Schedule</Label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="form-group">
                      <Label className="text-muted-foreground text-sm">Typical Bedtime</Label>
                      <select
                        value={schedule.bedtime}
                        onChange={(e) => setSchedule({ ...schedule, bedtime: e.target.value })}
                        className="form-select"
                      >
                        <option value="">Select bedtime</option>
                        {bedtimeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <Label className="text-muted-foreground text-sm">Typical Wake Time</Label>
                      <select
                        value={schedule.wakeTime}
                        onChange={(e) => setSchedule({ ...schedule, wakeTime: e.target.value })}
                        className="form-select"
                      >
                        <option value="">Select wake time</option>
                        {wakeTimeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Dietary Preferences */}
                <div className="border-t pt-4">
                  <div className="form-group">
                    <Label>Dietary Preferences</Label>
                    <select
                      value={profile.dietaryPreference}
                      onChange={(e) => {
                        const value = e.target.value;
                        setProfile({ ...profile, dietaryPreference: value });
                        setLifestyle({
                          ...lifestyle,
                          dietaryRestrictions: value ? [value] : undefined,
                        });
                      }}
                      className="form-select"
                    >
                      <option value="">No specific preference</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="pescatarian">Pescatarian</option>
                      <option value="halal">Halal</option>
                      <option value="kosher">Kosher</option>
                      <option value="gluten_free">Gluten-Free</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Sliders */}
                <div className="border-t pt-4 space-y-4">
                  {/* Cleanliness Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Cleanliness</Label>
                      <span className="text-sm font-medium text-primary">
                        {sliderLabels.cleanliness[sliders.cleanliness - 1]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={sliders.cleanliness}
                      onChange={(e) => setSliders({ ...sliders, cleanliness: Number(e.target.value) })}
                      className="form-slider"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Relaxed</span>
                      <span>Very Clean</span>
                    </div>
                  </div>

                  {/* Social Level Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Social Level</Label>
                      <span className="text-sm font-medium text-primary">
                        {sliderLabels.socialLevel[sliders.socialLevel - 1]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={sliders.socialLevel}
                      onChange={(e) => setSliders({ ...sliders, socialLevel: Number(e.target.value) })}
                      className="form-slider"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Introverted</span>
                      <span>Extroverted</span>
                    </div>
                  </div>

                  {/* Noise Level Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Preferred Noise Level</Label>
                      <span className="text-sm font-medium text-primary">
                        {sliderLabels.noiseLevel[sliders.noiseLevel - 1]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={sliders.noiseLevel}
                      onChange={(e) => setSliders({ ...sliders, noiseLevel: Number(e.target.value) })}
                      className="form-slider"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Silent</span>
                      <span>Lively</span>
                    </div>
                  </div>
                </div>

                {/* Dropdowns */}
                <div className="border-t pt-4 grid gap-4 sm:grid-cols-2">
                  <div className="form-group">
                    <Label>Guest Frequency</Label>
                    <select
                      value={lifestyle.guestFrequency || ""}
                      onChange={(e) => setLifestyle({ ...lifestyle, guestFrequency: e.target.value as LifestylePreferences["guestFrequency"] })}
                      className="form-select"
                    >
                      <option value="">Select preference</option>
                      <option value="never">Never</option>
                      <option value="rarely">Rarely</option>
                      <option value="sometimes">Sometimes</option>
                      <option value="often">Often</option>
                      <option value="very_often">Very Often</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <Label>Smoking</Label>
                    <select
                      value={lifestyle.smoking || ""}
                      onChange={(e) => setLifestyle({ ...lifestyle, smoking: e.target.value as LifestylePreferences["smoking"] })}
                      className="form-select"
                    >
                      <option value="">Select preference</option>
                      <option value="never">Never</option>
                      <option value="outside_only">Outside Only</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <Label>Drinking</Label>
                    <select
                      value={lifestyle.drinking || ""}
                      onChange={(e) => setLifestyle({ ...lifestyle, drinking: e.target.value as LifestylePreferences["drinking"] })}
                      className="form-select"
                    >
                      <option value="">Select preference</option>
                      <option value="never">Never</option>
                      <option value="socially">Socially</option>
                      <option value="regularly">Regularly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <Label>Pets</Label>
                    <select
                      value={lifestyle.pets || ""}
                      onChange={(e) => setLifestyle({ ...lifestyle, pets: e.target.value as LifestylePreferences["pets"] })}
                      className="form-select"
                    >
                      <option value="">Select preference</option>
                      <option value="no_pets">No Pets</option>
                      <option value="have_pet">I Have a Pet</option>
                      <option value="want_pet">Open to Pets</option>
                      <option value="allergic">Allergic</option>
                    </select>
                  </div>
                </div>

                {/* About Me */}
                <div className="border-t pt-4">
                  <Label className="mb-2 block">About Me</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add hobbies, interests, or anything else about yourself
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAboutMe}
                      onChange={(e) => setNewAboutMe(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAboutMe())}
                      placeholder="Enter your hobbies or interests"
                      className="form-input flex-1"
                    />
                    <Button type="button" variant="outline" size="default" onClick={addAboutMe}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {aboutMe.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {aboutMe.map((item) => (
                        <Badge key={item} variant="secondary" className="gap-1 py-1.5 px-3">
                          {item}
                          <button
                            type="button"
                            onClick={() => removeAboutMe(item)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Examples: Vegetarian, Night owl, Gamer, Music lover, Gym enthusiast
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Roommate Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Roommate Preferences</CardTitle>
                <CardDescription>Help us find your perfect match. All fields are optional.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="form-group">
                  <Label>Budget Range (per month)</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        placeholder="Min"
                        value={profile.budgetMin}
                        onChange={(e) => setProfile({ ...profile, budgetMin: e.target.value })}
                        className="form-input pl-7"
                      />
                    </div>
                    <span className="text-muted-foreground font-medium">to</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={profile.budgetMax}
                        onChange={(e) => setProfile({ ...profile, budgetMax: e.target.value })}
                        className="form-input pl-7"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="form-group">
                    <Label>Move-in Date</Label>
                    <input
                      type="date"
                      value={profile.moveInDate}
                      onChange={(e) => setProfile({ ...profile, moveInDate: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <Label>Move-in Flexibility</Label>
                    <select
                      value={profile.moveInFlexibility}
                      onChange={(e) => setProfile({ ...profile, moveInFlexibility: e.target.value as "exact" | "within_week" | "within_month" | "flexible" })}
                      className="form-select"
                    >
                      <option value="">Select flexibility</option>
                      <option value="exact">Exact date</option>
                      <option value="within_week">Within a week</option>
                      <option value="within_month">Within a month</option>
                      <option value="flexible">Very flexible</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="form-group">
                    <Label>Preferred Lease Length</Label>
                    <select
                      value={profile.leaseLength}
                      onChange={(e) => setProfile({ ...profile, leaseLength: e.target.value })}
                      className="form-select"
                    >
                      <option value="">Select lease length</option>
                      <option value="semester">Semester</option>
                      <option value="academic_year">Academic year</option>
                      <option value="full_year">Full year</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <Label>Number of Roommates</Label>
                    <div className="flex gap-1">
                      {["1", "2", "3", "4", "5+"].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setProfile({ ...profile, lookingFor: num })}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                            profile.lookingFor === num
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="form-group">
                    <Label>Your Gender</Label>
                    <div className="flex gap-2">
                      {[
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setProfile({ ...profile, gender: opt.value })}
                          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                            profile.gender === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <Label>Preferred Roommate Gender</Label>
                    <div className="flex gap-2">
                      {[
                        { value: "no_preference", label: "No Preference" },
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setProfile({ ...profile, genderPreference: opt.value as "male" | "female" | "no_preference" })}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                            profile.genderPreference === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <Label>Preferred Locations</Label>
                  <input
                    placeholder="Enter your preferred locations"
                    value={profile.preferredLocations}
                    onChange={(e) => setProfile({ ...profile, preferredLocations: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* What You Want in a Roommate */}
                <div className="border-t pt-4">
                  <Label className="mb-2 block">What You Want in a Roommate</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add qualities or traits you are looking for
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPreference}
                      onChange={(e) => setNewPreference(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPreference())}
                      placeholder="Enter your preference"
                      className="form-input flex-1"
                    />
                    <Button type="button" variant="outline" size="default" onClick={addPreference}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {preferences.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {preferences.map((pref) => (
                        <Badge key={pref} variant="secondary" className="gap-1 py-1.5 px-3 bg-green-500/10 text-green-700 dark:text-green-400">
                          {pref}
                          <button
                            type="button"
                            onClick={() => removePreference(pref)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* What You Avoid */}
                <div className="border-t pt-4">
                  <Label className="mb-2 block">What You Avoid in Roommates</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add dealbreakers or things you would prefer to avoid
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAvoid}
                      onChange={(e) => setNewAvoid(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAvoid())}
                      placeholder="Enter your dealbreaker"
                      className="form-input flex-1"
                    />
                    <Button type="button" variant="outline" size="default" onClick={addAvoid}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {avoids.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {avoids.map((avoid) => (
                        <Badge key={avoid} variant="secondary" className="gap-1 py-1.5 px-3 bg-red-500/10 text-red-700 dark:text-red-400">
                          {avoid}
                          <button
                            type="button"
                            onClick={() => removeAvoid(avoid)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            </>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Privacy &amp; Security</CardTitle>
                <CardDescription>Manage visibility and security settings for your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {lookingForRoommates ? (
                  <>
                    <ToggleSetting
                      label="Show Profile in Browse"
                      description="Allow others to discover your roommate profile"
                      checked={privacySettings.showInBrowse}
                      onChange={(checked) => setPrivacySettings({ ...privacySettings, showInBrowse: checked })}
                    />
                    <ToggleSetting
                      label="Show Contact Info"
                      description="Display contact info on your public profile"
                      checked={privacySettings.showContactInfo}
                      onChange={(checked) => setPrivacySettings({ ...privacySettings, showContactInfo: checked })}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Roommate visibility settings appear when you enable looking for roommates.
                  </p>
                )}
                <ChangePasswordSection />
              </CardContent>
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* Preview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Profile Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center text-center">
                  {profilePhotos.length > 0 ? (
                    <img
                      src={profilePhotos[0]}
                      alt="Profile"
                      className="mb-3 h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold">
                      {profile.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "??"}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold">{profile.name || "Your Name"}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">{profile.email || "email"}</span>
                    {isEduVerified && <VerifiedBadge showText={false} />}
                  </div>
                  {selectedCollege && (
                    <Badge variant="secondary" className="mt-2">
                      {selectedCollege.shortName}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>


            {/* Save */}
            <Button type="submit" size="lg" className="w-full gap-2">
              <Save className="h-5 w-5" />
              Save Profile
            </Button>
          </div>
        </div>
      </form>
      )}
    </div>
  );
}

function ProviderProfilePage() {
  const { user } = useAuth();
  const providerProfile = useQuery(api.providerProfiles.getMyProfile);
  const colleges = useQuery(api.colleges.list) ?? [];
  const convexContacts = useQuery(
    api.contactInfo.getByUser,
    user?._id ? { userId: user._id as Id<"users"> } : "skip",
  );
  const upsertProvider = useMutation(api.providerProfiles.upsert);
  const updateUser = useMutation(api.users.updateUser);
  const setContactsMut = useMutation(api.contactInfo.set);

  const provider = providerProfile;

  const [contactInfo, setContactInfo] = useState<ContactInfo[]>([]);
  const providerContactsInitializedRef = useRef(false);
  useEffect(() => {
    if (providerContactsInitializedRef.current) return;
    if (convexContacts === undefined) return;
    providerContactsInitializedRef.current = true;
    queueMicrotask(() => {
      setContactInfo(
        convexContacts.map((c) => ({
          _id: c._id,
          userId: c.userId,
          type: c.type as ContactType,
          value: c.value,
          customLabel: c.customLabel ?? null,
          isPublic: c.isPublic,
        })),
      );
    });
  }, [convexContacts]);

  const [profile, setProfile] = useState({
    companyName: provider?.companyName || "",
    email: user?.email || "",
    phone: provider?.phone || "",
    website: provider?.website || "",
    address: provider?.address || "",
    description: provider?.description || "",
  });

  const [selectedColleges, setSelectedColleges] = useState<string[]>(provider?.collegeIds || []);

  const refCompanyName = useRef<HTMLInputElement>(null);
  const refProviderEmail = useRef<HTMLInputElement>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  // Sync state once when Convex data loads
  const providerInitializedRef = useRef(false);
  useEffect(() => {
    if (providerInitializedRef.current) return;
    if (providerProfile === undefined) return;
    providerInitializedRef.current = true;
    queueMicrotask(() => {
      setProfile({
        companyName: providerProfile?.companyName || "",
        email: user?.email || "",
        phone: providerProfile?.phone || "",
        website: providerProfile?.website || "",
        address: providerProfile?.address || "",
        description: providerProfile?.description || "",
      });
      setSelectedColleges(providerProfile?.collegeIds || []);
    });
  }, [providerProfile, user]);

  const toggleCollege = (collegeId: string) => {
    setSelectedColleges((prev) =>
      prev.includes(collegeId)
        ? prev.filter((id) => id !== collegeId)
        : [...prev, collegeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvalidFields(new Set());
    const missing: string[] = [];
    if (!profile.companyName?.trim()) missing.push("companyName");
    if (!profile.email?.trim()) missing.push("email");
    if (missing.length > 0) {
      setInvalidFields(new Set(missing));
      toast.error("Please fill in all required fields.");
      const first = missing.includes("companyName") ? "companyName" : "email";
      if (first === "companyName") refCompanyName.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      else refProviderEmail.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    try {
      await updateUser({
        name: profile.companyName || undefined,
        email: profile.email || undefined,
      });
      await upsertProvider({
        companyName: profile.companyName,
        description: profile.description || undefined,
        website: profile.website || undefined,
        phone: profile.phone || undefined,
        address: profile.address || undefined,
        collegeIds: selectedColleges as Id<"colleges">[],
      });
    const contactsToSave = contactInfo.filter((c) => c.value?.trim());
      await setContactsMut({
        contacts: contactsToSave.map((c) => ({
          type: c.type,
          value: c.value,
          customLabel: c.customLabel || undefined,
          isPublic: c.isPublic,
        })),
      });
      toast.success("Profile saved successfully!");
    } catch (err) {
      console.error("Provider profile save failed:", err);
      toast.error("Failed to save. Please try again.");
    }
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Provider Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your company information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Company Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Information</CardTitle>
                <CardDescription>Your public business details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="form-group">
                  <Label>Company Name *</Label>
                  <input
                    ref={refCompanyName}
                    value={profile.companyName}
                    onChange={(e) => { setProfile({ ...profile, companyName: e.target.value }); setInvalidFields((s) => { const n = new Set(s); n.delete("companyName"); return n; }); }}
                    className={`form-input ${invalidFields.has("companyName") ? "border-red-500 ring-2 ring-red-500/20" : ""}`}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="form-group">
                    <Label>Email *</Label>
                    <input
                      ref={refProviderEmail}
                      type="email"
                      value={profile.email}
                      onChange={(e) => { setProfile({ ...profile, email: e.target.value }); setInvalidFields((s) => { const n = new Set(s); n.delete("email"); return n; }); }}
                      className={`form-input ${invalidFields.has("email") ? "border-red-500 ring-2 ring-red-500/20" : ""}`}
                    />
                  </div>
                  <div className="form-group">
                    <Label>Phone</Label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <Label>Website</Label>
                  <input
                    type="url"
                    placeholder="Enter your website URL"
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <Label>Business Address</Label>
                  <input
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <Label>Description</Label>
                  <textarea
                    placeholder="Enter your company description"
                    value={profile.description}
                    onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                    className="form-textarea"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Service Areas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Service Areas</CardTitle>
                <CardDescription>Select the colleges you serve</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(colleges as College[]).map((college) => (
                    <button
                      key={college._id}
                      type="button"
                      onClick={() => toggleCollege(college._id)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        selectedColleges.includes(college._id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {college.name}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Methods</CardTitle>
                <CardDescription>How students can reach you</CardDescription>
              </CardHeader>
              <CardContent>
                <ContactInfoForm contacts={contactInfo} onChange={setContactInfo} />
              </CardContent>
            </Card>

            {/* Privacy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Privacy &amp; Security</CardTitle>
                <CardDescription>Manage visibility and security settings for your account</CardDescription>
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
                <ChangePasswordSection />
              </CardContent>
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* Preview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Profile Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold">
                    {profile.companyName?.charAt(0) || "?"}
                  </div>
                  <h3 className="text-lg font-semibold">{profile.companyName || "Company Name"}</h3>
                  <p className="text-sm text-muted-foreground">{profile.email || "email"}</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {selectedColleges.slice(0, 3).map((id) => {
                      const c = (colleges as College[]).find((col) => col._id === id);
                      return c ? (
                        <Badge key={id} variant="secondary" className="text-[10px]">
                          {c.shortName}
                        </Badge>
                      ) : null;
                    })}
                    {selectedColleges.length > 3 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{selectedColleges.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Listings</span>
                  <span className="font-medium">{provider?.totalListings || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Save */}
            <Button type="submit" size="lg" className="w-full gap-2">
              <Save className="h-5 w-5" />
              Save Profile
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ChangePasswordSection() {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Please complete all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (oldPassword === newPassword) {
      toast.error("New password must be different from old password.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: oldPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        const code = (error as { code?: string }).code ?? "";
        const msg = (error as { message?: string }).message ?? "";
        if (code === "INVALID_PASSWORD" || /invalid password|incorrect password|wrong password/i.test(msg)) {
          toast.error("Old password is incorrect.");
        } else if (code === "PASSWORD_TOO_SHORT" || /password.*short/i.test(msg)) {
          toast.error("New password must be at least 8 characters.");
        } else if (/session|sensitive/i.test(msg)) {
          toast.error("Please sign in again and retry changing your password.");
        } else {
          toast.error(msg || "Failed to change password.");
        }
        return;
      }

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
      toast.success("Password changed successfully.");
    } catch {
      toast.error("Failed to change password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Password</p>
          <p className="text-xs text-muted-foreground">Update your account password</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Cancel" : "Change Password"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
        <div className="form-group">
          <Label>Old Password</Label>
          <div className="relative">
            <input
              type={showOldPassword ? "text" : "password"}
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter old password"
              className="form-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowOldPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showOldPassword ? "Hide old password" : "Show old password"}
            >
              {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="form-group">
          <Label>New Password</Label>
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="form-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showNewPassword ? "Hide new password" : "Show new password"}
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="form-group">
          <Label>Confirm New Password</Label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="form-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showConfirmPassword ? "Hide confirm new password" : "Show confirm new password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="button" onClick={handleChangePassword} disabled={saving} className="w-full sm:w-auto">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update Password
        </Button>
        </div>
      )}
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
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
