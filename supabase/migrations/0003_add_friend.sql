-- =====================================================================
-- 0003 친구 추가
--   - search_users : 이메일(정확히 일치) 또는 이름(부분 일치)으로 사용자 검색
--                    이메일은 결과에 포함하지 않는다 (auth.users 는 서버 내부에서만 참조)
--   - add_friend   : 상대 동의 없이 바로 친구 추가, 양방향 2 row 를 한 번에 생성
-- =====================================================================

create or replace function public.search_users(p_query text)
returns table (id uuid, display_name text, avatar_url text, status_message text, is_friend boolean)
language sql stable security definer set search_path = public as $$
  with q as (select btrim(coalesce(p_query, '')) as v)
  select p.id, p.display_name, p.avatar_url, p.status_message,
         exists (select 1 from friendships f where f.user_id = auth.uid() and f.friend_id = p.id) as is_friend
    from q, profiles p
    join auth.users u on u.id = p.id
   where auth.uid() is not null
     and p.id <> auth.uid()
     and char_length(q.v) >= 2
     and (lower(u.email) = lower(q.v)
          or p.display_name ilike '%' || replace(replace(replace(q.v, '\', '\\'), '%', '\%'), '_', '\_') || '%')
   order by (lower(u.email) = lower(q.v)) desc, p.display_name
   limit 20;
$$;

create or replace function public.add_friend(p_friend uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if p_friend is null or p_friend = auth.uid() then
    raise exception '자기 자신은 친구로 추가할 수 없습니다.' using errcode = '22023';
  end if;
  if not exists (select 1 from profiles where id = p_friend) then
    raise exception '사용자를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  insert into friendships (user_id, friend_id)
  values (auth.uid(), p_friend), (p_friend, auth.uid())
  on conflict do nothing;
end $$;

revoke all on function public.search_users(text) from public, anon;
revoke all on function public.add_friend(uuid) from public, anon;
grant execute on function public.search_users(text) to authenticated;
grant execute on function public.add_friend(uuid) to authenticated;
