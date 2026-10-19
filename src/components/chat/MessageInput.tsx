"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Plus, Smile, Hash, Lock } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  onPickFile?: (file: File) => void;
  canUpload: boolean;
}

/**
 * 카톡 입력창: [+] [자동 높이 입력창] [이모티콘] [전송]
 *  - PC: Enter 전송 / Shift+Enter 줄바꿈
 *  - 모바일: Enter 는 줄바꿈, 전송 버튼으로 전송
 *  - [+] 버튼은 문서 관리자에게만 활성화
 */
export function MessageInput({ onSend, onPickFile, canUpload }: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false); // 한글 IME 조합 중 Enter 이중 입력 방지

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
    ref.current?.focus();
  };

  return (
    <div className="flex items-end gap-2 border-t border-line bg-white px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        title={canUpload ? "문서 올리기" : "문서 업로드는 관리자만 가능합니다"}
        disabled={!canUpload}
        onClick={() => fileRef.current?.click()}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#666] hover:bg-black/5 disabled:opacity-30"
      >
        {canUpload ? <Plus className="size-6" /> : <Lock className="size-5" />}
      </button>
      <input
        ref={fileRef}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile?.(f);
          e.target.value = "";
        }}
      />
      <div className="flex min-h-9 flex-1 items-end rounded-[18px] bg-[#f4f4f4] px-3">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onCompositionStart={() => (composing.current = true)}
          onCompositionEnd={() => (composing.current = false)}
          onKeyDown={(e) => {
            const isDesktop = window.matchMedia("(pointer: fine)").matches;
            if (e.key === "Enter" && !e.shiftKey && isDesktop && !composing.current && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-[120px] w-full resize-none bg-transparent py-2 text-[15px] leading-5 outline-none"
        />
        <Smile className="mb-2 ml-1 size-5 shrink-0 text-[#888]" />
        <Hash className="mb-2 ml-2 size-5 shrink-0 text-[#888] max-sm:hidden" />
      </div>
      <button
        type="button"
        onClick={send}
        disabled={!text.trim()}
        className={clsx(
          "h-9 shrink-0 rounded-[18px] px-3.5 text-sm font-medium transition",
          text.trim() ? "bg-brand text-brand-ink" : "bg-[#f4f4f4] text-[#bbb]",
        )}
      >
        전송
      </button>
    </div>
  );
}
