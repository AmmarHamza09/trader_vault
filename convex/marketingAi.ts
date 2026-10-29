"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";
import { api } from "./_generated/api";
import { genWithRetry } from "./ai";

const BRIEF = `TraderVault.PRO is a trading journal for prop-firm and gold traders: AI coach, prop-firm phase tracking (static/trailing drawdown, instant funded), screenshot import from MT5/TradingView, TradingView alert sync, analytics (equity, drawdown, win rate by session/hour), leaderboard, read-only share links, psychology tracking. Backtesting and a Pine-style script editor are COMING SOON (never say they are available).`;

const PLATFORM_RULES: Record<string, string> = {
  facebook: "Friendly, emoji-friendly, 40-80 words, 4-6 hashtags, end with a call to action 'link in bio' style.",
  instagram: "Punchy hook first line, emojis, 30-70 words, 6-10 hashtags, call to action 'link in bio'.",
  whatsapp: "Very short status text, max 25 words, 1-2 emojis, no hashtags.",
  linkedin: "Professional founder voice, short story + one lesson, 60-110 words, max 4 hashtags, no hype, no emojis spam.",
  x: "Under 260 characters including hashtags, 1-2 hashtags, one hook.",
};

export const generatePost = action({
  args: { platform: v.string(), angle: v.string() },
  handler: async (ctx, { platform, angle }) => {
    await ctx.runQuery(api.marketing.isAdmin, {});
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    const rules = PLATFORM_RULES[platform] ?? PLATFORM_RULES.facebook;
    const ai = new GoogleGenAI({ apiKey });
    const res = await genWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: `${BRIEF}\n\nWrite ONE social media post for ${platform}. Angle: ${angle}.\nRules: ${rules}\nNo profit promises, no signals, no fake testimonials, no invented numbers. Output only the post text.`,
    });
    return (res.text ?? "").trim();
  },
});

const AGENT_SYSTEM = `You are the TraderVault.PRO marketing agent, talking to the founder inside their admin panel. ${BRIEF}
You help plan campaigns, write posts, reply to comments, suggest posting times (evening Pakistan time) and review ideas. Be concise, friendly, practical.
Platform rules: ${Object.entries(PLATFORM_RULES).map(([k, r]) => `${k}: ${r}`).join(" | ")}
Whenever you write a post that is ready to publish, wrap EACH post exactly like this so the app can queue it:
[[POST platform=<facebook|instagram|whatsapp|linkedin|x> image=<01-12 or none>]]
post text
[[/POST]]
Available ad images: 01 launch, 02 AI coach, 03 prop firm, 04 screenshot import, 05 TradingView sync, 06 analytics, 07 backtesting (coming soon), 08 pine scripts (coming soon), 09 share link, 10 leaderboard, 11 psychology, 12 call to action.
Rules: never promise profits, give signals, invent results/testimonials or numbers; never say backtesting or the Pine editor are available. You cannot publish anything yourself — the founder presses the post buttons. Never ask for passwords.`;

export const agentChat = action({
  args: { messages: v.array(v.object({ role: v.string(), text: v.string() })) },
  handler: async (ctx, { messages }) => {
    await ctx.runQuery(api.marketing.isAdmin, {});
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    const contents = messages.slice(-20).map((m) => ({ role: m.role === "agent" ? "model" : "user", parts: [{ text: m.text.slice(0, 4000) }] }));
    if (!contents.length || contents[contents.length - 1].role !== "user") throw new Error("Type a message first.");
    const ai = new GoogleGenAI({ apiKey });
    const res = await genWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents,
      config: { systemInstruction: AGENT_SYSTEM },
    });
    return (res.text ?? "").trim() || "I couldn't come up with a reply — try rephrasing?";
  },
});
