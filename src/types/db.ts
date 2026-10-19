export type MemberRole = "owner" | "admin" | "member";
export type RoomType = "direct" | "group" | "archive";
export type MessageType = "text" | "image" | "document" | "system";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  status_message: string | null;
}

export interface RoomListItem {
  id: string;
  type: RoomType;
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  member_count: number;
  my_role: MemberRole;
}

export interface DocumentRow {
  id: string;
  room_id: string;
  uploader_id: string;
  title: string;
  description: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  current_version: number;
  storage_path: string;
  checksum_sha256: string | null;
  is_hidden: boolean;
  created_at: string;
}

export interface Message {
  id: number;
  room_id: string;
  sender_id: string | null;
  type: MessageType;
  content: string | null;
  document_id: string | null;
  created_at: string;
  document?: DocumentRow | null;
  /** 낙관적 업데이트용 임시 상태 */
  pending?: boolean;
}
