-- 2차 업데이트 (2026-11-27): 책 사진 기능
-- Supabase > SQL Editor > + (새 쿼리) 에 이 파일 내용만 붙여넣고 Run 하세요. 한 번만 실행합니다.

alter table public.gatherings add column if not exists cover_url text;

drop function if exists public.list_gatherings();
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

insert into storage.buckets (id, name, public) values ('covers', 'covers', true) on conflict (id) do nothing;
create policy "covers: members upload" on storage.objects for insert to authenticated with check (bucket_id = 'covers' and public.my_role() in ('leader','admin'));
