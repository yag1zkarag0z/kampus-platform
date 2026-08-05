"use client";

import { useEffect, type RefObject } from "react";

/**
 * Yazı alanını içeriğe göre büyütür. Sabit yükseklikte kalan bir kutu,
 * karakter sınırına ulaşılmadan "daha fazla yazamıyorum" hissi verdiği için
 * gönderi ve yorum kutularının hepsi bunu kullanır.
 */
export function useAutoGrowTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useEffect(() => {
    const textarea = ref.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [ref, value]);
}
