-- =====================================================================
-- 0002 hardening
--   1) 문서 업로드 완료 처리를 단일 트랜잭션 RPC 로 (부분 실패 방지)
--   2) 열람 로그 INSERT 는 해당 문서를 볼 수 있는 사용자만
--   3) direct(1:1) 방에는 제3자 초대 불가
--   4) 숨김 문서의 Storage 객체는 관리자만 읽기 가능
-- =====================================================================

-- 1) 업로드 완료: security invoker → 모든 INSERT/UPDATE 에 RLS(관리자 검증)가 그대로 적용된다.
create or replace function public.complete_document_upload(
  p_room uuid, p_document uuid, p_version int, p_path text,
  p_file_name text, p_mime text, p_size bigint, p_checksum text,
  p_title text, p_description text, p_user_agent text
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_title text := coalesce(nullif(p_title, ''), p_file_name);
  v_msg bigint;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if p_version < 1 then
    raise exception 'invalid version' using errcode = '22023';
  end if;

  if p_version = 1 then
    insert into documents (id, room_id, uploader_id, title, description, file_name, mime_type,
                           size_bytes, storage_path, checksum_sha256, current_version)
    values (p_document, p_room, v_uid, v_title, p_description, p_file_name, p_mime,
            p_size, p_path, p_checksum, 1);
  else
    -- 같은 방의 문서이고, 직전 버전일 때만 갱신 (optimistic lock)
    update documents
       set file_name = p_file_name, mime_type = p_mime, size_bytes = p_size,
           storage_path = p_path, checksum_sha256 = p_checksum,
           current_version = p_version, updated_at = now()
     where id = p_document and room_id = p_room and current_version = p_version - 1;
    if not found then
      raise exception '문서를 찾을 수 없거나 다른 사용자가 먼저 새 버전을 올렸습니다.' using errcode = '40001';
    end if;
  end if;

  insert into document_versions (document_id, version, storage_path, size_bytes, checksum_sha256, uploaded_by)
  values (p_document, p_version, p_path, p_size, p_checksum, v_uid);

  insert into messages (room_id, sender_id, type, content, document_id)
  values (p_room, v_uid, 'document',
          case when p_version = 1 then v_title else v_title || ' (v' || p_version || ')' end,
          p_document)
  returning id into v_msg;

  insert into document_access_logs (document_id, user_id, action, version, user_agent)
  values (p_document, v_uid, case when p_version = 1 then 'upload' else 'new_version' end::doc_action,
          p_version, p_user_agent);

  return v_msg;
end $$;

revoke all on function public.complete_document_upload(uuid,uuid,int,text,text,text,bigint,text,text,text,text) from public;
grant execute on function public.complete_document_upload(uuid,uuid,int,text,text,text,bigint,text,text,text,text) to authenticated;

-- 2) 열람 로그: 문서 접근 권한이 있어야 기록 가능 (숨김 문서는 관리자만)
drop policy if exists "logs: 본인 기록" on public.document_access_logs;
create policy "logs: 본인 기록" on public.document_access_logs for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from documents d
       where d.id = document_id
         and is_room_member(d.room_id)
         and (not d.is_hidden or is_room_admin(d.room_id))
    )
  );

-- 3) direct 방 초대 금지
drop policy if exists "members: 관리자 초대" on public.room_members;
create policy "members: 관리자 초대" on public.room_members for insert to authenticated
  with check (
    is_room_admin(room_id) and role = 'member'
    and exists (select 1 from rooms r where r.id = room_id and r.type <> 'direct')
  );

-- 4) Storage 읽기: 관리자는 전부, 일반 멤버는 숨김 처리되지 않은 문서의 객체만
drop policy if exists "docs bucket: 멤버 읽기" on storage.objects;
create policy "docs bucket: 멤버 읽기" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_room_admin(((storage.foldername(name))[2])::uuid)
      or (
        public.is_room_member(((storage.foldername(name))[2])::uuid)
        and exists (
          select 1 from public.document_versions v
            join public.documents d on d.id = v.document_id
           where v.storage_path = storage.objects.name and not d.is_hidden
        )
      )
    )
  );
