-- MMBC (Morning Money Book Club) 데이터베이스
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run 하세요. (한 번만)

create extension if not exists pgcrypto;

-- ───────── 회원 ─────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique check (char_length(nickname) between 1 and 20),
  industry text not null default '',
  role text not null default 'member' check (role in ('member','leader','admin')),
  created_at timestamptz not null default now()
);

-- 선택 정보(성함, 나이)는 본인과 클럽장만 볼 수 있게 따로 보관
create table public.member_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  name text,
  age int check (age is null or age between 1 and 120)
);

-- 가입하면 auth.users 에 만들어진 계정으로 프로필 자동 생성
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, industry)
  values (new.id, trim(new.raw_user_meta_data->>'nickname'), coalesce(new.raw_user_meta_data->>'industry',''));
  insert into public.member_private (id, name, age)
  values (new.id, nullif(new.raw_user_meta_data->>'name',''), nullif(new.raw_user_meta_data->>'age','')::int);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- ───────── 모임장 신청 ─────────
create table public.leader_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  bank text not null,
  account_no text not null,
  account_holder text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ───────── 모임(세션) ─────────
create table public.gatherings (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'regular' check (kind in ('regular','special')),
  category text not null,
  title text not null,
  inviter text,                      -- 특별세션 초대자
  description text,
  leader_id uuid not null references public.profiles(id),
  capacity int not null check (capacity between 1 and 200),
  location text not null,
  s1_at timestamptz not null,
  s2_at timestamptz,
  bank text,
  account_no text,
  account_holder text,
  deposit int not null default 20000,
  book_cost int not null default 0,
  cover_url text,                    -- 책 사진 주소
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table public.participations (
  id uuid primary key default gen_random_uuid(),
  gathering_id uuid not null references public.gatherings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  s1_absent boolean not null default false,
  s1_late boolean not null default false,
  s1_hw boolean not null default false,
  s2_absent boolean not null default false,
  s2_late boolean not null default false,
  s2_hw boolean not null default false,
  created_at timestamptz not null default now(),
  unique (gathering_id, user_id)
);

create or replace function public.is_leader_of(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.gatherings where id = g and leader_id = auth.uid())
$$;
create or replace function public.is_member_of(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.participations
                where gathering_id = g and user_id = auth.uid() and status <> 'rejected')
$$;

-- ───────── 과제 게시글 / 댓글 ─────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  gathering_id uuid not null references public.gatherings(id) on delete cascade,
  session_no int not null default 1 check (session_no in (1,2)),
  title text not null,
  body text not null,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ───────── 우수참여자 투표 (익명) ─────────
create table public.votes (
  gathering_id uuid not null references public.gatherings(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gathering_id, voter_id)
);

-- ───────── 보안 규칙 (RLS) ─────────
alter table public.profiles enable row level security;
alter table public.member_private enable row level security;
alter table public.leader_applications enable row level security;
alter table public.gatherings enable row level security;
alter table public.participations enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.votes enable row level security;

create policy "profiles readable by members" on public.profiles for select to authenticated using (true);
create policy "private: self or admin" on public.member_private for select to authenticated using (id = auth.uid() or public.is_admin());

create policy "apps: own or admin read" on public.leader_applications for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "apps: insert own" on public.leader_applications for insert to authenticated with check (user_id = auth.uid() and status = 'pending');

create policy "gatherings readable" on public.gatherings for select to authenticated using (true);
create policy "gatherings insert by leader" on public.gatherings for insert to authenticated
  with check (leader_id = auth.uid() and (
    (kind = 'regular' and public.my_role() in ('leader','admin')) or (kind = 'special' and public.is_admin())));
create policy "gatherings update by owner" on public.gatherings for update to authenticated
  using (leader_id = auth.uid() or public.is_admin()) with check (leader_id = auth.uid() or public.is_admin());

create policy "parts read" on public.participations for select to authenticated
  using (user_id = auth.uid() or public.is_leader_of(gathering_id) or public.is_member_of(gathering_id) or public.is_admin());
create policy "parts update by leader" on public.participations for update to authenticated
  using (public.is_leader_of(gathering_id) or public.is_admin());

create policy "posts read" on public.posts for select to authenticated
  using (public.is_member_of(gathering_id) or public.is_leader_of(gathering_id) or public.is_admin());
create policy "posts write by leader" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and (public.is_leader_of(gathering_id) or public.is_admin()));

create policy "comments read" on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "comments write" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));

create policy "votes own read" on public.votes for select to authenticated using (voter_id = auth.uid());

-- ───────── 기능 함수 ─────────

-- 모임 목록(로그인 전에도 보임; 계좌는 로그인 회원에게만)
create or replace function public.list_gatherings()
returns table (id uuid, kind text, category text, title text, inviter text, description text,
  leader_id uuid, leader_nickname text, capacity int, location text, s1_at timestamptz, s2_at timestamptz,
  bank text, account_no text, account_holder text, deposit int, book_cost int, status text, created_at timestamptz,
  confirmed_count bigint, pending_count bigint, my_status text, cover_url text)
language sql stable security definer set search_path = public as $$
  select g.id, g.kind, g.category, g.title, g.inviter, g.description, g.leader_id, p.nickname, g.capacity, g.location,
    g.s1_at, g.s2_at,
    case when auth.uid() is null then null else g.bank end,
    case when auth.uid() is null then null else g.account_no end,
    case when auth.uid() is null then null else g.account_holder end,
    g.deposit, g.book_cost, g.status, g.created_at,
    (select count(*) from participations x where x.gathering_id = g.id and x.status = 'confirmed'),
    (select count(*) from participations x where x.gathering_id = g.id and x.status = 'pending'),
    (select x.status from participations x where x.gathering_id = g.id and x.user_id = auth.uid()),
    g.cover_url
  from gatherings g join profiles p on p.id = g.leader_id
  order by g.s1_at asc
$$;
grant execute on function public.list_gatherings() to anon, authenticated;

create or replace function public.join_gathering(g uuid) returns void
language plpgsql security definer set search_path = public as $$
declare gg gatherings;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  select * into gg from gatherings where id = g;
  if gg.id is null or gg.status <> 'open' then raise exception '모집이 끝난 모임입니다'; end if;
  if gg.leader_id = auth.uid() then raise exception '내가 연 모임입니다'; end if;
  insert into participations (gathering_id, user_id) values (g, auth.uid())
    on conflict (gathering_id, user_id) do nothing;
end $$;

create or replace function public.apply_leader(p_reason text, p_bank text, p_account_no text, p_holder text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if exists (select 1 from leader_applications where user_id = auth.uid() and status = 'pending') then
    raise exception '이미 신청한 내역이 있습니다'; end if;
  insert into leader_applications (user_id, reason, bank, account_no, account_holder)
    values (auth.uid(), p_reason, p_bank, p_account_no, p_holder);
end $$;

create or replace function public.decide_application(app uuid, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception '클럽장만 할 수 있습니다'; end if;
  update leader_applications set status = case when approve then 'approved' else 'rejected' end, decided_at = now()
    where id = app returning user_id into uid;
  if approve then update profiles set role = 'leader' where id = uid and role = 'member'; end if;
end $$;

create or replace function public.set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '클럽장만 할 수 있습니다'; end if;
  if target = auth.uid() then raise exception '내 등급은 바꿀 수 없습니다'; end if;
  update profiles set role = new_role where id = target;
end $$;

create or replace function public.list_members() returns table
  (id uuid, nickname text, industry text, role text, created_at timestamptz, name text, age int)
language sql stable security definer set search_path = public as $$
  select p.id, p.nickname, p.industry, p.role, p.created_at, m.name, m.age
  from profiles p left join member_private m on m.id = p.id
  where public.is_admin() order by p.created_at desc
$$;

create or replace function public.cast_vote(g uuid, candidate uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member_of(g) and not public.is_leader_of(g) then
    raise exception '세션 참여자만 투표할 수 있습니다'; end if;
  if exists (select 1 from gatherings where id = g and status = 'closed') then
    raise exception '종료된 모임입니다'; end if;
  if not exists (select 1 from participations where gathering_id = g and user_id = candidate and status <> 'rejected') then
    raise exception '후보가 아닙니다'; end if;
  if candidate = auth.uid() then raise exception '자기 자신에게는 투표할 수 없습니다'; end if;
  insert into votes (gathering_id, voter_id, candidate_id) values (g, auth.uid(), candidate)
    on conflict (gathering_id, voter_id) do update set candidate_id = excluded.candidate_id, created_at = now();
end $$;

create or replace function public.vote_results(g uuid) returns table (candidate_id uuid, nickname text, votes bigint)
language sql stable security definer set search_path = public as $$
  select v.candidate_id, p.nickname, count(*) from votes v join profiles p on p.id = v.candidate_id
  where v.gathering_id = g and (public.is_member_of(g) or public.is_leader_of(g) or public.is_admin())
  group by v.candidate_id, p.nickname order by 3 desc
$$;

-- ───────── 책 사진 저장소 ─────────
insert into storage.buckets (id, name, public) values ('covers', 'covers', true) on conflict (id) do nothing;
create policy "covers: members upload" on storage.objects for insert to authenticated with check (bucket_id = 'covers' and public.my_role() in ('leader','admin'));

-- 첫 클럽장 지정: 가입한 뒤 아래 줄의 닉네임을 바꿔 한 번 실행하세요.
-- update public.profiles set role = 'admin' where nickname = 'TONY';
