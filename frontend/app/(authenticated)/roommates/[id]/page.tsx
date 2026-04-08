"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RoommateProfileView } from "../../../components/RoommateProfileView";
import { toast } from "sonner";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const AI_PROMPT_OPTIONS = [
  "Quick compatibility summary",
  "Biggest thing to ask them",
  "Should I connect with them?",
] as const;

export default function RoommateProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromTab = searchParams.get("from") === "browse" ? "browse" : "smart";
  const shouldOpenAi = searchParams.get("ai") === "1";

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
  const askAboutRoommate = useAction(api.gptMatching.askAboutRoommate);
  const [chatOpen, setChatOpen] = useState(shouldOpenAi);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (shouldOpenAi) setChatOpen(true);
  }, [shouldOpenAi]);

  const handleConnect = async () => {
    try {
      await sendRequest({ targetUserId: id as Id<"users"> });
      toast.success("Connection request sent!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send request.");
    }
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ai");
    const query = params.toString();
    router.replace(query ? `/roommates/${id}?${query}` : `/roommates/${id}`);
  };

  const submitChatPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || chatLoading) return;

    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await askAboutRoommate({
        targetUserId: id as Id<"users">,
        question: trimmed,
        history,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: typeof response === "string" ? response : "I couldn't generate a reply right now.",
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: err instanceof Error ? err.message : "I couldn't generate a reply right now.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleOpenChat = () => {
    setChatOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set("ai", "1");
    router.replace(`/roommates/${id}?${params.toString()}`);
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

      {chatOpen ? (
        <RoommateAiDock
          targetName={profile.user?.name || "Unknown"}
          compatibilityScore={compatibilityScore ?? null}
          messages={messages}
          loading={chatLoading}
          inputValue={chatInput}
          onInputChange={setChatInput}
          onPromptSelect={submitChatPrompt}
          onSubmit={() => submitChatPrompt(chatInput)}
          onClose={handleCloseChat}
        />
      ) : (
        <button
          type="button"
          onClick={handleOpenChat}
          className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-purple-500/25 bg-purple-600 text-white shadow-lg transition hover:bg-purple-700"
          title="Open AI roommate chat"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function RoommateAiDock({
  targetName,
  compatibilityScore,
  messages,
  loading,
  inputValue,
  onInputChange,
  onPromptSelect,
  onSubmit,
  onClose,
}: {
  targetName: string;
  compatibilityScore: number | null;
  messages: ChatMessage[];
  loading: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onPromptSelect: (prompt: string) => Promise<void>;
  onSubmit: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-6 md:w-[360px]">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <p className="truncate text-sm font-medium">Ask AI About {targetName}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {compatibilityScore !== null ? `${Math.round(compatibilityScore)}% compatibility` : "Short profile-based guidance"}
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[280px] overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Quick, profile-based advice only.
              </p>
              <div className="flex flex-wrap gap-2">
                {AI_PROMPT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => void onPromptSelect(option)}
                    disabled={loading}
                    className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-foreground transition hover:bg-muted/80 disabled:opacity-60"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm text-foreground"
                    }
                  >
                    <p className="whitespace-pre-wrap leading-5">{message.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Thinking…
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSubmit();
                }
              }}
              rows={2}
              placeholder="Ask a short question..."
              className="form-textarea h-10 min-h-10 flex-1 resize-none py-2"
            />
            <Button type="button" onClick={() => void onSubmit()} disabled={loading || !inputValue.trim()} className="h-10 px-3">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
