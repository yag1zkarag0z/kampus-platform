import type { CampusComment } from "@/data/campusPosts";

export type CommentSort = "oldest" | "newest" | "liked";

/**
 * Varsayılan "En eski": sohbet akışı bozulmasın. Diğer ikisi yalnızca kök
 * yorumlara uygulanır — yanıtlar her zaman kendi kökünün altında ve kendi
 * aralarında kronolojik kalır.
 */
export const commentSortOptions: { id: CommentSort; label: string }[] = [
  { id: "oldest", label: "En eski" },
  { id: "newest", label: "En yeni" },
  { id: "liked", label: "En beğenilen" },
];

/**
 * Yorum listesini seçilen sıraya göre düzenler.
 *
 * Yanıtlar girintilerini ebeveynlerinin hemen ardından gelmelerine borçlu.
 * Bu yüzden düz listeyi sıralamak yerine önce kök/yanıt olarak gruplanır,
 * yalnızca kökler sıralanır, sonra her kökün yanıtları altına konur.
 *
 * Hiçbir yorum düşmez: girdideki her öğe çıktıda tam olarak bir kez bulunur.
 */
export function sortCampusComments(
  comments: readonly CampusComment[],
  sort: CommentSort,
): CampusComment[] {
  const knownIds = new Set(comments.map((comment) => comment.id));
  const repliesByParent = new Map<string, CampusComment[]>();
  const roots: CampusComment[] = [];

  for (const comment of comments) {
    // Ebeveyni görünmüyorsa (engelleme, silinme vb.) yanıt kök gibi davranır;
    // aksi halde listeden tamamen düşerdi.
    if (comment.parentId && knownIds.has(comment.parentId)) {
      const siblings = repliesByParent.get(comment.parentId);

      if (siblings) {
        siblings.push(comment);
      } else {
        repliesByParent.set(comment.parentId, [comment]);
      }
    } else {
      roots.push(comment);
    }
  }

  if (sort !== "oldest") {
    roots.sort((first, second) => {
      if (sort === "liked") {
        const difference = (second.likes ?? 0) - (first.likes ?? 0);

        // Çoğu yorumun beğenisi sıfır; eşitlikte sıra rastgele görünmesin
        // diye kronolojiye düşüyoruz.
        if (difference !== 0) {
          return difference;
        }

        return (first.createdAt ?? 0) - (second.createdAt ?? 0);
      }

      return (second.createdAt ?? 0) - (first.createdAt ?? 0);
    });
  }

  // Yanıtlar sunucudan kronolojik geldiği için kendi aralarında
  // sıralanmıyor: bir sohbet dizisi zaman sırasını korumalı.
  return roots.flatMap((root) => [
    root,
    ...(repliesByParent.get(root.id) ?? []),
  ]);
}
