-- 3차 업데이트 (2026-11-27): 푸시 알림
-- Supabase > SQL Editor > + (새 쿼리) 에 이 파일 내용만 붙여넣고 Run 하세요. 한 번만 실행합니다.

-- 알림을 켠 기기 목록
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push: own read" on public.push_subscriptions;
create policy "push: own read" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());

-- 같은 알림을 두 번 보내지 않기 위한 기록 (서버만 사용)
create table if not exists public.push_log (key text primary key, sent_at timestamptz not null default now());
alter table public.push_log enable row level security;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;

create or replace function public.delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- 새 모임 개설, 모임장 승인 시 사이트 서버에 알림 요청
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_app() returns trigger
language plpgsql security definer set search_path = public as $$
declare payload jsonb;
begin
  if tg_table_name = 'gatherings' and tg_op = 'INSERT' then
    payload := jsonb_build_object('kind', 'new_gathering', 'id', new.id);
  elsif tg_table_name = 'leader_applications' and new.status = 'approved' and old.status is distinct from 'approved' then
    payload := jsonb_build_object('kind', 'leader_approved', 'id', new.id);
  end if;
  if payload is not null then
    perform net.http_post(url := 'https://mmbc-app.vercel.app/api/notify', body := payload,
                          headers := '{"Content-Type": "application/json"}'::jsonb);
  end if;
  return new;
end $$;

drop trigger if exists gatherings_notify on public.gatherings;
create trigger gatherings_notify after insert on public.gatherings for each row execute function public.notify_app();
drop trigger if exists applications_notify on public.leader_applications;
create trigger applications_notify after update on public.leader_applications for each row execute function public.notify_app();
