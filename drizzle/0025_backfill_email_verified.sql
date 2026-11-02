-- This app has no email-verification flow at all — every account is either created directly by
-- an instance admin or synced from an authoritative LDAP directory, so `email_verified` was never
-- meaningful here and had no way to ever become true. Backfilling existing rows so the "email not
-- verified" badge clears for accounts created before auth.api.createUser started passing
-- emailVerified: true explicitly.
UPDATE `user` SET `email_verified` = true WHERE `email_verified` = false;
