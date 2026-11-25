-- Apply once to a fresh Supabase project. All API routines use the signed-in user's ID.
begin;
create schema careertrack_private;
revoke all on schema careertrack_private from public, anon, authenticated;

create type public.application_stage as enum
  ('Saved','Applied','Assessment','Interview','Offer','Rejected','Withdrawn');
create type public.feedback_kind as enum ('skills','resume','progress');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check(length(full_name)<=100),
  program text not null default '' check(length(program)<=120),
  graduation_year int check(graduation_year between 1950 and 2150),
  contact text not null default '' check(length(contact)<=200),
  is_admin boolean not null default false, suspended boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.job_opportunities (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles on delete cascade,
  employer text not null check(length(trim(employer)) between 1 and 160),
  position text not null check(length(trim(position)) between 1 and 160),
  location text not null default '' check(length(location)<=160),
  requirements text not null default '' check(length(requirements)<=8000),
  source_url text not null default '' check(source_url='' or (source_url ~* '^https?://' and length(source_url)<=2048)),
  deadline date, unique(owner_id,id), check(trim(requirements)<>'' or source_url<>'')
);
create table public.applications (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles on delete cascade,
  opportunity_id uuid not null, status public.application_stage not null default 'Saved',
  date_saved date not null, date_applied date,
  resume_version text not null default '' check(length(resume_version)<=160),
  notes text not null default '' check(length(notes)<=4000),
  updated_at timestamptz not null default now(),
  foreign key(owner_id,opportunity_id) references public.job_opportunities(owner_id,id) on delete cascade,
  unique(owner_id,id)
);
create table public.resume_profiles (
  owner_id uuid primary key references public.profiles on delete cascade,
  summary text not null default '' check(length(summary)<=4000),
  skills text not null default '' check(length(skills)<=2000),
  experience text not null default '' check(length(experience)<=4000)
);
create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  kind public.feedback_kind not null, output_text text not null check(length(trim(output_text)) between 1 and 6000),
  input_hash text not null check(length(input_hash)<=64), edited boolean not null default false,
  report_reason text check(report_reason in ('Inaccurate information','Biased wording','Irrelevant advice','Other concern')),
  created_at timestamptz not null default now()
);
create table careertrack_private.reminders (
  application_id uuid not null references public.applications on delete cascade, deadline date not null,
  window_days int not null check(window_days in (1,7)), shown_at timestamptz not null default now(),
  acknowledged_at timestamptz, primary key(application_id,deadline,window_days)
);
create table careertrack_private.ai_usage (
  id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles on delete set null,
  requested_at timestamptz not null default now(), failed boolean not null default false
);
create index on careertrack_private.ai_usage(requested_at);
create index on public.applications(owner_id);
create index on public.job_opportunities(owner_id);
create index on public.ai_feedback(owner_id);
create table careertrack_private.admin_log (
  id bigint generated always as identity primary key, actor uuid references public.profiles on delete set null,
  action text not null, subject uuid references public.profiles on delete set null,
  reason text, occurred_at timestamptz not null default now()
);
create table careertrack_private.stages (status public.application_stage primary key, ordering int not null);
insert into careertrack_private.stages select s, ord from unnest(enum_range(null::public.application_stage)) with ordinality as x(s,ord);

create function careertrack_private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,full_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),100));
  insert into public.resume_profiles(owner_id) values(new.id);
  return new;
end $$;
create trigger careertrack_signup after insert on auth.users for each row execute function careertrack_private.create_profile();
insert into public.profiles(id,full_name) select id,left(coalesce(raw_user_meta_data->>'full_name',''),100) from auth.users;
insert into public.resume_profiles(owner_id) select id from public.profiles;

create function public.ct_active() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and not suspended)
$$;
create function careertrack_private.member() returns uuid language plpgsql stable set search_path='' as $$
begin
  if not public.ct_active() then raise exception 'Account unavailable' using errcode='42501'; end if;
  return auth.uid();
end $$;
do $$
declare t text; owner_col text;
begin
  foreach t in array array['profiles','job_opportunities','applications','resume_profiles','ai_feedback'] loop
    owner_col := case when t='profiles' then 'id' else 'owner_id' end;
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy own_records on public.%I for select to authenticated using (%I=(select auth.uid()) and (select public.ct_active()))',t,owner_col);
  end loop;
end $$;

create function public.ct_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=careertrack_private.member();
begin
  return jsonb_build_object(
    'profile',(select to_jsonb(p) from public.profiles p where id=u),
    'resume',(select to_jsonb(r) from public.resume_profiles r where owner_id=u),
    'stages',(select jsonb_agg(status order by ordering) from careertrack_private.stages),
    'applications',coalesce((select jsonb_agg((to_jsonb(j)-'id') || to_jsonb(a) order by a.updated_at desc,a.id)
      from public.applications a join public.job_opportunities j on j.id=a.opportunity_id and j.owner_id=u where a.owner_id=u),'[]'),
    'feedback',coalesce((select jsonb_agg(to_jsonb(f) order by created_at desc) from public.ai_feedback f where owner_id=u),'[]'),
    'reminders',coalesce((select jsonb_agg(to_jsonb(r)) from careertrack_private.reminders r join public.applications a on a.id=r.application_id where a.owner_id=u),'[]'));
end $$;

create function public.ct_profile(data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=careertrack_private.member();
begin
  update public.profiles set full_name=trim(data->>'full_name'), program=data->>'program',
    graduation_year=nullif(data->>'graduation_year','')::int, contact=data->>'contact' where id=u;
end $$;
create function public.ct_resume(data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=careertrack_private.member();
begin
  update public.resume_profiles set summary=data->>'summary',skills=data->>'skills',experience=data->>'experience' where owner_id=u;
end $$;
create function public.ct_application(data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=careertrack_private.member(); aid uuid:=(data->>'id')::uuid; jid uuid;
begin
  if aid is not null then
    select opportunity_id into strict jid from public.applications where id=aid and owner_id=u for update;
    update public.job_opportunities set employer=trim(data->>'employer'),position=trim(data->>'position'),location=data->>'location',
      requirements=data->>'requirements',source_url=data->>'source_url',deadline=nullif(data->>'deadline','')::date where id=jid and owner_id=u;
    update public.applications set status=(data->>'status')::public.application_stage,date_saved=(data->>'date_saved')::date,
      date_applied=nullif(data->>'date_applied','')::date,resume_version=data->>'resume_version',notes=data->>'notes',updated_at=now() where id=aid and owner_id=u;
  else
    insert into public.job_opportunities(owner_id,employer,position,location,requirements,source_url,deadline)
      values(u,trim(data->>'employer'),trim(data->>'position'),data->>'location',data->>'requirements',data->>'source_url',nullif(data->>'deadline','')::date) returning id into jid;
    insert into public.applications(owner_id,opportunity_id,status,date_saved,date_applied,resume_version,notes)
      values(u,jid,(data->>'status')::public.application_stage,(data->>'date_saved')::date,nullif(data->>'date_applied','')::date,data->>'resume_version',data->>'notes') returning id into aid;
  end if;
  return aid;
end $$;
create function public.ct_remove_application(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=careertrack_private.member(); jid uuid;
begin
  delete from public.applications where id=target and owner_id=u returning opportunity_id into strict jid;
  delete from public.job_opportunities j where j.id=jid and owner_id=u and not exists(select 1 from public.applications a where a.opportunity_id=jid);
end $$;
create function public.ct_reminder(target uuid, due date, acknowledge boolean) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=careertrack_private.member(); days int:=due-(now() at time zone 'Asia/Manila')::date; w int;
begin
  if days not between 0 and 7 or not exists(select 1 from public.applications a join public.job_opportunities j on j.id=a.opportunity_id
      where a.id=target and a.owner_id=u and j.deadline=due and a.status not in ('Offer','Rejected','Withdrawn')) then raise exception 'Reminder has changed'; end if;
  w:=case when days<=1 then 1 else 7 end;
  insert into careertrack_private.reminders(application_id,deadline,window_days,acknowledged_at)
    values(target,due,w,case when acknowledge then now() end)
    on conflict(application_id,deadline,window_days) do update set acknowledged_at=coalesce(careertrack_private.reminders.acknowledged_at,excluded.acknowledged_at);
end $$;
create function public.ct_feedback(data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=careertrack_private.member(); aid uuid:=nullif(data->>'application_id','')::uuid; fid uuid;
begin
  if aid is not null then perform 1 from public.applications where id=aid and owner_id=u for key share;
    if not found then raise no_data_found; end if; end if;
  insert into public.ai_feedback(owner_id,application_id,kind,output_text,input_hash,edited,report_reason)
    values(u,aid,(data->>'kind')::public.feedback_kind,data->>'output_text',data->>'input_hash',(data->>'edited')::boolean,data->>'report_reason') returning id into fid;
  return fid;
end $$;
create function public.ct_manage_feedback(target uuid, action text, value text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=careertrack_private.member();
begin
  if action='delete' then delete from public.ai_feedback where id=target and owner_id=u;
  elsif action='report' then update public.ai_feedback set report_reason=value where id=target and owner_id=u;
  elsif action='edit' then update public.ai_feedback set output_text=value,edited=true where id=target and owner_id=u;
  else raise exception 'Invalid action'; end if;
  if not found then raise no_data_found; end if;
end $$;
create function public.ct_reserve_ai() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=careertrack_private.member(); ticket uuid;
begin
  perform pg_advisory_xact_lock(415002);
  if (select count(*) from careertrack_private.ai_usage where requested_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')>=2000
    or (select count(*) from careertrack_private.ai_usage where owner_id=u and requested_at>now()-interval '7 days')>=10
    or exists(select 1 from careertrack_private.ai_usage where owner_id=u and requested_at>now()-interval '15 seconds')
    then raise exception 'AI request limit reached' using errcode='P0415'; end if;
  insert into careertrack_private.ai_usage(owner_id) values(u) returning id into ticket;
  return ticket;
end $$;
create function public.ct_ai_failure(ticket uuid) returns void language sql security definer set search_path='' as $$
  update careertrack_private.ai_usage set failed=true where id=ticket and owner_id=auth.uid()
$$;
create function public.ct_admin(action text, data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=careertrack_private.member(); target_id uuid; reason text:=trim(data->>'reason'); stages jsonb:=data->'stages';
begin
  if not exists(select 1 from public.profiles where id=u and is_admin) then raise exception 'Administrator required' using errcode='42501'; end if;
  if action in ('suspend','restore') then
    if coalesce(length(reason),0) not between 3 and 300 then raise exception 'Supply a documented reason'; end if;
    select id into strict target_id from auth.users where lower(email)=lower(trim(data->>'email'));
    if exists(select 1 from public.profiles where id=target_id and is_admin) then raise exception 'Administrator accounts are protected'; end if;
    update public.profiles set suspended=(action='suspend') where id=target_id;
  elsif action='stages' then
    if jsonb_typeof(stages) is distinct from 'array' or jsonb_array_length(stages)<>7 or
       (select count(distinct v::public.application_stage) from jsonb_array_elements_text(stages) x(v))<>7 then raise exception 'Choose all seven stages'; end if;
    update careertrack_private.stages s set ordering=x.n from jsonb_array_elements_text(stages) with ordinality x(v,n) where s.status::text=x.v;
  elsif action<>'overview' then raise exception 'Unknown admin action'; end if;
  insert into careertrack_private.admin_log(actor,action,subject,reason) values(u,action,target_id,reason);
  return jsonb_build_object('users',(select count(*) from public.profiles),'suspended',(select count(*) from public.profiles where suspended),
    'applications',(select count(*) from public.applications),'requests',(select count(*) from careertrack_private.ai_usage),
    'failures',(select count(*) from careertrack_private.ai_usage where failed),
    'complete',(select count(*) from public.applications a join public.job_opportunities j on j.id=a.opportunity_id where trim(j.employer)<>'' and trim(j.position)<>'' and (trim(j.requirements)<>'' or j.source_url<>'')),
    'shown',(select count(*) from careertrack_private.reminders),
    'acknowledged',(select count(*) from careertrack_private.reminders where (acknowledged_at at time zone 'Asia/Manila')::date<=deadline),
    'reports',coalesce((select jsonb_object_agg(r,n) from (select report_reason r,count(*) n from public.ai_feedback where report_reason is not null group by report_reason) q),'{}'),
    'audit_events',(select count(*) from careertrack_private.admin_log));
end $$;
create function public.ct_delete_account() returns void language sql security definer set search_path='' as $$
  delete from auth.users where id=auth.uid()
$$;
-- Only signed-in users enter the API. Service-role credentials are never required by the app.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as routine from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,3)='ct_' loop
    execute format('revoke all on function %s from public, anon, authenticated',r.routine);
    execute format('grant execute on function %s to authenticated',r.routine);
  end loop;
end $$;
commit;
