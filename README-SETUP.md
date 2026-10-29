# TraderVault.PRO — source code

A trading journal web app: React + Vite + Tailwind frontend, Convex backend (database, auth, server functions), deployed on Vercel.

## Run it locally
1. Install Node 20+.
2. `npm install`
3. `npx convex dev` — sign in to Convex, create a project. It writes `.env.local` for you and pushes the backend.
4. In another terminal: `npm run dev` and open http://localhost:3000

## Backend settings (Convex environment variables)
Set with `npx convex env set NAME value`. All optional unless noted.

| Name | What for |
|---|---|
| `GEMINI_API_KEY` | AI coach, screenshot import and AI features (free key at aistudio.google.com) |
| `RESEND_API_KEY`, `AUTH_EMAIL_FROM` | Password-reset emails |
| `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LS_VARIANT_PRO_MONTHLY`, `LS_VARIANT_PRO_YEARLY`, `LS_VARIANT_ELITE_MONTHLY`, `LS_VARIANT_ELITE_YEARLY` | Paid plans (subscriptions) |
| `APP_URL` | Public URL of the site (used in checkout redirects) |

Edit `ADMIN_EMAILS` in `convex/auth.ts` to choose who becomes admin on sign-up.

## Folders
- `src/` React app (components, pages, helpers)
- `convex/` backend: schema, queries/mutations/actions, crons, HTTP webhooks
- `public/` static files (logo, icons, service worker)
- `landing/` standalone copy of the marketing landing page (the live landing is `src/components/landing`)

No secrets are included in this archive.
