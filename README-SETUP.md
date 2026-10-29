# TraderVault.PRO — source code

A trading journal web app: React + Vite + Tailwind frontend, Convex backend (database, auth, server functions), deployed on Vercel.

## Run it locally
1. Install Node 20+.
2. `npm install`
3. `npx convex dev` — sign in to Convex, create a project. It writes `.env.local` for you and pushes the backend. **Keep this terminal running**; without it signup/sign-in fails.
4. In another terminal: `npm run dev` and open http://localhost:3000

### Local signup fails? (`Missing environment variable JWT_PRIVATE_KEY`)
Convex Auth needs signing keys on the backend. Run once:

```bash
npx @convex-dev/auth
```

and choose **Generate keys** — it sets `JWT_PRIVATE_KEY` and `JWKS` on the deployment. You can also generate them yourself and run:

```bash
npx convex env set JWT_PRIVATE_KEY "<PKCS8 PEM>"
npx convex env set JWKS '{"keys":[...]}'
npx convex env set SITE_URL http://localhost:3000
```

After that, restart nothing — just reload the page and sign up again. If a previous attempt said “account already exists”, that account was created before the keys were missing: sign in with the same password instead.

## Backend settings (Convex environment variables)
Set with `npx convex env set NAME value`. All optional unless noted.

| Name | What for |
|---|---|
| `JWT_PRIVATE_KEY`, `JWKS` | **Required** for Convex Auth (sign up / sign in). Generate with `npx @convex-dev/auth`. |
| `SITE_URL` | Public URL of the site (auth redirects); `http://localhost:3000` locally |
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
