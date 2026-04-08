"use client";

import { useState, useRef } from "react";
import {
  Building2,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  ImagePlus,
  Users,
  Plus,
  Mail,
  Phone,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { UserRole } from "@/lib/types";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

interface OnboardingProps {
  role: UserRole;
  userName: string;
  userEmail: string;
  onComplete: () => void;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? "w-8 bg-primary"
              : i < current
              ? "w-4 bg-primary/40"
              : "w-4 bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

const CONTACT_TYPES = [
  { value: "email", label: "Email", icon: Mail, placeholder: "Enter your email" },
  { value: "phone", label: "Phone", icon: Phone, placeholder: "Enter your phone number" },
  { value: "instagram", label: "Instagram", icon: MessageCircle, placeholder: "@username" },
  { value: "snapchat", label: "Snapchat", icon: MessageCircle, placeholder: "Enter your Snapchat" },
  { value: "discord", label: "Discord", icon: MessageCircle, placeholder: "username#1234" },
  { value: "twitter", label: "Twitter/X", icon: MessageCircle, placeholder: "@handle" },
  { value: "linkedin", label: "LinkedIn", icon: MessageCircle, placeholder: "Profile URL" },
  { value: "other", label: "Other", icon: MessageCircle, placeholder: "Enter contact info" },
] as const;

type ContactType = (typeof CONTACT_TYPES)[number]["value"];

interface ContactEntry {
  type: ContactType;
  value: string;
  isPublic: boolean;
}

async function uploadPhoto(
  generateUploadUrl: () => Promise<string>,
  savePhoto: (args: { storageId: Id<"_storage">; sortOrder?: number }) => Promise<Id<"userPhotos">>,
  dataUrl: string,
  sortOrder: number,
) {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Failed to read photo data");
  }
  const blob = await response.blob();
  const uploadUrl = await generateUploadUrl();
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  if (!uploadResponse.ok) {
    throw new Error("Photo upload failed");
  }
  const { storageId } = (await uploadResponse.json()) as { storageId?: Id<"_storage"> };
  if (!storageId) {
    throw new Error("Upload response missing storage id");
  }
  await savePhoto({ storageId, sortOrder });
}

// ============================================
// Finder (Student) Onboarding
// ============================================

function FinderOnboarding({ userName, userEmail, onComplete }: Omit<OnboardingProps, "role">) {
  const [step, setStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lookingForRoommates, setLookingForRoommates] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);

  const colleges = useQuery(api.colleges.list) ?? [];
  const updateUser = useMutation(api.users.updateUser);
  const upsertStudent = useMutation(api.studentProfiles.upsert);
  const setContacts = useMutation(api.contactInfo.set);
  const generateUploadUrl = useMutation(api.userPhotos.generateUploadUrl);
  const savePhoto = useMutation(api.userPhotos.savePhoto);
  const upsertRoommate = useMutation(api.roommateProfiles.upsert);
  const upsertSettings = useMutation(api.userSettings.upsert);
  const completeOnboardingMut = useMutation(api.users.completeOnboarding);

  const [data, setData] = useState({
    name: userName,
    collegeId: "",
    major: "",
    graduationYear: "",
    customGraduationYear: "",
    bio: "",
    photos: [] as string[],
    photoFiles: [] as Blob[],
    cleanliness: 3,
    socialLevel: 3,
    noiseLevel: 2,
    bedTime: "",
    wakeUpTime: "",
    guestFrequency: "",
    smoking: "",
    drinking: "",
    pets: "",
    budgetMin: "",
    budgetMax: "",
    moveInDate: "",
    moveInFlexibility: "",
    leaseDuration: "",
    preferredLocations: "",
    gender: "",
    genderPreference: "no_preference",
    lookingFor: "1",
    privacyShowInBrowse: true,
    privacyShowContactInfo: true,
  });

  const [aboutMeTags, setAboutMeTags] = useState<string[]>([]);
  const [newAboutMeTag, setNewAboutMeTag] = useState("");
  const [roommatePreferences, setRoommatePreferences] = useState<string[]>([]);
  const [newRoommatePreference, setNewRoommatePreference] = useState("");
  const [dealBreakers, setDealBreakers] = useState<string[]>([]);
  const [newDealBreaker, setNewDealBreaker] = useState("");

  const [contacts, setContactsList] = useState<ContactEntry[]>([
    { type: "email", value: userEmail, isPublic: true },
  ]);

  const addContact = () => {
    setContactsList((prev) => [...prev, { type: "phone", value: "", isPublic: true }]);
  };

  const removeContact = (idx: number) => {
    setContactsList((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateContact = (idx: number, updates: Partial<ContactEntry>) => {
    setContactsList((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...updates } : c)),
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 3 - data.photos.length;
    Array.from(files)
      .slice(0, remaining)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            setData((prev) => ({
              ...prev,
              photos: [...prev.photos, ev.target!.result as string].slice(0, 3),
              photoFiles: [...prev.photoFiles, file].slice(0, 3),
            }));
          }
        };
        reader.readAsDataURL(file);
      });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    setData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== idx),
      photoFiles: prev.photoFiles.filter((_, i) => i !== idx),
    }));
  };

  const addTag = (
    value: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setValue: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    const normalized = value.trim();
    if (!normalized || list.includes(normalized)) return;
    setList((prev) => [...prev, normalized]);
    setValue("");
  };

  const removeTag = (
    tag: string,
    setList: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setList((prev) => prev.filter((item) => item !== tag));
  };

  const steps = [
    "welcome",
    "personal",
    "contact",
    "photos",
    "roommate_ask",
    ...(lookingForRoommates ? ["lifestyle", "preferences", "privacy"] : []),
    "done",
  ];

  const currentStepId = steps[step] || "done";
  const totalSteps = steps.length;

  const canProceed = (): boolean => {
    if (currentStepId === "personal") {
      if (!data.name || !data.collegeId) return false;
      if (data.graduationYear === "other" && (!data.customGraduationYear || data.customGraduationYear.length !== 4)) return false;
      return true;
    }
    if (currentStepId === "roommate_ask") return lookingForRoommates !== null;
    return true;
  };

  const isOptionalStep = currentStepId === "photos" || currentStepId === "lifestyle" || currentStepId === "preferences" || currentStepId === "privacy" || currentStepId === "contact";

  const cleanlinessMap = ["relaxed", "moderate", "clean", "clean", "very_clean"] as const;
  const socialMap = ["introvert", "introvert", "ambivert", "extrovert", "extrovert"] as const;
  const noiseMap = ["very_quiet", "quiet", "moderate", "moderate", "lively"] as const;
  const lookingForMap = {
    "1": "single_roommate",
    "2": "multiple_roommates",
    "3": "multiple_roommates",
    "4": "multiple_roommates",
    "5+": "any",
  } as const;

  const persistDraft = async () => {
    await updateUser({
      name: data.name || undefined,
    });

    const gradYear = data.graduationYear === "other"
      ? Number(data.customGraduationYear)
      : data.graduationYear
        ? Number(data.graduationYear)
        : undefined;

    await upsertStudent({
      collegeId: data.collegeId ? (data.collegeId as Id<"colleges">) : undefined,
      graduationYear: Number.isNaN(gradYear) ? undefined : gradYear,
      major: data.major || undefined,
    });

    const validContacts = contacts.filter((c) => c.value.trim());
    if (validContacts.length > 0) {
      await setContacts({ contacts: validContacts });
    }

    if (lookingForRoommates === true) {
      await upsertRoommate({
        collegeId: data.collegeId ? (data.collegeId as Id<"colleges">) : undefined,
        budgetMin: data.budgetMin ? Number(data.budgetMin) : undefined,
        budgetMax: data.budgetMax ? Number(data.budgetMax) : undefined,
        moveInDate: data.moveInDate || undefined,
        moveInFlexibility: (data.moveInFlexibility as "exact" | "within_week" | "within_month" | "flexible") || undefined,
        leaseDuration: (data.leaseDuration as "semester" | "academic_year" | "full_year" | "flexible") || undefined,
        lookingFor: lookingForMap[data.lookingFor as keyof typeof lookingForMap],
        gender: (data.gender as "male" | "female" | "") || undefined,
        genderPreference: (data.genderPreference as "male" | "female" | "no_preference"),
        bio: data.bio || undefined,
        isActive: true,
        preferredLocations: data.preferredLocations
          ? data.preferredLocations.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        lifestyle: {
          cleanliness: cleanlinessMap[data.cleanliness - 1],
          socialLevel: socialMap[data.socialLevel - 1],
          noiseLevel: noiseMap[data.noiseLevel - 1],
          bedTime: data.bedTime || undefined,
          wakeUpTime: data.wakeUpTime || undefined,
          guestFrequency: (data.guestFrequency as "never" | "rarely" | "sometimes" | "often" | "very_often" | "") || undefined,
          smoking: (data.smoking as "never" | "outside_only" | "yes" | "") || undefined,
          drinking: (data.drinking as "never" | "socially" | "regularly" | "") || undefined,
          pets: (data.pets as "no_pets" | "have_pet" | "want_pet" | "allergic" | "") || undefined,
        },
        dealBreakers,
        aboutMeTags,
        roommatePreferences,
      });
      await upsertSettings({
        showInBrowse: data.privacyShowInBrowse,
        showContactInfo: data.privacyShowContactInfo,
      });
    } else if (lookingForRoommates === false) {
      await upsertRoommate({ isActive: false });
      await upsertSettings({ showInBrowse: false, showContactInfo: false });
    }
  };

  const next = async () => {
    if (currentStepId !== "done") {
      setAutosaving(true);
      try {
        await persistDraft();
      } catch (err) {
        console.error("Onboarding autosave failed:", err);
        toast.error("Could not save your progress. Please try again.");
        setAutosaving(false);
        return;
      }
      setAutosaving(false);
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const back = async () => {
    setAutosaving(true);
    try {
      await persistDraft();
    } catch (err) {
      console.error("Onboarding autosave failed:", err);
      toast.error("Could not save your progress. Please try again.");
      setAutosaving(false);
      return;
    }
    setAutosaving(false);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Grab the email the user entered in contacts (first email entry)
      const emailContact = contacts.find((c) => c.type === "email");
      await updateUser({
        name: data.name || undefined,
        email: emailContact?.value || userEmail || undefined,
      });

      const gradYear = data.graduationYear === "other"
        ? Number(data.customGraduationYear)
        : data.graduationYear
          ? Number(data.graduationYear)
          : undefined;

      await upsertStudent({
        collegeId: data.collegeId as Id<"colleges">,
        graduationYear: gradYear,
        major: data.major || undefined,
      });

      const validContacts = contacts.filter((c) => c.value.trim());
      if (validContacts.length > 0) {
        await setContacts({ contacts: validContacts });
      }

      for (let i = 0; i < data.photoFiles.length; i++) {
        const blob = data.photoFiles[i];
        const reader = new FileReader();
        const dataUrlPromise = new Promise<string>((resolve) => {
          reader.onload = (ev) => resolve(ev.target!.result as string);
          reader.readAsDataURL(blob);
        });
        const dataUrl = await dataUrlPromise;
        await uploadPhoto(generateUploadUrl, savePhoto, dataUrl, i);
      }

      if (lookingForRoommates) {
        await upsertRoommate({
          collegeId: data.collegeId as Id<"colleges">,
          budgetMin: data.budgetMin ? Number(data.budgetMin) : undefined,
          budgetMax: data.budgetMax ? Number(data.budgetMax) : undefined,
          moveInDate: data.moveInDate || undefined,
          moveInFlexibility: (data.moveInFlexibility as "exact" | "within_week" | "within_month" | "flexible") || undefined,
          leaseDuration: (data.leaseDuration as "semester" | "academic_year" | "full_year" | "flexible") || undefined,
          lookingFor: lookingForMap[data.lookingFor as keyof typeof lookingForMap],
          gender: (data.gender as "male" | "female" | "") || undefined,
          genderPreference: (data.genderPreference as "male" | "female" | "no_preference"),
          bio: data.bio || undefined,
          isActive: true,
          preferredLocations: data.preferredLocations
            ? data.preferredLocations.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          lifestyle: {
            cleanliness: cleanlinessMap[data.cleanliness - 1],
            socialLevel: socialMap[data.socialLevel - 1],
            noiseLevel: noiseMap[data.noiseLevel - 1],
            bedTime: data.bedTime || undefined,
            wakeUpTime: data.wakeUpTime || undefined,
            guestFrequency: (data.guestFrequency as "never" | "rarely" | "sometimes" | "often" | "very_often" | "") || undefined,
            smoking: (data.smoking as "never" | "outside_only" | "yes" | "") || undefined,
            drinking: (data.drinking as "never" | "socially" | "regularly" | "") || undefined,
            pets: (data.pets as "no_pets" | "have_pet" | "want_pet" | "allergic" | "") || undefined,
          },
          dealBreakers,
          aboutMeTags,
          roommatePreferences,
        });
        await upsertSettings({
          showInBrowse: data.privacyShowInBrowse,
          showContactInfo: data.privacyShowContactInfo,
        });
      } else {
        // Not looking for roommates - disable profile and hide from browse
        await upsertRoommate({ isActive: false });
        await upsertSettings({ showInBrowse: false, showContactInfo: false });
      }

      await completeOnboardingMut();
      onComplete();
    } catch (err) {
      console.error("Onboarding save failed:", err);
      toast.error("Failed to finish onboarding. Please try again.");
      setSaving(false);
    }
  };

  const sliderLabels = {
    cleanliness: ["Very Relaxed", "Relaxed", "Moderate", "Clean", "Very Clean"],
    socialLevel: ["Very Introverted", "Introverted", "Ambivert", "Extroverted", "Very Extroverted"],
    noiseLevel: ["Silent", "Very Quiet", "Moderate", "Some Noise", "Lively"],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
      <div className="relative w-full max-w-md mx-4">
        <div className="mb-5 flex items-center justify-between">
          <StepIndicator current={step} total={totalSteps} />
          <button
            onClick={async () => {
              // Skipping = not looking for roommates, hide from browse
              try {
                await upsertRoommate({ isActive: false });
                await upsertSettings({ showInBrowse: false, showContactInfo: false });
              } catch (err) {
                console.error("Onboarding skip defaults failed:", err);
              }
              onComplete();
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip setup
          </button>
        </div>

        <Card className="shadow-xl border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6">
              {/* Welcome */}
              {currentStepId === "welcome" && (
                <div className="text-center py-4">
                  <div className="mb-5 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/20">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Welcome, {data.name.split(" ")[0]}!</h2>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    Let us get your profile set up. It only takes a couple minutes and helps you find the perfect match.
                  </p>
                </div>
              )}

              {/* Personal Info */}
              {currentStepId === "personal" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">About You</h2>
                    <p className="text-sm text-muted-foreground">Tell us a bit about yourself.</p>
                  </div>

                  <div className="form-group">
                    <Label>Full Name *</Label>
                    <input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="Enter your full name" className="form-input" />
                  </div>

                  <div className="form-group">
                    <Label>College *</Label>
                    <select value={data.collegeId} onChange={(e) => setData({ ...data, collegeId: e.target.value })} className="form-select">
                      <option value="" disabled>Select your college</option>
                      {colleges.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <Label>Major</Label>
                      <input value={data.major} onChange={(e) => setData({ ...data, major: e.target.value })} placeholder="Enter your major" className="form-input" />
                    </div>
                    <div className="form-group">
                      <Label>Graduation Year</Label>
                      <select value={data.graduationYear} onChange={(e) => setData({ ...data, graduationYear: e.target.value, customGraduationYear: e.target.value === "other" ? data.customGraduationYear : "" })} className="form-select">
                        <option value="">Select year</option>
                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031].map((y) => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                        <option value="other">Other</option>
                      </select>
                      {data.graduationYear === "other" && (
                        <input type="text" placeholder="Enter your graduation year" value={data.customGraduationYear} onChange={(e) => setData({ ...data, customGraduationYear: e.target.value.replace(/\D/g, "").slice(0, 4) })} className="form-input mt-2" />
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <Label>Bio</Label>
                    <textarea value={data.bio} onChange={(e) => setData({ ...data, bio: e.target.value })} placeholder="Enter your bio" className="form-textarea" rows={2} />
                  </div>
                </div>
              )}

              {/* Contact Info */}
              {currentStepId === "contact" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">Contact Info</h2>
                    <p className="text-sm text-muted-foreground">How can potential roommates reach you?</p>
                  </div>

                  <div className="space-y-3">
                    {contacts.map((contact, idx) => {
                      const typeInfo = CONTACT_TYPES.find((t) => t.value === contact.type);
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={contact.type}
                            onChange={(e) => updateContact(idx, { type: e.target.value as ContactType })}
                            className="form-select w-32 shrink-0"
                          >
                            {CONTACT_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <input
                            value={contact.value}
                            onChange={(e) => updateContact(idx, { value: e.target.value })}
                            placeholder={typeInfo?.placeholder}
                            className="form-input flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => updateContact(idx, { isPublic: !contact.isPublic })}
                            className={`shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                              contact.isPublic
                                ? "bg-green-500/10 text-green-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {contact.isPublic ? "Public" : "Private"}
                          </button>
                          {idx > 0 && (
                            <button type="button" onClick={() => removeContact(idx)} className="shrink-0 text-muted-foreground hover:text-destructive">
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {contacts.length < 5 && (
                    <Button type="button" variant="outline" size="sm" onClick={addContact} className="gap-1.5 w-full">
                      <Plus className="h-4 w-4" />
                      Add Contact Method
                    </Button>
                  )}
                </div>
              )}

              {/* Photos */}
              {currentStepId === "photos" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">Add Photos</h2>
                    <p className="text-sm text-muted-foreground">Show potential roommates who you are. Up to 3 photos.</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((idx) => {
                      const photo = data.photos[idx];
                      if (photo) {
                        return (
                          <div key={idx} className="group relative aspect-[3/4] rounded-xl overflow-hidden border border-border">
                            <img src={photo} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                            <button type="button" onClick={() => removePhoto(idx)} className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                              <X className="h-6 w-6" />
                            </button>
                          </div>
                        );
                      }
                      return (
                        <button key={idx} type="button" onClick={() => fileInputRef.current?.click()} className={`aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${idx === 0 && data.photos.length === 0 ? "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"}`}>
                          <ImagePlus className="h-6 w-6" />
                          <span className="text-xs font-medium">{idx === 0 && data.photos.length === 0 ? "Add Photo" : "Add"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                </div>
              )}

              {/* Roommate Ask */}
              {currentStepId === "roommate_ask" && (
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <h2 className="text-lg font-bold">Are you looking for roommates?</h2>
                    <p className="text-sm text-muted-foreground mt-1">This helps us tailor your experience</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setLookingForRoommates(true)} className={`rounded-xl border-2 p-5 text-center transition-all ${lookingForRoommates === true ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"}`}>
                      <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${lookingForRoommates === true ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        <Check className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-sm">Yes, I am</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Find compatible matches</p>
                    </button>
                    <button type="button" onClick={() => setLookingForRoommates(false)} className={`rounded-xl border-2 p-5 text-center transition-all ${lookingForRoommates === false ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"}`}>
                      <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${lookingForRoommates === false ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        <X className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-sm">Not right now</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Just browsing apartments</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Lifestyle */}
              {currentStepId === "lifestyle" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">Your Lifestyle</h2>
                    <p className="text-sm text-muted-foreground">Help us find compatible roommates</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <Label className="text-xs">Typical Bedtime</Label>
                      <select value={data.bedTime} onChange={(e) => setData({ ...data, bedTime: e.target.value })} className="form-select text-sm">
                        <option value="">Select</option>
                        <option value="before_9pm">Before 9 PM</option>
                        <option value="9pm_10pm">9 PM - 10 PM</option>
                        <option value="10pm_11pm">10 PM - 11 PM</option>
                        <option value="11pm_12am">11 PM - 12 AM</option>
                        <option value="12am_1am">12 AM - 1 AM</option>
                        <option value="1am_2am">1 AM - 2 AM</option>
                        <option value="after_2am">After 2 AM</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <Label className="text-xs">Typical Wake Time</Label>
                      <select value={data.wakeUpTime} onChange={(e) => setData({ ...data, wakeUpTime: e.target.value })} className="form-select text-sm">
                        <option value="">Select</option>
                        <option value="before_6am">Before 6 AM</option>
                        <option value="6am_7am">6 AM - 7 AM</option>
                        <option value="7am_8am">7 AM - 8 AM</option>
                        <option value="8am_9am">8 AM - 9 AM</option>
                        <option value="9am_10am">9 AM - 10 AM</option>
                        <option value="10am_11am">10 AM - 11 AM</option>
                        <option value="after_11am">After 11 AM</option>
                      </select>
                    </div>
                  </div>

                  {(["cleanliness", "socialLevel", "noiseLevel"] as const).map((key) => (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{key === "socialLevel" ? "Social Level" : key === "noiseLevel" ? "Noise Level" : "Cleanliness"}</Label>
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {sliderLabels[key][data[key] - 1]}
                        </span>
                      </div>
                      <input type="range" min="1" max="5" value={data[key]} onChange={(e) => setData({ ...data, [key]: Number(e.target.value) })} className="form-slider" />
                    </div>
                  ))}

                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="form-group">
                      <Label className="text-xs">Guests</Label>
                      <select value={data.guestFrequency} onChange={(e) => setData({ ...data, guestFrequency: e.target.value })} className="form-select text-sm">
                        <option value="">Select</option>
                        <option value="never">Never</option>
                        <option value="rarely">Rarely</option>
                        <option value="sometimes">Sometimes</option>
                        <option value="often">Often</option>
                        <option value="very_often">Very Often</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <Label className="text-xs">Smoking</Label>
                      <select value={data.smoking} onChange={(e) => setData({ ...data, smoking: e.target.value })} className="form-select text-sm">
                        <option value="">Select</option>
                        <option value="never">Never</option>
                        <option value="outside_only">Outside</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <Label className="text-xs">Drinking</Label>
                      <select value={data.drinking} onChange={(e) => setData({ ...data, drinking: e.target.value })} className="form-select text-sm">
                        <option value="">Select</option>
                        <option value="never">Never</option>
                        <option value="socially">Socially</option>
                        <option value="regularly">Regularly</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <Label className="text-xs">Pets</Label>
                      <select value={data.pets} onChange={(e) => setData({ ...data, pets: e.target.value })} className="form-select text-sm">
                        <option value="">Select</option>
                        <option value="no_pets">No Pets</option>
                        <option value="have_pet">Have Pet</option>
                        <option value="want_pet">Open</option>
                        <option value="allergic">Allergic</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <Label className="text-sm">About Me Tags</Label>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newAboutMeTag}
                        onChange={(e) => setNewAboutMeTag(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(newAboutMeTag, aboutMeTags, setAboutMeTags, setNewAboutMeTag))}
                        placeholder="e.g., gamer, gym, music"
                        className="form-input flex-1"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => addTag(newAboutMeTag, aboutMeTags, setAboutMeTags, setNewAboutMeTag)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {aboutMeTags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {aboutMeTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1">
                            {tag}
                            <button type="button" onClick={() => removeTag(tag, setAboutMeTags)}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preferences */}
              {currentStepId === "preferences" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">Your Preferences</h2>
                    <p className="text-sm text-muted-foreground">What are you looking for?</p>
                  </div>

                  <div className="form-group">
                    <Label>Monthly Budget Range</Label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <input type="number" placeholder="Enter min budget" value={data.budgetMin} onChange={(e) => setData({ ...data, budgetMin: e.target.value })} className="form-input pl-7" />
                      </div>
                      <span className="text-muted-foreground text-sm">to</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <input type="number" placeholder="Enter max budget" value={data.budgetMax} onChange={(e) => setData({ ...data, budgetMax: e.target.value })} className="form-input pl-7" />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <Label>Preferred Move-in Date</Label>
                    <input type="date" value={data.moveInDate} onChange={(e) => setData({ ...data, moveInDate: e.target.value })} className="form-input" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <Label>Move-in Flexibility</Label>
                      <select value={data.moveInFlexibility} onChange={(e) => setData({ ...data, moveInFlexibility: e.target.value })} className="form-select">
                        <option value="">Select flexibility</option>
                        <option value="exact">Exact date</option>
                        <option value="within_week">Within a week</option>
                        <option value="within_month">Within a month</option>
                        <option value="flexible">Very flexible</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <Label>Lease Length</Label>
                      <select value={data.leaseDuration} onChange={(e) => setData({ ...data, leaseDuration: e.target.value })} className="form-select">
                        <option value="">Select lease length</option>
                        <option value="semester">Semester</option>
                        <option value="academic_year">Academic year</option>
                        <option value="full_year">Full year</option>
                        <option value="flexible">Flexible</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <Label>Number of Roommates</Label>
                    <div className="flex gap-1">
                      {["1", "2", "3", "4", "5+"].map((num) => (
                        <button key={num} type="button" onClick={() => setData({ ...data, lookingFor: num })}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${data.lookingFor === num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <Label>Your Gender</Label>
                      <div className="flex gap-1.5">
                        {["male", "female"].map((g) => (
                          <button key={g} type="button" onClick={() => setData({ ...data, gender: g })}
                            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${data.gender === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                            {g.charAt(0).toUpperCase() + g.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <Label>Roommate Gender Preference</Label>
                      <div className="flex gap-1.5">
                        {[{ value: "no_preference", label: "No Pref" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }].map((opt) => (
                          <button key={opt.value} type="button" onClick={() => setData({ ...data, genderPreference: opt.value })}
                            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${data.genderPreference === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <Label>Preferred Locations</Label>
                    <input type="text" value={data.preferredLocations} onChange={(e) => setData({ ...data, preferredLocations: e.target.value })} placeholder="e.g., Downtown, North side" className="form-input" />
                  </div>

                  <div className="border-t pt-3">
                    <Label className="text-sm">What You Want in a Roommate</Label>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newRoommatePreference}
                        onChange={(e) => setNewRoommatePreference(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(newRoommatePreference, roommatePreferences, setRoommatePreferences, setNewRoommatePreference))}
                        placeholder="e.g., clean, respectful"
                        className="form-input flex-1"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => addTag(newRoommatePreference, roommatePreferences, setRoommatePreferences, setNewRoommatePreference)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {roommatePreferences.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {roommatePreferences.map((pref) => (
                          <Badge key={pref} variant="secondary" className="gap-1">
                            {pref}
                            <button type="button" onClick={() => removeTag(pref, setRoommatePreferences)}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    <Label className="text-sm">What You Avoid in Roommates</Label>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newDealBreaker}
                        onChange={(e) => setNewDealBreaker(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(newDealBreaker, dealBreakers, setDealBreakers, setNewDealBreaker))}
                        placeholder="e.g., frequent parties"
                        className="form-input flex-1"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => addTag(newDealBreaker, dealBreakers, setDealBreakers, setNewDealBreaker)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {dealBreakers.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {dealBreakers.map((item) => (
                          <Badge key={item} variant="secondary" className="gap-1">
                            {item}
                            <button type="button" onClick={() => removeTag(item, setDealBreakers)}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Privacy */}
              {currentStepId === "privacy" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">Privacy</h2>
                    <p className="text-sm text-muted-foreground">Control what others can see</p>
                  </div>
                  <button type="button" onClick={() => setData({ ...data, privacyShowInBrowse: !data.privacyShowInBrowse })} className="w-full rounded-xl border border-border p-4 text-left">
                    <p className="font-semibold">Make my profile public in browse</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {data.privacyShowInBrowse ? "Enabled" : "Disabled"}
                    </p>
                  </button>
                  <button type="button" onClick={() => setData({ ...data, privacyShowContactInfo: !data.privacyShowContactInfo })} className="w-full rounded-xl border border-border p-4 text-left">
                    <p className="font-semibold">Share my contact info publicly</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {data.privacyShowContactInfo ? "Enabled" : "Disabled"}
                    </p>
                  </button>
                </div>
              )}

              {/* Done */}
              {currentStepId === "done" && (
                <div className="text-center py-4">
                  <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">You are all set!</h2>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    Your profile is ready. You can always update it from the Profile page.
                  </p>
                  {userEmail.endsWith(".edu") && (
                    <Badge className="bg-green-500/10 text-green-600 mt-3 py-1">
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      .edu Verified
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
              {step > 0 && currentStepId !== "done" ? (
                <Button variant="ghost" size="sm" onClick={back} disabled={autosaving} className="gap-1.5">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                {autosaving && (
                  <span className="text-xs text-muted-foreground">Saving...</span>
                )}
                {isOptionalStep && (
                  <Button variant="ghost" size="sm" onClick={next} disabled={autosaving} className="text-muted-foreground">
                    Skip
                  </Button>
                )}
                {currentStepId === "done" ? (
                  <Button size="sm" onClick={handleFinish} disabled={saving || autosaving} className="gap-1.5">
                    {saving ? "Saving..." : "Get Started"}
                    {!saving && <ChevronRight className="h-4 w-4" />}
                  </Button>
                ) : (
                  <Button size="sm" onClick={next} disabled={!canProceed() || autosaving} className="gap-1.5">
                    {step === 0 ? "Let's Go" : "Continue"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// Provider Onboarding
// ============================================

function ProviderOnboarding({ userName, userEmail, onComplete }: Omit<OnboardingProps, "role">) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const colleges = useQuery(api.colleges.list) ?? [];
  const updateUser = useMutation(api.users.updateUser);
  const upsertProvider = useMutation(api.providerProfiles.upsert);
  const setContacts = useMutation(api.contactInfo.set);
  const completeOnboardingMut = useMutation(api.users.completeOnboarding);

  const [data, setData] = useState({
    companyName: "",
    description: "",
    website: "",
    phone: "",
    address: "",
    selectedColleges: [] as string[],
  });

  const toggleCollege = (id: string) => {
    setData((prev) => ({
      ...prev,
      selectedColleges: prev.selectedColleges.includes(id)
        ? prev.selectedColleges.filter((c) => c !== id)
        : [...prev.selectedColleges, id],
    }));
  };

  const steps = ["welcome", "company", "areas", "contact", "done"];
  const currentStepId = steps[step];
  const totalSteps = steps.length;
  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canProceed = (): boolean => {
    if (currentStepId === "company") return !!data.companyName;
    return true;
  };

  const isOptionalStep = currentStepId === "areas" || currentStepId === "contact";

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateUser({
        name: data.companyName || userName || undefined,
        email: userEmail || undefined,
      });

      await upsertProvider({
        companyName: data.companyName,
        description: data.description || undefined,
        website: data.website || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        collegeIds: data.selectedColleges as Id<"colleges">[],
      });

      const contacts: { type: "email" | "phone"; value: string; isPublic: boolean }[] = [
        { type: "email", value: userEmail, isPublic: true },
      ];
      if (data.phone) {
        contacts.push({ type: "phone", value: data.phone, isPublic: true });
      }
      await setContacts({ contacts });

      await completeOnboardingMut();
      onComplete();
    } catch (err) {
      console.error("Onboarding save failed:", err);
      toast.error("Failed to finish onboarding. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5" />
      <div className="relative w-full max-w-md mx-4">
        <div className="mb-5 flex items-center justify-between">
          <StepIndicator current={step} total={totalSteps} />
          <button onClick={onComplete} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip setup
          </button>
        </div>

        <Card className="shadow-xl border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6">
              {currentStepId === "welcome" && (
                <div className="text-center py-4">
                  <div className="mb-5 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/20">
                    <Building2 className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Welcome, {userName.split(" ")[0]}!</h2>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    Let us set up your provider profile so students can discover your listings.
                  </p>
                </div>
              )}

              {currentStepId === "company" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">Company Information</h2>
                    <p className="text-sm text-muted-foreground">Tell students about your business</p>
                  </div>
                  <div className="form-group">
                    <Label>Company Name *</Label>
                    <input value={data.companyName} onChange={(e) => setData({ ...data, companyName: e.target.value })} placeholder="Enter your company name" className="form-input" />
                  </div>
                  <div className="form-group">
                    <Label>Description</Label>
                    <textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} placeholder="Enter your company description" className="form-textarea" rows={2} />
                  </div>
                  <div className="form-group">
                    <Label>Website</Label>
                    <input type="url" value={data.website} onChange={(e) => setData({ ...data, website: e.target.value })} placeholder="Enter your website URL" className="form-input" />
                  </div>
                </div>
              )}

              {currentStepId === "areas" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">Service Areas</h2>
                    <p className="text-sm text-muted-foreground">Which colleges do you serve?</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {colleges.map((college) => (
                      <button key={college._id} type="button" onClick={() => toggleCollege(college._id)} className={`rounded-xl px-3 py-3 text-left transition-all border-2 ${data.selectedColleges.includes(college._id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                        <div className="font-semibold text-sm">{college.shortName}</div>
                        <div className="text-xs text-muted-foreground">{college.location}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentStepId === "contact" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold">Contact Details</h2>
                    <p className="text-sm text-muted-foreground">How can students reach you?</p>
                  </div>
                  <div className="form-group">
                    <Label>Phone Number</Label>
                    <input type="tel" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} placeholder="Enter your phone number" className="form-input" />
                  </div>
                  <div className="form-group">
                    <Label>Business Address</Label>
                    <input value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} placeholder="Enter your business address" className="form-input" />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      Your email (<strong>{userEmail}</strong>) will be used as primary contact.
                    </p>
                  </div>
                </div>
              )}

              {currentStepId === "done" && (
                <div className="text-center py-4">
                  <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">You are all set!</h2>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    Head to your dashboard to start creating listings.
                  </p>
                  {data.selectedColleges.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                      {data.selectedColleges.map((id) => {
                        const c = colleges.find((col) => col._id === id);
                        return c ? <Badge key={id} variant="secondary">{c.shortName}</Badge> : null;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
              {step > 0 && currentStepId !== "done" ? (
                <Button variant="ghost" size="sm" onClick={back} className="gap-1.5">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                {isOptionalStep && (
                  <Button variant="ghost" size="sm" onClick={next} className="text-muted-foreground">
                    Skip
                  </Button>
                )}
                {currentStepId === "done" ? (
                  <Button size="sm" onClick={handleFinish} disabled={saving} className="gap-1.5">
                    {saving ? "Saving..." : "Go to Dashboard"}
                    {!saving && <ChevronRight className="h-4 w-4" />}
                  </Button>
                ) : (
                  <Button size="sm" onClick={next} disabled={!canProceed()} className="gap-1.5">
                    {step === 0 ? "Let's Go" : "Continue"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// Main Onboarding Export
// ============================================

export function Onboarding({ role, userName, userEmail, onComplete }: OnboardingProps) {
  if (role === "provider") {
    return <ProviderOnboarding userName={userName} userEmail={userEmail} onComplete={onComplete} />;
  }
  return <FinderOnboarding userName={userName} userEmail={userEmail} onComplete={onComplete} />;
}
