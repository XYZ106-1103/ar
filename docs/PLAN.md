# ArchiveTalk 서비스 기획서

> 카카오톡과 같은 메신저 사용 경험에, **문서 영구 보관**과 **관리자 업로드 권한 제어**를 더한 반응형 웹/모바일 플랫폼

---

## 1. 서비스 개요

| 항목 | 내용 |
|---|---|
| 한 줄 정의 | "만료되지 않는 카톡 파일함": 대화는 메신저처럼, 문서는 아카이브처럼 |
| 핵심 차별점 | ① 파일 만료/삭제 없음(영구 보존) ② 관리자만 업로드 ③ 버전 이력·열람 기록 ④ PC/모바일 동일 경험 |
| 주요 사용처 | 학원·교회·동호회 공지 자료, 사내 팀 규정/계약서, 프로젝트 산출물, 가족 문서 보관 |

### UI/UX 원칙 (카카오톡 동일 동선)
- **하단 탭 4개**: 친구 / 채팅 / 보관함(신규) / 더보기. 채팅방 안에서는 탭바 숨김
- **채팅 목록**: 둥근 사각형 프로필, 방 이름 + 인원 수, 마지막 메시지 2줄, 시간(오늘=오후 3:12 / 어제 / M월 d일), 빨간 안읽음 배지
- **채팅방**: 하늘색 배경, 내 말풍선 노랑(오른쪽), 상대 흰색(왼쪽), 꼬리, 같은 분(分) 연속 메시지 묶음 처리, 날짜 구분선, 안읽은 사람 수 숫자, 우측 "채팅방 서랍"
- **PC(≥768px)**: 카톡 PC처럼 좌측 아이콘 레일 + [채팅 목록 | 채팅방] 2단 레이아웃
- **모바일**: 전체 화면 단일 패널, safe-area(노치), `100dvh`, 한글 IME Enter 처리, PWA 홈 화면 설치

> ⚠️ **법적 유의**: "구조와 사용 흐름"이 같은 것은 문제되지 않지만, **카카오 로고·명칭·캐릭터·아이콘 리소스를 그대로 쓰면 상표/디자인권 침해** 소지가 있습니다. 색상과 서비스명은 `globals.css`의 토큰으로 분리해 두었으니 고유 브랜드로 바꿔 쓰세요.

---

## 2. 사용자 역할 및 권한

### 2-1. 역할 정의

| 역할 | 범위 | 채팅 | 문서 열람/다운로드 | 문서 업로드·새 버전 | 문서 숨김/복원 | 관리자 지정 | 문서 물리 삭제 |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| **super_admin** | 시스템 전체 | ✅ | ✅(멤버인 방) | ✅ 모든 방 | ✅ | ❌ | ❌ |
| **owner** (방장) | 방 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **admin** (문서 관리자) | 방 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **member** (초대 멤버) | 방 | ✅ | ✅ | ❌ (🔒 버튼) | ❌ | ❌ | ❌ |
| 비멤버 | - | ❌ | ❌ (404) | ❌ | ❌ | ❌ | ❌ |

- **물리 삭제는 누구도 불가**: DB 트리거가 service_role/DB 관리자 접속에서도 `DELETE`를 막습니다. "숨김"만 가능하고, 숨긴 문서도 관리자에게는 계속 보이며 원본은 그대로 남습니다.
- 1:1 채팅은 두 사람 모두 `admin`(서로 문서 공유 가능). 정책상 막으려면 RPC에서 `member`로 바꾸면 됩니다.

### 2-2. 방 유형
| type | 설명 |
|---|---|
| `direct` | 1:1 채팅 (중복 방 생성 방지 키 `direct_key`) |
| `group` | 그룹 채팅 + 문서 공유 |
| `archive` | **채팅보다 문서가 주인 보관함** (공지 자료실처럼 사용, 같은 UI/권한 체계 공유) |

### 2-3. 권한 플로우

```
[방장] 그룹방/보관함 생성 ──► 멤버 초대(role=member)
   │
   └─► 채팅방 서랍 > 대화상대 > "관리자 지정"  (RPC set_member_role, owner만 실행 가능)
            │                                   └ 시스템 메시지: "OOO님이 문서 관리자가 되었습니다."
            ▼
[관리자] [+] 버튼 → 파일 선택
   1) POST /api/documents/prepare   ─ 서버: 로그인? 이 방 owner/admin?  ──NO──► 403
                                      YES → Signed Upload URL 발급(2시간, 덮어쓰기 금지)
   2) PUT  Storage (브라우저 직행)   ─ Storage RLS 한 번 더 확인, 진행률 표시
   3) POST /api/documents/complete  ─ 파일 존재 확인 → documents / document_versions / messages / logs 기록
                                      (사용자 세션으로 INSERT → DB RLS가 관리자 여부를 3번째로 검증)
            ▼
[멤버 전원] 실시간으로 문서 말풍선 수신 (Supabase Realtime, RLS 적용)
   └─ "바로보기" / "저장" 클릭
        GET /api/documents/{id}/access?mode=view|download
          ─ RLS로 문서 조회 (멤버가 아니면 404)
          ─ 5분짜리 Signed URL 새로 발급 + 열람 로그 기록 → 리다이렉트
```

**3중 방어**: ① UI(버튼 비활성) ② API Route(역할 검사) ③ PostgreSQL RLS + Storage 정책. UI·API가 뚫려도 DB가 거부합니다.

---

## 3. 데이터베이스 설계

전체 DDL: [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)

```
auth.users ─1:1─ profiles ─┬─< friendships >─ profiles
                           │
                           ├─< room_members >─ rooms ─┬─< messages ──(document_id)──┐
                           │      (role)              │                             │
                           │                          └─< documents ────────────────┘
                           │                                 │ (on delete restrict)
                           │                                 ├─< document_versions   (불변)
                           └─────────────────────────────────└─< document_access_logs (감사)
```

| 테이블 | 핵심 컬럼 | 비고 |
|---|---|---|
| `profiles` | id, display_name, avatar_url, status_message, **system_role** | 가입 시 트리거로 자동 생성 |
| `friendships` | user_id, friend_id, favorite | 친구 탭 |
| `rooms` | id, **type**(direct/group/archive), name, direct_key, last_message_at, last_message_preview | 목록 정렬용 비정규화 컬럼은 트리거로 갱신 |
| `room_members` | room_id, user_id, **role**(owner/admin/member), **last_read_at**, muted | 권한의 단일 진실 공급원 + 안읽음 계산 |
| `messages` | id, room_id, sender_id, **type**(text/image/document/system), content, document_id | `type='document'` 는 관리자만 INSERT 가능 |
| `documents` | id, room_id, uploader_id, title, file_name, mime_type, size_bytes, **current_version**, storage_path, **checksum_sha256**, **is_hidden** | DELETE 불가(트리거), 숨김만 |
| `document_versions` | document_id, version, storage_path, size, checksum, uploaded_by | INSERT만, UPDATE/DELETE 불가 |
| `document_access_logs` | document_id, user_id, **action**(upload/new_version/view/download/hide/restore), version, user_agent | 누가 언제 봤는지 감사 추적 |

**주요 RPC**: `get_or_create_direct_room`, `create_group_room`, `set_member_role`, `get_my_rooms`(안읽음 수 포함 목록)

**Storage**: private 버킷 `documents`, 경로 `rooms/{room_id}/{document_id}/v{n}/{안전한파일명}`
- 읽기: 방 멤버 / 쓰기: 방 관리자 / **수정·삭제 정책 없음** → 덮어쓰기·삭제 불가
- 한글 파일명은 Storage 키로 쓸 수 없어 DB에 원본명을 보관하고, 다운로드 시 `Content-Disposition`으로 복원

---

## 4. 영구 보존 설계 (카카오톡과의 차별점)

| 위협 | 대응 |
|---|---|
| 기간 만료 | 만료 로직 자체가 없음. 링크만 5분 Signed URL로 "일시적", **원본은 영구** |
| 실수/악의적 삭제 | ① 삭제 API 없음 ② Storage 삭제 정책 없음 ③ DB `BEFORE DELETE` 트리거 ④ FK `on delete restrict` (방이 삭제돼도 문서 보호) |
| 덮어쓰기 | 새 버전은 항상 새 경로(`v{n}`)에 저장, `x-upsert: false`. 이전 버전 전부 열람 가능 |
| 파일 손상 | 업로드 시 SHA-256 체크섬 저장 → 주기적 무결성 검사(Edge Function 크론) |
| 클라우드 장애/계정 사고 | **2차 백업 필수**: 매일 Storage → AWS S3 (Object Lock/WORM, Glacier Deep Archive) 또는 GCS Bucket Lock 복제. DB는 Supabase PITR(유료) + 일 1회 `pg_dump` 외부 보관 |
| 회원 탈퇴 | 업로더 탈퇴해도 문서는 방에 남음 → 탈퇴 시 profile을 "탈퇴한 사용자"로 익명화(물리 삭제 대신) |

> 💡 "영구"는 결국 **비용 문제**입니다. 500GB 이상이면 Supabase Storage(약 $0.021/GB·월)보다 Cloudflare R2(전송료 무료)나 S3 Intelligent-Tiering이 유리하므로, 스토리지 계층만 교체할 수 있게 경로 규칙·API를 추상화해 두었습니다.

---

## 5. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 프론트엔드 | **Next.js 16 (App Router) + React 19 + TypeScript** | SSR로 첫 화면 빠름, API Route로 백엔드 일체화, Vercel 배포 1분 |
| 스타일 | **Tailwind CSS v4** | `md:` 한 줄로 PC/모바일 분기, 테마 토큰으로 브랜드 교체 |
| 백엔드 | **Supabase** (PostgreSQL + Auth + Realtime + Storage) | 권한을 **RLS로 DB에서 강제**할 수 있어 문서 권한 서비스에 최적. Firebase보다 관계형(방-멤버-문서) 모델링과 SQL 감사 쿼리가 쉬움 |
| 실시간 | Supabase Realtime (postgres_changes) | 메시지/읽음/권한 변경 실시간 반영, RLS 적용 |
| 파일 | Supabase Storage (S3 호환) + Signed URL | 대용량은 TUS resumable 업로드로 확장 |
| 문서 뷰어 | PDF/이미지/영상: 브라우저 내장, Office: MS Office Online Viewer | HWP·사내 보안 문서는 LibreOffice/한컴 변환 워커로 PDF 변환 권장 |
| 모바일 앱 | 1단계 **PWA** → 2단계 **Capacitor** 래핑(앱스토어 배포, FCM/APNs 푸시) | 코드 하나로 웹·안드로이드·iOS |
| 배포 | Vercel + Supabase Cloud | 서버 관리 불필요 |

**Firebase 대신 Supabase를 고른 이유**: Firestore Security Rules로도 가능하지만, "방 멤버 역할 → 문서 → Storage 경로" 권한을 하나의 SQL 함수(`is_room_admin`)로 테이블·스토리지에 동시 적용할 수 있고, 삭제 차단 트리거·감사 로그 같은 "영구 보존 보장"을 DB 수준에서 만들 수 있다는 점이 결정적입니다.

---

## 6. 개발 로드맵 (1인 기준 예시)

| 단계 | 기간 | 범위 |
|---|---|---|
| MVP | 3~4주 | 로그인, 친구, 1:1/그룹 채팅, 문서 업로드(관리자)·열람·다운로드, 보관함, 반응형 ← **현재 코드 범위** |
| v1.1 | 2주 | 이미지/사진 전송, 메시지 검색, 공지 고정, 초대 링크, 푸시 알림(Web Push) |
| v1.2 | 2주 | Office/HWP → PDF 변환 워커, 문서 전문 검색, 관리자 대시보드(열람 통계) |
| v2 | 3주 | Capacitor 앱 출시, S3 Object Lock 백업 파이프라인, 조직(테넌트) 단위 관리 |
