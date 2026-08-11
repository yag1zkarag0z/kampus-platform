"use client";

import { useCallback, useRef, useState } from "react";

import { followMember, unfollowMember } from "@/social/client";

type CampusSessionMode = "member" | "guest" | "signed-out";

export type FollowTarget = {
  id: string;
  username: string;
};

/**
 * Takip durumu ağ isteğini beklemeden değişir.
 *
 * Önceden buton `await` bitene kadar eski hâlinde duruyordu; yavaş bağlantıda
 * kullanıcı tıklamanın işe yarayıp yaramadığını anlayamadığı için ikinci kez
 * basıyordu. Şimdi durum anında dönüyor, istek düşerse geri alınıp hata metni
 * gösteriliyor.
 */
export function useFollowState({
  sessionMode,
  onGuestAttempt,
  onError,
}: {
  sessionMode: CampusSessionMode;
  /** Misafir davranışı yüzeye göre değişiyor: rayda uyarı, destede yönlendirme. */
  onGuestAttempt: () => void;
  onError: (message: string) => void;
}) {
  const [followedIds, setFollowedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Olay işleyicisi güncel kümeyi render dışında okumak zorunda: iki tıklama
  // arka arkaya gelirse state henüz yenilenmemiş olabilir.
  const followedRef = useRef(followedIds);
  const pendingIds = useRef(new Set<string>());

  const apply = (next: ReadonlySet<string>) => {
    followedRef.current = next;
    setFollowedIds(next);
  };

  const toggleFollow = useCallback(
    async (target: FollowTarget) => {
      if (sessionMode !== "member") {
        onGuestAttempt();
        return;
      }

      // Aynı kişi için uçuşta istek varken ikinci tıklama yok sayılır; aksi
      // hâlde takip/bırak sırası sunucuda karışabilir.
      if (pendingIds.current.has(target.id)) {
        return;
      }

      pendingIds.current.add(target.id);

      const wasFollowed = followedRef.current.has(target.id);
      const optimistic = new Set(followedRef.current);

      if (wasFollowed) {
        optimistic.delete(target.id);
      } else {
        optimistic.add(target.id);
      }

      apply(optimistic);

      try {
        await (wasFollowed ? unfollowMember : followMember)(target.username);
      } catch {
        // Yalnızca bu satır geri alınır: bu arada başka bir satır değişmiş
        // olabilir, eski kümeyi olduğu gibi geri yazmak onu da silerdi.
        const rolledBack = new Set(followedRef.current);

        if (wasFollowed) {
          rolledBack.add(target.id);
        } else {
          rolledBack.delete(target.id);
        }

        apply(rolledBack);
        onError(
          wasFollowed
            ? "Takipten çıkılamadı, tekrar dene."
            : "Takip işlemi şu anda tamamlanamadı.",
        );
      } finally {
        pendingIds.current.delete(target.id);
      }
    },
    [onError, onGuestAttempt, sessionMode],
  );

  return { followedIds, toggleFollow };
}
