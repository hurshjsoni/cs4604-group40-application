"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const generateInsight = internalAction({
  args: {
    matchId: v.id("roommateMatches"),
  },
  handler: async (ctx, { matchId }): Promise<string | null> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("OPENAI_API_KEY not set, skipping GPT insight");
      return null;
    }

    const match = await ctx.runQuery(internal.gptMatchingHelpers.getMatchData, { matchId });
    if (!match) throw new Error("Match not found");

    const prompt: string = `You are a roommate matching assistant. Given these two roommate profiles and their compatibility scores, generate a brief 1-2 sentence insight about their compatibility.
Missing values are allowed; avoid overconfident claims when data is incomplete.

Profile 1: ${JSON.stringify(match.profile1Summary)}
Profile 2: ${JSON.stringify(match.profile2Summary)}
Profile 1 details: ${JSON.stringify(match.profile1)}
Profile 2 details: ${JSON.stringify(match.profile2)}

Scores:
- Overall: ${match.compatibilityScore}%
- Budget: ${match.matchBreakdown.budgetScore}%
- Schedule: ${match.matchBreakdown.scheduleScore}%
- Cleanliness: ${match.matchBreakdown.cleanlinessScore}%
- Social: ${match.matchBreakdown.socialScore}%
- Lifestyle: ${match.matchBreakdown.lifestyleScore}%
- Location: ${match.matchBreakdown.locationScore}%

Matched criteria: ${match.matchBreakdown.matchedCriteria.join(", ")}
Potential conflicts: ${match.matchBreakdown.potentialConflicts.join(", ")}

Generate a friendly, helpful 1-2 sentence compatibility insight:`;

    try {
      const response: Response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a concise roommate matching assistant. Respond with only 1-2 sentences." },
            { role: "user", content: prompt },
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        console.error("OpenAI API error:", response.status, await response.text());
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const insight: string | undefined = data.choices?.[0]?.message?.content?.trim();

      if (insight) {
        await ctx.runMutation(internal.gptMatchingHelpers.saveInsight, {
          matchId,
          aiInsight: insight,
        });
        return insight;
      }
      return null;
    } catch (err) {
      console.error("GPT insight generation failed:", err);
      return null;
    }
  },
});

export const refineMatchWithAI = internalAction({
  args: {
    matchId: v.id("roommateMatches"),
  },
  handler: async (ctx, { matchId }): Promise<void> => {
    // Optional enhancement only: if AI configuration fails/missing,
    // core matching results must continue to work unchanged.
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return;

    const match = await ctx.runQuery(internal.gptMatchingHelpers.getMatchData, { matchId });
    if (!match) return;

    const prompt = `You are improving a roommate compatibility score.
Given this match data, return STRICT JSON only:
{"adjustment": number, "insight": string}

Rules:
- adjustment must be an integer from -20 to 20.
- Positive if human compatibility feels better than numeric heuristic.
- Negative if there are likely lived-experience conflicts.
- If profile data is sparse, keep adjustment close to 0.
- insight must be 1-2 concise sentences.

Data:
${JSON.stringify({
      profile1: match.profile1Summary,
      profile2: match.profile2Summary,
      profile1Details: match.profile1,
      profile2Details: match.profile2,
      scores: match.matchBreakdown,
      overall: match.compatibilityScore,
    })}`;

    try {
      const response: Response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Return only valid JSON. No markdown." },
            { role: "user", content: prompt },
          ],
          max_tokens: 180,
          temperature: 0.4,
        }),
      });

      if (!response.ok) return;

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) return;

      const parsed = JSON.parse(content) as { adjustment?: number; insight?: string };
      if (typeof parsed.adjustment !== "number" || typeof parsed.insight !== "string") return;

      await ctx.runMutation(internal.gptMatchingHelpers.applyAiAdjustment, {
        matchId,
        adjustment: parsed.adjustment,
        aiInsight: parsed.insight,
      });
    } catch {
      // Non-blocking by design.
    }
  },
});

export const generateInsightsForUser = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    const matches = await ctx.runQuery(internal.gptMatchingHelpers.getMatchesForCurrentUser, {});
    if (!matches) return;

    for (const match of matches) {
      if (match && !match.matchBreakdown?.aiInsight?.startsWith("Based on")) {
        try {
          await ctx.runAction(internal.gptMatching.generateInsight, {
            matchId: match._id as Id<"roommateMatches">,
          });
        } catch {
          // Continue with other matches if one fails
        }
      }
    }
  },
});
