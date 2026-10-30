-- Optional public contact email on a business listing (shown as a mailto line on the profile page).
-- Separate from the owner's login email (users.email), which stays private. Nullable; never backfilled
-- from login emails, because some of those are personal addresses.
alter table businesses add column if not exists public_email text
  check (public_email is null or (char_length(public_email) <= 254 and public_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
