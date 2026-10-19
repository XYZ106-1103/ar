"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types/db";

const PAGE = 50;
const SELECT = "*, document:documents(*)";

/**
 * 채팅방 메시지: 초기 로드 + 실시간 수신 + 과거 메시지 무한 스크롤 + 낙관적 전송 + 읽음 처리
 */
export function useRealtimeMessages(roomId: string, myId: string, initial: Message[]) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(initial);
  const [hasMore, setHasMore] = useState(initial.length >= PAGE);
  const loadingRef = useRef(false);

  const markRead = useCallback(() => {
    supabase.from("room_members").update({ last_read_at: new Date().toISOString() })
      .eq("room_id", roomId).eq("user_id", myId).then(() => {});
  }, [supabase, roomId, myId]);

  useEffect(() => {
    markRead();
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          let msg = payload.new as Message;
          // 문서 메시지는 문서 메타데이터를 붙여서 다시 조회
          if (msg.type === "document") {
            const { data } = await supabase.from("messages").select(SELECT).eq("id", msg.id).single();
            if (data) msg = data as Message;
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            // 내가 보낸 낙관적 메시지 교체
            const idx = prev.findIndex((m) => m.pending && m.sender_id === msg.sender_id && m.content === msg.content);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = msg;
              return next;
            }
            return [...prev, msg];
          });
          markRead();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, markRead]);

  const loadOlder = useCallback(async () => {
    if (loadingRef.current || !hasMore || messages.length === 0) return;
    loadingRef.current = true;
    const oldest = messages.find((m) => !m.pending)?.created_at;
    const { data } = await supabase
      .from("messages").select(SELECT).eq("room_id", roomId)
      .lt("created_at", oldest!).order("created_at", { ascending: false }).limit(PAGE);
    const older = ((data ?? []) as Message[]).reverse();
    setMessages((prev) => [...older, ...prev]);
    setHasMore(older.length >= PAGE);
    loadingRef.current = false;
  }, [supabase, roomId, messages, hasMore]);

  const sendText = useCallback(async (text: string) => {
    const tempId = -Date.now();
    const optimistic: Message = {
      id: tempId, room_id: roomId, sender_id: myId, type: "text",
      content: text, document_id: null, created_at: new Date().toISOString(), pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    const { data, error } = await supabase
      .from("messages").insert({ room_id: roomId, sender_id: myId, type: "text", content: text })
      .select(SELECT).single();
    setMessages((prev) => {
      if (error) return prev.filter((m) => m.id !== tempId); // 실패 시 제거 (재전송 UI 확장 가능)
      // 실시간 이벤트가 먼저 와서 이미 교체됐을 수도 있음
      if (prev.some((m) => m.id === (data as Message).id)) return prev.filter((m) => m.id !== tempId);
      return prev.map((m) => (m.id === tempId ? (data as Message) : m));
    });
  }, [supabase, roomId, myId]);

  /** 업로드 API 응답으로 받은 문서 메시지를 즉시 반영 */
  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  return { messages, hasMore, loadOlder, sendText, appendMessage };
}
