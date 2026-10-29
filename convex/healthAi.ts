"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";

const MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"];
// Only the first few are probed to spare the free-tier quota; the rest stay at the end of the order.
const PROBED = MODELS.slice(0, 3);

// Runs every 5 minutes: pings each Gemini model, ranks them by speed, and stores the order so the
// AI features always try the healthiest model first (and skip broken ones).
export const checkModels = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;
    const ai = new GoogleGenAI({ apiKey });
    const results = await Promise.all(
      PROBED.map(async (model) => {
        const t = Date.now();
        try {
          await Promise.race([
            ai.models.generateContent({ model, contents: "Reply with OK", config: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 8 } as any }),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
          ]);
          return { model, ok: true, ms: Date.now() - t };
        } catch (e: any) {
          return { model, ok: false, ms: Date.now() - t, error: String(e?.message ?? e).slice(0, 80) };
        }
      })
    );
    const order = [...results.filter((r) => r.ok).sort((a, b) => a.ms - b.ms), ...results.filter((r) => !r.ok)].map((r) => r.model);
    const full = [...order, ...MODELS.filter((m) => !order.includes(m))];
    await ctx.runMutation(internal.health.saveAiState, { order: full, results });
  },
});
