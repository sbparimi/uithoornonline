# Uithoorn.online platform setup

## 1. Create Supabase project
Create a Supabase project and copy its Project URL and anon key.

## 2. Run database setup
In Supabase SQL Editor, run in order:

1. `supabase/schema.sql`
2. `supabase/002_platform_extensions.sql`
3. `supabase/003_matching_rules.sql`

The schema creates authentication-linked profiles, provider businesses, service requests, provider matching, conversations, messages, notifications, workshop/RSVP tables, realtime publication, and row-level security.

## 3. Configure authentication
Enable email authentication in Supabase Auth. Set the Site URL to `https://uithoorn.online` and add `https://uithoorn.online/auth/callback` as an allowed redirect URL. For local development also allow the local callback URL.

## 4. Configure Vercel environment variables
Set these for Production and Preview:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL=https://uithoorn.online`

Optional email integration variables are documented in `.env.example`.

## 5. Create the first platform admin
After registering an account, set that user's `profiles.role` to `admin` in the Supabase SQL editor. The admin can then verify provider businesses at `/admin`.

## 6. Launch validation
Use two separate accounts to validate the full platform path:

Customer → request → provider match → provider acceptance → conversation → realtime messages.

Do not mark the platform production-ready until cross-account access and RLS isolation are verified.
