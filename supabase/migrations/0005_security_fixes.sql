-- Lock down allowed_emails (only the SECURITY DEFINER trigger function should read it)
alter table public.allowed_emails enable row level security;

-- These are trigger-only functions; they must not be callable as public RPC endpoints.
revoke execute on function public.check_allowed_email() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
