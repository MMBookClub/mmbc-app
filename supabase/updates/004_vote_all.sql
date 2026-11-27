-- 4차 업데이트 (2026-11-27): 우수참여자 투표를 세션 참여자 모두가 할 수 있게
-- Supabase > SQL Editor > + (새 쿼리) 에 이 내용만 붙여넣고 Run 하세요.

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
