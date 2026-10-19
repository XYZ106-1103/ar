# ArchiveTalk

카카오톡과 같은 메신저 UX + **관리자 전용 문서 업로드** + **문서 영구 보관**을 갖춘 반응형 웹/모바일 플랫폼.

- 기획서(역할·권한 플로우, DB 설계, 기술 스택, 영구 보존 전략): [`docs/PLAN.md`](docs/PLAN.md)
- DB 스키마 / RLS / 트리거 / RPC / Storage 정책: [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)

## 소스 구조

```
archive-talk/
├─ supabase/migrations/0001_init.sql   # 테이블, RLS, 삭제 차단 트리거, RPC, private 버킷 정책
├─ docs/PLAN.md                         # 서비스 기획서
├─ public/manifest.webmanifest          # PWA (홈 화면 설치)
└─ src/
   ├─ proxy.ts                          # (Next 16 middleware) 세션 갱신 + 비로그인 리다이렉트
   ├─ app/
   │  ├─ login/                         # 로그인
   │  ├─ auth/callback/                 # OAuth/매직링크 콜백
   │  ├─ (main)/                        # 탭바가 있는 영역
   │  │  ├─ layout.tsx                  # 반응형 셸: 모바일 하단탭 / PC 좌측 레일
   │  │  ├─ friends/                    # 친구 탭 (1:1 시작, 그룹방·보관함 생성)
   │  │  ├─ chats/layout.tsx            # PC: [목록 | 채팅방] 2단, 모바일: 1단
   │  │  ├─ chats/[roomId]/             # 채팅방
   │  │  ├─ archive/                    # 보관함 탭: 내가 볼 수 있는 모든 문서
   │  │  └─ more/
   │  ├─ documents/[id]/                # 문서 바로보기 + 버전 이력 + 새 버전/숨김(관리자)
   │  └─ api/documents/
   │     ├─ prepare/route.ts            # ① 관리자 검증 → Signed Upload URL
   │     ├─ complete/route.ts           # ③ 파일 확인 → 메타·버전·메시지·로그 기록
   │     ├─ [id]/access/route.ts        # 열람/다운로드: RLS 확인 → 5분 Signed URL + 로그
   │     └─ [id]/route.ts               # PATCH 숨김/복원 (삭제 API 없음)
   ├─ components/
   │  ├─ layout/   AppNav, MainContent, PageHeader
   │  ├─ chat/     ChatList, ChatsShell, ChatRoom, MessageBubble, MessageInput, RoomDrawer, FriendList
   │  ├─ docs/     DocumentCard(문서 말풍선), DocumentList, ArchiveBrowser, DocumentViewer
   │  └─ ui/       Avatar
   ├─ hooks/
   │  ├─ useRealtimeMessages.ts         # 실시간 수신, 낙관적 전송, 무한 스크롤, 읽음 처리
   │  └─ useDocumentUpload.ts           # SHA-256 → prepare → PUT(진행률) → complete
   ├─ lib/
   │  ├─ supabase/{client,server,proxy}.ts
   │  ├─ auth.ts, permissions.ts, storage-path.ts, format.ts
   └─ types/db.ts
```

## 실행

```bash
# 1) Supabase 프로젝트 생성 후 SQL Editor 에서 순서대로 실행 (또는 supabase db push)
#    supabase/migrations/0001_init.sql
#    supabase/migrations/0002_hardening.sql
#    supabase/migrations/0003_add_friend.sql

# 2) 환경 변수
cp .env.example .env.local   # URL, anon key, service_role key 입력

# 3) 실행
npm install
npm run dev                  # http://localhost:3000
```

테스트 계정은 Supabase 대시보드 > Authentication 에서 만들고, 친구 탭 우측 상단 [사람+] 버튼에서 이메일 또는 이름으로 검색해 친구를 추가한 뒤 그룹방을 만들어 보세요. 방장이 채팅방 서랍에서 "관리자 지정"을 하면 해당 멤버의 [+] 업로드 버튼이 활성화됩니다.

## 친구 추가

친구 탭 우측 상단 [사람+] 버튼 → 이메일(정확히 일치) 또는 이름(부분 일치, 2글자 이상) 검색 → [추가].
상대 동의 없이 바로 양쪽 모두 친구가 됩니다 (`add_friend` RPC). 검색 결과에 이메일은 노출되지 않습니다.

## Render 배포

1. 이 폴더를 GitHub 저장소에 push (`.env.local` 은 `.gitignore` 로 제외됨)
2. Render 대시보드 > **New > Blueprint** → 저장소 선택 → `render.yaml` 이 자동 인식됨
3. 환경 변수 3개 입력: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
4. Apply → 빌드(`npm ci && npm run build`) 후 `https://archive-talk-xxxx.onrender.com` 으로 접속

- `NEXT_PUBLIC_*` 값은 빌드 시점에 번들에 포함됩니다. 값을 바꾸면 **Manual Deploy > Clear build cache & deploy** 로 다시 빌드하세요.
- Free 플랜은 15분간 요청이 없으면 슬립되어 첫 접속이 30초~1분 걸립니다. 상시 사용이면 `plan: starter` 로 바꾸세요.
- Supabase **Authentication > URL Configuration** 의 Site URL 을 Render 주소로 바꿔 두세요 (비밀번호 재설정 메일 등의 링크에 사용).
