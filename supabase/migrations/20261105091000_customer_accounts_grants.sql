-- Follow-up to 20261105090000_customer_accounts.sql: Supabase gives every new
-- function to logged-out visitors (anon) by default, and "revoke from public"
-- doesn't undo that. These three are only for signed-in people. (They already
-- refused or returned nothing without a login; now they are closed outright.)
revoke all on function public.my_bookings() from anon;
revoke all on function public.my_booking_link(uuid) from anon;
revoke all on function public.claim_booking_by_token(text) from anon;
