-- =====================================================================
-- ArchiveTalk : 메신저 + 문서 영구 보관 플랫폼  (Supabase / PostgreSQL)
-- =====================================================================
-- 설계 원칙
--   1) 모든 권한 판단은 DB(RLS)에서 최종 집행한다. 프론트/API 검사는 UX용 보조 수단.
--   2) 문서는 "삭제"가 없다. 숨김(soft delete)만 가능하며 원본 파일·버전은 영구 보존.
--   3) Storage 버킷은 private. 파일 접근은 짧은 만료의 Signed URL로만 허용.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUM
-- ---------------------------------------------------------------------
create type system_role   as enum ('user', 'super_admin');
create type room_type     as enum ('direct', 'group', 'archive');   -- archive = 채팅 없는 문서 보관함
create type member_role   as enum ('owner', 'admin', 'member');
create type message_type  as enum ('text', 'image', 'document', 'system');
create type doc_action    as enum ('upload', 'new_version', 'view', 'download', 'hide', 'restore');

-- ---------------------------------------------------------------------
-- 1. 사용자 (auth.users 1:1 확장)
-- ---------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text        not null,
  avatar_url      text,
  status_message  text,
  system_role     system_role not null default 'user',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 친구 목록 (단방향 저장, 양방향 친구는 2 row)
create table public.friendships (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  favorite   boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ---------------------------------------------------------------------
-- 2. 채팅방 / 멤버
-- ---------------------------------------------------------------------
create table public.rooms (
  id                   uuid primary key default gen_random_uuid(),
  type                 room_type not null,
  name                 text,                       -- direct 방은 null (상대 이름으로 표시)
  avatar_url           text,
  direct_key           text unique,                -- direct 방 중복 방지: 'uuidA:uuidB' (정렬)
  created_by           uuid not null references public.profiles(id),
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz not null default now()
);

create table public.room_members (
  room_id      uuid not null references public.rooms(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         member_role not null default 'member',
  last_read_at timestamptz not null default now(),
  muted        boolean not null default false,
  joined_at    timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index on public.room_members (user_id);

-- ---------------------------------------------------------------------
-- 3. 영구 보관 문서 (+ 버전 이력)
-- ---------------------------------------------------------------------
create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms(id) on delete restrict,
  uploader_id      uuid not null references public.profiles(id),
  title            text not null,
  description      text,
  file_name        text not null,
  mime_type        text not null,
  size_bytes       bigint not null check (size_bytes > 0),
  current_version  int  not null default 1,
  storage_path     text not null,               -- 최신 버전 경로 (rooms/{room}/{doc}/v{n}/{file})
  checksum_sha256  text,                        -- 무결성 검증용
  is_hidden        boolean not null default false,  -- soft delete (목록에서만 숨김)
  hidden_at        timestamptz,
  hidden_by        uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.documents (room_id, created_at desc);

create table public.document_versions (
  id               bigint generated always as identity primary key,
  document_id      uuid not null references public.documents(id) on delete restrict,
  version          int  not null,
  storage_path     text not null unique,
  size_bytes       bigint not null,
  checksum_sha256  text,
  uploaded_by      uuid not null references public.profiles(id),
  created_at       timestamptz not null default now(),
  unique (document_id, version)
);

-- 감사 로그 (누가 언제 열람/다운로드했는가)
create table public.document_access_logs (
  id           bigint generated always as identity primary key,
  document_id  uuid not null references public.documents(id) on delete restrict,
  user_id      uuid not null references public.profiles(id),
  action       doc_action not null,
  version      int,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index on public.document_access_logs (document_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. 메시지
-- ---------------------------------------------------------------------
create table public.messages (
  id           bigint generated always as identity primary key,
  room_id      uuid not null references public.rooms(id) on delete cascade,
  sender_id    uuid references public.profiles(id),          -- system 메시지는 null
  type         message_type not null default 'text',
  content      text,
  document_id  uuid references public.documents(id),
  created_at   timestamptz not null default now(),
  check (type <> 'document' or document_id is not null)
);
create index on public.messages (room_id, created_at desc);

-- =====================================================================
-- 권한 헬퍼 (security definer → RLS 재귀 방지)
-- =====================================================================
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_members where room_id = p_room and user_id = auth.uid());
$$;

create or replace function public.is_room_admin(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members
     where room_id = p_room and user_id = auth.uid() and role in ('owner', 'admin')
  ) or exists (
    select 1 from profiles where id = auth.uid() and system_role = 'super_admin'
  );
$$;

-- =====================================================================
-- 트리거
-- =====================================================================

-- (a) 신규 가입 → profile 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- (b) 메시지 → 채팅방 목록의 마지막 메시지 갱신
create or replace function public.bump_room_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update rooms
     set last_message_at = new.created_at,
         last_message_preview = case new.type
           when 'document' then '📄 ' || coalesce(new.content, '문서')
           when 'image'    then '사진'
           else left(new.content, 100) end
   where id = new.room_id;
  return new;
end $$;
create trigger trg_messages_bump after insert on public.messages
  for each row execute function public.bump_room_last_message();

-- (c) ★ 영구 보존 보장: documents / versions / logs 의 물리 삭제 차단
--     service_role 키로도 지울 수 없다. (정말 필요하면 DBA가 트리거를 명시적으로 disable)
create or replace function public.forbid_delete()
returns trigger language plpgsql as $$
begin
  raise exception '[%] 영구 보존 대상은 삭제할 수 없습니다. is_hidden 플래그를 사용하세요.', tg_table_name
    using errcode = 'insufficient_privilege';
end $$;
create trigger trg_documents_no_delete before delete on public.documents
  for each row execute function public.forbid_delete();
create trigger trg_versions_no_delete before delete on public.document_versions
  for each row execute function public.forbid_delete();
create trigger trg_logs_no_delete before delete on public.document_access_logs
  for each row execute function public.forbid_delete();

-- (d) 버전 레코드는 불변(immutable)
create or replace function public.forbid_update()
returns trigger language plpgsql as $$
begin
  raise exception '[%] 불변 레코드는 수정할 수 없습니다.', tg_table_name;
end $$;
create trigger trg_versions_immutable before update on public.document_versions
  for each row execute function public.forbid_update();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles              enable row level security;
alter table public.friendships           enable row level security;
alter table public.rooms                 enable row level security;
alter table public.room_members          enable row level security;
alter table public.messages              enable row level security;
alter table public.documents             enable row level security;
alter table public.document_versions     enable row level security;
alter table public.document_access_logs  enable row level security;

-- profiles
create policy "profiles: 로그인 사용자 조회" on profiles for select to authenticated using (true);
create policy "profiles: 본인 수정" on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and system_role = (select system_role from profiles where id = auth.uid()));

-- friendships
create policy "friends: 본인 것만" on friendships for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- rooms (생성은 RPC create_group_room / get_or_create_direct_room 으로만)
create policy "rooms: 멤버 조회" on rooms for select to authenticated using (is_room_member(id));
create policy "rooms: 관리자 수정" on rooms for update to authenticated using (is_room_admin(id));

-- room_members
create policy "members: 같은 방 멤버 조회" on room_members for select to authenticated
  using (is_room_member(room_id));
create policy "members: 관리자 초대" on room_members for insert to authenticated
  with check (is_room_admin(room_id) and role = 'member');
create policy "members: 본인 읽음 처리" on room_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = (select role from room_members m
                                               where m.room_id = room_members.room_id and m.user_id = auth.uid()));
create policy "members: 방 나가기 / 관리자 강퇴" on room_members for delete to authenticated
  using (user_id = auth.uid() or (is_room_admin(room_id) and role = 'member'));

-- messages
create policy "messages: 멤버 조회" on messages for select to authenticated using (is_room_member(room_id));
create policy "messages: 멤버 전송 (문서 메시지는 관리자만)" on messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and is_room_member(room_id)
    and (type <> 'document' or is_room_admin(room_id))
    and type <> 'system'
  );

-- documents : 조회=멤버 / 등록·수정=관리자 / 삭제 정책 없음(=불가)
create policy "documents: 멤버 열람" on documents for select to authenticated
  using (is_room_member(room_id) and (not is_hidden or is_room_admin(room_id)));
create policy "documents: 관리자 업로드" on documents for insert to authenticated
  with check (is_room_admin(room_id) and uploader_id = auth.uid());
create policy "documents: 관리자 수정/숨김" on documents for update to authenticated
  using (is_room_admin(room_id)) with check (is_room_admin(room_id));

create policy "versions: 멤버 열람" on document_versions for select to authenticated
  using (exists (select 1 from documents d where d.id = document_id and is_room_member(d.room_id)));
create policy "versions: 관리자 등록" on document_versions for insert to authenticated
  with check (uploaded_by = auth.uid()
              and exists (select 1 from documents d where d.id = document_id and is_room_admin(d.room_id)));

create policy "logs: 본인 기록" on document_access_logs for insert to authenticated
  with check (user_id = auth.uid());
create policy "logs: 관리자 조회" on document_access_logs for select to authenticated
  using (exists (select 1 from documents d where d.id = document_id and is_room_admin(d.room_id)));

-- =====================================================================
-- RPC
-- =====================================================================

-- 1:1 방 (있으면 재사용)
create or replace function public.get_or_create_direct_room(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_key  text := least(auth.uid()::text, p_other::text) || ':' || greatest(auth.uid()::text, p_other::text);
  v_room uuid;
begin
  if auth.uid() is null or p_other = auth.uid() then raise exception 'invalid'; end if;
  select id into v_room from rooms where direct_key = v_key;
  if v_room is null then
    insert into rooms (type, direct_key, created_by) values ('direct', v_key, auth.uid())
      returning id into v_room;
    -- 1:1 방은 두 사람 모두 admin → 서로 문서 공유 가능 (정책에 따라 'member'로 바꿔도 됨)
    insert into room_members (room_id, user_id, role)
      values (v_room, auth.uid(), 'admin'), (v_room, p_other, 'admin');
  end if;
  return v_room;
end $$;

-- 그룹방 / 문서 보관함(archive) 생성 : 생성자 = owner
create or replace function public.create_group_room(p_name text, p_member_ids uuid[], p_type room_type default 'group')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_room uuid;
begin
  if p_type = 'direct' then raise exception 'use get_or_create_direct_room'; end if;
  insert into rooms (type, name, created_by) values (p_type, p_name, auth.uid()) returning id into v_room;
  insert into room_members (room_id, user_id, role) values (v_room, auth.uid(), 'owner');
  insert into room_members (room_id, user_id, role)
    select v_room, uid, 'member' from unnest(p_member_ids) uid where uid <> auth.uid()
    on conflict do nothing;
  insert into messages (room_id, type, content) values (v_room, 'system', '채팅방이 개설되었습니다.');
  return v_room;
end $$;

-- 관리자 권한 부여/회수 (owner 전용)
create or replace function public.set_member_role(p_room uuid, p_user uuid, p_role member_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from room_members where room_id = p_room and user_id = auth.uid() and role = 'owner') then
    raise exception '방장만 권한을 변경할 수 있습니다.';
  end if;
  if p_role = 'owner' then raise exception 'owner 위임은 별도 절차를 사용하세요.'; end if;
  update room_members set role = p_role where room_id = p_room and user_id = p_user and role <> 'owner';
  insert into messages (room_id, type, content)
    select p_room, 'system', display_name || case p_role when 'admin' then '님이 문서 관리자가 되었습니다.'
                                                        else '님의 관리자 권한이 해제되었습니다.' end
      from profiles where id = p_user;
end $$;

-- 채팅 목록 (안 읽은 수 포함)
create or replace function public.get_my_rooms()
returns table (
  id uuid, type room_type, name text, avatar_url text,
  last_message_at timestamptz, last_message_preview text,
  unread_count bigint, member_count bigint, my_role member_role
) language sql stable security definer set search_path = public as $$
  select r.id, r.type,
         coalesce(r.name, (select p.display_name from room_members m2 join profiles p on p.id = m2.user_id
                            where m2.room_id = r.id and m2.user_id <> auth.uid() limit 1)) as name,
         coalesce(r.avatar_url, (select p.avatar_url from room_members m2 join profiles p on p.id = m2.user_id
                                  where m2.room_id = r.id and m2.user_id <> auth.uid() limit 1)) as avatar_url,
         r.last_message_at, r.last_message_preview,
         (select count(*) from messages msg
           where msg.room_id = r.id and msg.created_at > m.last_read_at
             and msg.type <> 'system'
             and msg.sender_id is distinct from auth.uid()) as unread_count,
         (select count(*) from room_members m3 where m3.room_id = r.id) as member_count,
         m.role
    from room_members m join rooms r on r.id = m.room_id
   where m.user_id = auth.uid()
   order by r.last_message_at desc nulls last;
$$;

-- =====================================================================
-- Storage : private 버킷 + 정책
--   경로 규칙: rooms/{room_id}/{document_id}/v{n}/{file_name}
--   - SELECT : 방 멤버
--   - INSERT : 방 관리자
--   - UPDATE / DELETE : 정책 없음 → 누구도 불가 (영구 보존)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 524288000)   -- 500MB (요금제에 맞게 조정)
on conflict (id) do nothing;

create policy "docs bucket: 멤버 읽기" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_room_member(((storage.foldername(name))[2])::uuid));

create policy "docs bucket: 관리자 업로드" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_room_admin(((storage.foldername(name))[2])::uuid));

-- =====================================================================
-- Realtime
-- =====================================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.room_members;   -- 읽음 숫자(1) 실시간 갱신
