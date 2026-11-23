# Hosting KEYGUARD

## Architecture

- Vercel hosts the TanStack Start application and server rendering.
- Supabase Auth signs users in; each account gets a separate register snapshot in Postgres.
- Row Level Security restricts each snapshot to its owner. The browser uses only the publishable key.
- KEYGUARD's existing `KeyService` remains the single source for demo business rules and keeps a browser-local copy for offline use.

## Supabase project

- Project: `keyguard-backend`
- Project ref: `lxflrxwsnvksgvanvnjd`
- Region: `ap-south-1` (Mumbai)
- Apply [`supabase/schema.sql`](supabase/schema.sql) to create the protected register table.

## Vercel environment variables

Set these for Production, Preview, and Development. Use the project's URL and publishable key from Supabase; never use a secret/service-role key in a browser variable.

```text
VITE_SUPABASE_URL=https://lxflrxwsnvksgvanvnjd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
```

For email confirmation, set the Supabase Auth Site URL to `https://take-the-key-lead.vercel.app` and add `https://take-the-key-lead.vercel.app/**` to the allowed redirect URLs. Add only the exact preview domains you intend to use. The sign-up flow also passes the current site origin as its redirect target, and users can request a replacement confirmation email if a link expires.

The app supports browser-only demo mode when these variables are absent. When configured, accounts sign in before opening the cloud-backed register.
