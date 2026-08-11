"use client";

import { useCallback, useMemo, useState } from "react";

import ActionStatusText from "@/components/ActionStatusText";
import { useCursorList } from "@/components/useCursorList";
import {
  getModerationFeedback,
  updateModerationFeedbackStatus,
  type FeedbackCategoryDto,
  type FeedbackStatusDto,
  type FeedbackSummaryDto,
} from "@/feedback/client";

const statusLabels: Record<FeedbackStatusDto, string> = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  resolved: "Çözüldü",
  dismissed: "Kapatıldı",
};

const categoryLabels: Record<FeedbackCategoryDto, string> = {
  bug: "Hata",
  suggestion: "Öneri",
  other: "Diğer",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40";

function submitterLabel(item: FeedbackSummaryDto) {
  if (item.submitter.kind === "member") {
    return `${item.submitter.displayName} · @${item.submitter.username}`;
  }

  return item.submitter.kind === "guest" ? "Misafir" : "Silinmiş hesap";
}

export default function CampusFeedbackAdminQueue() {
  const [statusFilter, setStatusFilter] = useState<
    FeedbackStatusDto | "all"
  >("new");
  const [categoryFilter, setCategoryFilter] = useState<
    FeedbackCategoryDto | "all"
  >("all");
  const [updatingId, setUpdatingId] = useState<string>();
  const [actionMessage, setActionMessage] = useState<{
    message: string;
    tone: "success" | "error";
  }>();
  const filters = useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : statusFilter,
      category: categoryFilter === "all" ? undefined : categoryFilter,
    }),
    [categoryFilter, statusFilter],
  );
  const fetchPage = useCallback(
    (cursor?: string) => getModerationFeedback(filters, cursor),
    [filters],
  );
  const {
    items,
    isLoading,
    hasFailed,
    hasMore,
    isLoadingMore,
    loadMore,
    reload,
    setItems,
  } = useCursorList(fetchPage);

  const handleStatusChange = async (
    item: FeedbackSummaryDto,
    status: FeedbackStatusDto,
  ) => {
    if (item.status === status || updatingId) return;

    setUpdatingId(item.id);
    setActionMessage(undefined);

    try {
      const updated = await updateModerationFeedbackStatus(item.id, status);

      if (statusFilter !== "all" && status !== statusFilter) {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      } else {
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: updated.status,
                  updatedAt: new Date().toISOString(),
                  reviewedAt:
                    updated.status === "new"
                      ? null
                      : new Date().toISOString(),
                }
              : entry,
          ),
        );
      }

      setActionMessage({
        message: `Geri bildirim “${statusLabels[updated.status]}” durumuna taşındı.`,
        tone: "success",
      });
    } catch {
      setActionMessage({
        message: "Durum güncellenemedi. Lütfen yeniden dene.",
        tone: "error",
      });
    } finally {
      setUpdatingId(undefined);
    }
  };

  return (
    <div className="grid min-w-0 gap-4 p-3 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-white/9 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
            Ürün geri bildirimi
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.045em]">
            Kullanıcı notları
          </h2>
          <p className="mt-1.5 text-sm text-white/52">
            Üye ve misafirlerden gelen hata ve önerileri tek sırada yönet.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:w-auto">
          <label className="grid gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-white/42">
            Durum
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as FeedbackStatusDto | "all")
              }
              className={`min-h-11 min-w-36 rounded-xl border border-white/10 bg-surface-raised px-3 text-xs font-bold normal-case tracking-normal text-white ${focusRing}`}
            >
              <option value="all">Tümü</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-white/42">
            Konu
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value as FeedbackCategoryDto | "all",
                )
              }
              className={`min-h-11 min-w-32 rounded-xl border border-white/10 bg-surface-raised px-3 text-xs font-bold normal-case tracking-normal text-white ${focusRing}`}
            >
              <option value="all">Tümü</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {actionMessage && <ActionStatusText status={actionMessage} />}

      {isLoading ? (
        <div className="grid gap-3" aria-label="Geri bildirimler yükleniyor">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-2xl border border-white/8 bg-white/[0.025]"
            />
          ))}
        </div>
      ) : hasFailed ? (
        <div className="border border-danger/25 bg-danger/6 p-5">
          <p className="text-sm font-bold text-danger">
            Geri bildirim sırası yüklenemedi.
          </p>
          <button
            type="button"
            onClick={reload}
            className={`mt-3 min-h-10 rounded-full border border-white/12 px-4 text-xs font-black ${focusRing}`}
          >
            Yeniden dene
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="grid min-h-52 place-items-center border border-white/9 bg-white/[0.018] p-6 text-center">
          <div>
            <p className="text-lg font-black">Bu filtrede kayıt yok</p>
            <p className="mt-2 text-sm text-white/48">
              Yeni bir not geldiğinde burada görünecek.
            </p>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="grid gap-4 rounded-2xl border border-white/9 bg-white/[0.018] p-4 sm:grid-cols-[minmax(0,1fr)_10.5rem] sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-brand/28 bg-brand/8 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-brand">
                    {categoryLabels[item.category]}
                  </span>
                  <span className="text-xs font-bold text-white/62">
                    {submitterLabel(item)}
                  </span>
                  <span className="text-[11px] text-white/34">
                    {dateFormatter.format(new Date(item.createdAt))}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/84">
                  {item.message}
                </p>
                <p className="mt-3 truncate font-mono text-[9px] uppercase tracking-[0.1em] text-white/34">
                  Sayfa · {item.pagePath}
                </p>
              </div>

              <label className="grid content-start gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white/42">
                Durum
                <select
                  value={item.status}
                  disabled={updatingId === item.id}
                  onChange={(event) =>
                    handleStatusChange(
                      item,
                      event.target.value as FeedbackStatusDto,
                    )
                  }
                  className={`min-h-11 rounded-xl border border-white/10 bg-surface-raised px-3 text-xs font-black normal-case tracking-normal text-white disabled:opacity-45 ${focusRing}`}
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          disabled={isLoadingMore}
          onClick={loadMore}
          className={`mx-auto min-h-11 rounded-full border border-white/12 px-6 text-xs font-black transition-colors hover:bg-white/6 disabled:opacity-45 ${focusRing}`}
        >
          {isLoadingMore ? "Yükleniyor…" : "Daha fazla göster"}
        </button>
      )}
    </div>
  );
}
