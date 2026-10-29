import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { MutationCtx } from "./_generated/server";

// Emails that are automatically granted admin access when their user record
// is first created. Edit this list to add/remove admins.
const ADMIN_EMAILS = ["asadrafi1221@gmail.com"];

// Password reset by email: the user gets an 8-digit code (valid 15 min) and sets a new password with it.
// Emails go out through EmailJS (EMAILJS_* env vars) or, as a fallback, Resend (RESEND_API_KEY + AUTH_EMAIL_FROM).
const PasswordResetEmail = Email({
  id: "tv-password-reset",
  maxAge: 60 * 15,
  async generateVerificationToken() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return String(a[0] % 100000000).padStart(8, "0");
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const env = process.env;
    // Preferred: EmailJS (works from your own Gmail/SMTP, no domain to verify).
    if (env.EMAILJS_SERVICE_ID && env.EMAILJS_TEMPLATE_ID && env.EMAILJS_PUBLIC_KEY) {
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: env.EMAILJS_SERVICE_ID,
          template_id: env.EMAILJS_TEMPLATE_ID,
          user_id: env.EMAILJS_PUBLIC_KEY,
          ...(env.EMAILJS_PRIVATE_KEY ? { accessToken: env.EMAILJS_PRIVATE_KEY } : {}),
          template_params: { to_email: email, code: token, app_name: "TraderVault.PRO" },
        }),
      });
      if (!res.ok) throw new Error("Couldn't send the reset email — please try again later.");
      return;
    }
    // Fallback: Resend (needs a verified domain).
    const key = env.RESEND_API_KEY;
    const from = env.AUTH_EMAIL_FROM;
    if (!key || !from) throw new Error("Password reset email isn't set up yet.");
    const html = `<div style="font-family:Arial,sans-serif;background:#f4f4f5;padding:24px">
      <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden">
        <div style="background:#000;color:#fff;padding:22px 26px;font-size:20px;font-weight:700">TraderVault<span style="color:#5be58f">.PRO</span></div>
        <div style="padding:26px">
          <p style="margin:0 0 14px;color:#0b0b0c;font-size:16px">Use this code to reset your password:</p>
          <p style="margin:0 0 18px;font-size:34px;letter-spacing:6px;font-weight:800;color:#10733d">${token}</p>
          <p style="margin:0;color:#64748b;font-size:13px">It works for 15 minutes. If you didn't ask for this, you can ignore this email — your password stays the same.</p>
        </div>
      </div></div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Your TraderVault.PRO reset code: ${token}`,
        html,
        text: `Your TraderVault.PRO password reset code is ${token}. It works for 15 minutes. If you didn't ask for this, ignore this email.`,
      }),
    });
    if (!res.ok) throw new Error("Couldn't send the reset email — please try again later.");
  },
});

const CustomPassword = Password({
  reset: PasswordResetEmail,
  profile(params) {
    return {
      email: params.email as string,
      name: ((params.name as string) || (params.email as string)).trim(),
    };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [CustomPassword],
  callbacks: {
    async createOrUpdateUser(genericCtx, args) {
      // Returning user signing back in — keep their existing row as-is.
      if (args.existingUserId) {
        return args.existingUserId;
      }

      // Convex Auth types this callback's ctx generically (AnyDataModel);
      // at runtime it's this app's own mutation ctx, so cast to get our
      // schema's table/index types back.
      const ctx = genericCtx as unknown as MutationCtx;

      const email = ((args.profile.email as string | undefined) ?? "").toLowerCase().trim();

      const banned = email
        ? await ctx.db
            .query("bannedEmails")
            .withIndex("by_email", (q) => q.eq("email", email))
            .first()
        : null;
      if (banned) {
        throw new Error("This account has been removed by an administrator.");
      }

      // A user with this email already exists (e.g. from before this auth
      // migration) — attach this sign-in to that existing row instead of
      // creating a duplicate, so their trades/history carry over.
      const existing = email
        ? await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .first()
        : null;
      if (existing) return existing._id;

      const startingBalance = 100000;
      const currency = "USD";

      const userId = await ctx.db.insert("users", {
        name: (args.profile.name as string | undefined) || email || "Trader",
        email,
        avatar: (args.profile.image as string | undefined) || undefined,
        bio: "Private retail trader.",
        preferredInstruments: ["EURUSD", "XAUUSD"],
        currency,
        timezone: "America/New_York (EST)",
        defaultRiskPercentage: 1.0,
        defaultAccountBalance: startingBalance,
        theme: "light",
        leaderboardVisible: true,
        isAdmin: ADMIN_EMAILS.includes(email),
        isBlocked: false,
      });

      const accountId = await ctx.db.insert("accounts", {
        userId,
        name: "Default Account",
        broker: "Demo Broker",
        type: "demo",
        currency,
        startingBalance,
        currentBalance: startingBalance,
        isDefault: true,
      });

      await ctx.db.patch(userId, { defaultAccountId: accountId });

      return userId;
    },
  },
});
