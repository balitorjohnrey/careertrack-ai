-- Run after 001_careertrack.sql. Existing profiles start with initials.
begin;

alter table public.profiles add column if not exists photo_jpeg text
  check (length(photo_jpeg) between 8 and 32768
    and length(photo_jpeg) % 4 = 0
    and photo_jpeg ~ '^/9j/[A-Za-z0-9+/]*={0,2}$');

create or replace function public.ct_profile_photo(photo text) returns void
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := careertrack_private.member();
begin
  update public.profiles set photo_jpeg = photo where id = owner_id;
end $$;

revoke all on function public.ct_profile_photo(text) from public, anon, authenticated;
grant execute on function public.ct_profile_photo(text) to authenticated;
notify pgrst, 'reload schema';
commit;
