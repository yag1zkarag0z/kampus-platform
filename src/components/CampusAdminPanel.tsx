"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { useCampusData } from "@/components/CampusDataProvider";
import {
  type CampusContentReport,
  type CampusModerationHistoryAction,
  type CampusModerationResolution,
  type CampusReportReason,
  useCampusModeration,
} from "@/components/CampusModerationProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  campusAdminRoleLabels,
  type CampusAdminRole,
  type CampusManagedUser,
} from "@/data/campusAdmin";
import {
  campusPosts,
  type CampusComment,
  type CampusPost,
} from "@/data/campusPosts";

type AdminView = "overview" | "reports" | "users" | "history";
type ReportFilter = "pending" | "resolved" | "all";
type TargetContext = {
  post?: CampusPost;
  comment?: CampusComment;
  title: string;
  excerpt: string;
  author: string;
  authorId?: string;
};

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/28 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf8f1] dark:focus-visible:ring-[#c7896d]/38 dark:focus-visible:ring-offset-[#17191c]";

const adminViews: { id: AdminView; label: string }[] = [
  { id: "overview", label: "Genel bakış" },
  { id: "reports", label: "Şikâyetler" },
  { id: "users", label: "Kullanıcılar" },
  { id: "history", label: "Geçmiş" },
];

const reportFilters: { id: ReportFilter; label: string }[] = [
  { id: "pending", label: "Bekleyen" },
  { id: "resolved", label: "Çözülen" },
  { id: "all", label: "Tümü" },
];

const reasonLabels: Record<CampusReportReason, string> = {
  spam: "Spam veya reklam",
  harassment: "Taciz veya zorbalık",
  "personal-information": "Kişisel bilgi",
  misleading: "Yanıltıcı içerik",
  other: "Diğer",
};

const resolutionLabels: Record<CampusModerationResolution, string> = {
  dismissed: "İhlal bulunmadı",
  "content-removed": "İçerik kaldırıldı",
  "user-suspended": "Kullanıcı askıya alındı",
};

const historyLabels: Record<CampusModerationHistoryAction, string> = {
  ...resolutionLabels,
  "user-restored": "Kullanıcı yeniden etkinleştirildi",
  "role-changed": "Kullanıcı rolü değiştirildi",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: number) {
  return dateFormatter.format(new Date(value));
}

function getReportTarget(
  report: CampusContentReport,
  posts: CampusPost[],
): TargetContext {
  const post = posts.find((item) => item.id === report.postId);

  if (!post) {
    return {
      title:
        report.targetType === "comment"
          ? "Yorum artık bulunamıyor"
          : "Gönderi artık bulunamıyor",
      excerpt:
        "İçerik silinmiş veya bu cihazdaki kayıtlarla eşleşmiyor.",
      author: "Bilinmeyen kullanıcı",
    };
  }

  if (report.targetType === "comment") {
    const comment = post.comments.find(
      (item) => item.id === report.targetId,
    );

    if (!comment) {
      return {
        post,
        title: `“${post.title || "Başlıksız gönderi"}” içindeki yorum`,
        excerpt: "Yorum artık bu gönderide bulunmuyor.",
        author: "Bilinmeyen kullanıcı",
      };
    }

    return {
      post,
      comment,
      title: `“${post.title || "Başlıksız gönderi"}” içindeki yorum`,
      excerpt: comment.body,
      author: comment.author,
      authorId: comment.authorId,
    };
  }

  return {
    post,
    title: post.title || "Başlıksız gönderi",
    excerpt: post.body,
    author: post.author,
    authorId: post.authorId,
  };
}

export default function CampusAdminPanel() {
  const {
    isHydrated: isAccountHydrated,
    sessionMode,
    role,
  } = useCampusAccount();
  const {
    posts,
    isHydrated: isDataHydrated,
    moderateDeletePost,
    moderateDeleteComment,
  } = useCampusData();
  const {
    reports,
    pendingReportCount,
    managedUsers,
    moderationHistory,
    isHydrated: isModerationHydrated,
    resolveReport,
    setUserRole,
    suspendUser,
    restoreUser,
  } = useCampusModeration();
  const { confirm: confirmAction, showToast } = useFeedback();
  const [activeView, setActiveView] =
    useState<AdminView>("overview");
  const [reportFilter, setReportFilter] =
    useState<ReportFilter>("pending");
  const [selectedReportId, setSelectedReportId] = useState<string>();
  const [userQuery, setUserQuery] = useState("");

  const isHydrated =
    isAccountHydrated && isDataHydrated && isModerationHydrated;
  const allPosts = useMemo(() => {
    const postMap = new Map(
      campusPosts.map((post) => [post.id, post]),
    );
    posts.forEach((post) => postMap.set(post.id, post));
    return Array.from(postMap.values());
  }, [posts]);
  const sortedReports = useMemo(
    () =>
      [...reports].sort((first, second) => {
        if (first.status !== second.status) {
          return first.status === "pending" ? -1 : 1;
        }

        return second.reportedAt - first.reportedAt;
      }),
    [reports],
  );
  const filteredReports = useMemo(
    () =>
      sortedReports.filter(
        (report) =>
          reportFilter === "all" || report.status === reportFilter,
      ),
    [reportFilter, sortedReports],
  );
  const selectedReport =
    filteredReports.find((report) => report.id === selectedReportId) ??
    filteredReports[0];
  const selectedTarget = selectedReport
    ? getReportTarget(selectedReport, allPosts)
    : undefined;
  const resolvedCount = reports.length - pendingReportCount;
  const suspendedCount = managedUsers.filter(
    (user) => user.status === "suspended",
  ).length;
  const teamCount = managedUsers.filter(
    (user) => user.role !== "member",
  ).length;
  const filteredUsers = useMemo(() => {
    const normalizedQuery = userQuery
      .trim()
      .toLocaleLowerCase("tr-TR");

    if (!normalizedQuery) {
      return managedUsers;
    }

    return managedUsers.filter((user) =>
      [
        user.author,
        user.displayName,
        user.department,
        campusAdminRoleLabels[user.role],
      ].some((value) =>
        value.toLocaleLowerCase("tr-TR").includes(normalizedQuery),
      ),
    );
  }, [managedUsers, userQuery]);

  if (!isHydrated) {
    return <AdminPanelSkeleton />;
  }

  if (
    sessionMode !== "member" ||
    (role !== "admin" && role !== "moderator")
  ) {
    return (
      <section className="grid min-h-[calc(100svh-4rem)] place-items-center bg-[#fbf8f1] px-4 py-16 text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1] md:min-h-svh">
        <div className="w-full max-w-lg border border-[#1c2821]/13 bg-white/35 p-6 text-center dark:border-white/11 dark:bg-white/[0.025] sm:p-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#8b2f2a] dark:text-[#e18a7d]">
            Yetkili alanı
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.045em]">
            Bu alan yönetici veya moderatör yetkisi gerektiriyor
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#58635c] dark:text-[#aeb4af]">
            Misafir profiliyle topluluğu inceleyebilirsin; moderasyon
            araçlarına erişmek için yönetici hesabıyla giriş yapmalısın.
          </p>
          <Link
            href="/giris"
            className={`mt-6 inline-flex min-h-11 items-center justify-center bg-[#5a1f32] px-5 text-xs font-black text-white transition-colors hover:bg-[#481527] dark:bg-[#c7896d] dark:text-[#17191c] dark:hover:bg-[#d79a7b] ${focusRing}`}
          >
            Giriş yap
          </Link>
        </div>
      </section>
    );
  }

  const handleReportAction = async (
    report: CampusContentReport,
    resolution: CampusModerationResolution,
  ) => {
    const target = getReportTarget(report, allPosts);
    const isDangerous = resolution !== "dismissed";
    const descriptions: Record<CampusModerationResolution, string> = {
      dismissed:
        "Şikâyet çözüldü olarak işaretlenecek ve içerik yayında kalacak.",
      "content-removed":
        "İçerik moderasyon kaydında kaldırılmış olarak işaretlenecek.",
      "user-suspended": target.authorId
        ? `${target.author} askıya alınacak ve şikâyet çözülecek.`
        : "Bu içeriğin hesap sahibi belirlenemediği için kullanıcı askıya alınamaz.",
    };

    if (resolution === "user-suspended" && !target.authorId) {
      showToast({
        message: "Anonim veya kimliği belirlenemeyen hesap askıya alınamaz.",
        tone: "error",
      });
      return;
    }

    const confirmed = await confirmAction({
      title: resolutionLabels[resolution],
      description: descriptions[resolution],
      confirmLabel:
        resolution === "dismissed"
          ? "Şikâyeti kapat"
          : resolution === "content-removed"
            ? "İçeriği kaldır"
            : "Kullanıcıyı askıya al",
      tone: isDangerous ? "danger" : "default",
    });

    if (!confirmed) {
      return;
    }

    const wasResolved = resolveReport(report.id, resolution, {
      authorId: target.authorId,
      author: target.author,
      note:
        resolution === "dismissed"
          ? "Topluluk kuralları ihlali bulunmadı."
          : undefined,
    });
    const wasContentRemoved =
      resolution !== "content-removed"
        ? true
        : report.targetType === "comment"
          ? moderateDeleteComment(report.postId, report.targetId)
          : moderateDeletePost(report.postId);

    showToast({
      message: wasResolved
        ? resolution === "content-removed" && !wasContentRemoved
          ? "Şikâyet kapatıldı; içerik daha önce kaldırılmış."
          : `${resolutionLabels[resolution]}.`
        : "Şikâyet daha önce işleme alınmış.",
      tone: wasResolved ? "success" : "info",
    });
  };

  const handleRoleChange = (
    user: CampusManagedUser,
    role: CampusAdminRole,
  ) => {
    const wasUpdated = setUserRole(user.authorId, role);
    showToast({
      message: wasUpdated
        ? `${user.author} artık ${campusAdminRoleLabels[role].toLocaleLowerCase("tr-TR")}.`
        : "Rol değiştirilemedi.",
      tone: wasUpdated ? "success" : "info",
    });
  };

  const handleSuspendUser = async (user: CampusManagedUser) => {
    const confirmed = await confirmAction({
      title: `${user.author} askıya alınsın mı?`,
      description:
        "Hesap yönetim görünümünde askıya alınmış olarak işaretlenecek. Bu işlem daha sonra geri alınabilir.",
      confirmLabel: "Askıya al",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    const wasSuspended = suspendUser(user.authorId);
    showToast({
      message: wasSuspended
        ? `${user.author} askıya alındı.`
        : "Kullanıcı askıya alınamadı.",
      tone: wasSuspended ? "success" : "error",
    });
  };

  const handleRestoreUser = async (user: CampusManagedUser) => {
    const confirmed = await confirmAction({
      title: `${user.author} yeniden etkinleştirilsin mi?`,
      description:
        "Kullanıcının hesap durumu yeniden aktif olarak işaretlenecek.",
      confirmLabel: "Etkinleştir",
    });

    if (!confirmed) {
      return;
    }

    const wasRestored = restoreUser(user.authorId);
    showToast({
      message: wasRestored
        ? `${user.author} yeniden etkinleştirildi.`
        : "Hesap durumu değiştirilemedi.",
      tone: wasRestored ? "success" : "error",
    });
  };

  return (
    <section
      aria-labelledby="admin-panel-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#fbf8f1] text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1] md:min-h-svh"
    >
      <header className="border-b border-[#1c2821]/12 bg-[#f5efe6] dark:border-white/10 dark:bg-[#1b1d20]">
        <div className="flex min-h-24 flex-col justify-center gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-[#52735a] shadow-[0_0_0_4px_rgba(82,115,90,0.12)]"
              />
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#7d3c2d] dark:text-[#c7896d]">
                Yönetim merkezi
              </p>
            </div>
            <h1
              id="admin-panel-title"
              className="mt-1 text-2xl font-black tracking-[-0.05em] sm:text-3xl"
            >
              KAMPÜS Moderasyon
            </h1>
          </div>
          <div className="flex items-center gap-3 border-l-2 border-[#5a1f32]/25 pl-3 dark:border-[#c7896d]/35">
            <div className="text-right">
              <p className="text-xs font-black">Yağız Karagöz</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#58635c] dark:text-[#aeb4af]">
                Yönetici
              </p>
            </div>
            <CampusAuthorAvatar
              author="@yagizkaragoz"
              authorId="local-current-account"
              size="md"
            />
          </div>
        </div>

        <nav
          aria-label="Yönetim paneli bölümleri"
          className="overflow-x-auto border-t border-[#1c2821]/8 px-2 py-2 dark:border-white/7 sm:px-5"
        >
          <div className="grid min-w-[31rem] grid-cols-4 gap-1">
            {adminViews.map((view) => {
              const isActive = activeView === view.id;
              const count =
                view.id === "reports"
                  ? pendingReportCount
                  : view.id === "history"
                    ? moderationHistory.length
                    : undefined;

              return (
                <button
                  key={view.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setActiveView(view.id)}
                  className={`min-h-11 cursor-pointer px-3 text-xs font-black transition-colors ${focusRing} ${
                    isActive
                      ? "bg-[#5a1f32]/9 text-[#5a1f32] dark:bg-[#c7896d]/12 dark:text-[#e0aa8d]"
                      : "text-[#1c2821]/58 hover:bg-[#1c2821]/5 hover:text-[#1c2821] dark:text-white/52 dark:hover:bg-white/5 dark:hover:text-white"
                  }`}
                >
                  {view.label}
                  {count !== undefined && count > 0 && (
                    <span className="ml-2 inline-flex min-w-5 justify-center rounded-full bg-[#8b2f2a] px-1.5 py-0.5 font-mono text-[9px] text-white dark:bg-[#d27368] dark:text-[#17191c]">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {activeView === "overview" && (
        <div className="grid gap-5 p-3 sm:p-6">
          <div
            aria-label="Moderasyon özeti"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
          >
            <StatCard
              label="Bekleyen"
              value={pendingReportCount}
              helper="İşlem bekleyen şikâyet"
              tone="alert"
            />
            <StatCard
              label="Çözülen"
              value={resolvedCount}
              helper="Toplam moderasyon kararı"
            />
            <StatCard
              label="Ekip"
              value={teamCount}
              helper="Yönetici ve moderatör"
              tone="team"
            />
            <StatCard
              label="Askıda"
              value={suspendedCount}
              helper="Askıya alınmış hesap"
              tone="muted"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
            <AdminCard
              eyebrow="İş sırası"
              title="Öncelikli şikâyetler"
              description="En yeni bekleyen kayıtlar önce gösterilir."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setReportFilter("pending");
                    setActiveView("reports");
                  }}
                  className={`min-h-11 px-3 text-xs font-black text-[#7d3c2d] hover:bg-[#5a1f32]/6 dark:text-[#d09272] dark:hover:bg-[#c7896d]/8 ${focusRing}`}
                >
                  Tümünü incele
                </button>
              }
            >
              {sortedReports.filter(
                (report) => report.status === "pending",
              ).length > 0 ? (
                <ul className="divide-y divide-[#1c2821]/9 dark:divide-white/8">
                  {sortedReports
                    .filter((report) => report.status === "pending")
                    .slice(0, 4)
                    .map((report) => {
                      const target = getReportTarget(report, allPosts);

                      return (
                        <li key={report.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReportId(report.id);
                              setReportFilter("pending");
                              setActiveView("reports");
                            }}
                            className={`flex min-h-20 w-full cursor-pointer items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-[#1c2821]/4 dark:hover:bg-white/4 ${focusRing}`}
                          >
                            <TargetTypeBadge
                              type={report.targetType}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black">
                                {target.title}
                              </span>
                              <span className="mt-1 block truncate text-xs text-[#58635c] dark:text-[#aeb4af]">
                                {reasonLabels[report.reason]} ·{" "}
                                {target.author}
                              </span>
                            </span>
                            <span className="hidden font-mono text-[9px] text-[#58635c] dark:text-[#aeb4af] sm:block">
                              {formatDate(report.reportedAt)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <AdminEmptyState
                  title="Bekleyen şikâyet yok"
                  description="Yeni bir bildirim geldiğinde burada öncelik sırasıyla görünecek."
                />
              )}
            </AdminCard>

            <div className="grid gap-5">
              <AdminCard
                eyebrow="Ekip"
                title="Yetki dağılımı"
                description="Yerel yönetim görünümündeki roller."
              >
                <dl className="grid gap-3">
                  {(["admin", "moderator", "member"] as const).map(
                    (role) => (
                      <div
                        key={role}
                        className="flex items-center justify-between border-b border-[#1c2821]/8 pb-3 last:border-0 last:pb-0 dark:border-white/7"
                      >
                        <dt className="text-xs font-bold text-[#58635c] dark:text-[#aeb4af]">
                          {campusAdminRoleLabels[role]}
                        </dt>
                        <dd className="font-mono text-sm font-black">
                          {
                            managedUsers.filter(
                              (user) => user.role === role,
                            ).length
                          }
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </AdminCard>

              <AdminCard
                eyebrow="Son işlem"
                title={
                  moderationHistory[0]
                    ? historyLabels[moderationHistory[0].action]
                    : "Henüz işlem yok"
                }
                description={
                  moderationHistory[0]
                    ? `${moderationHistory[0].moderator} · ${formatDate(
                        moderationHistory[0].createdAt,
                      )}`
                    : "İlk moderasyon kararın burada özetlenecek."
                }
              >
                <button
                  type="button"
                  disabled={moderationHistory.length === 0}
                  onClick={() => setActiveView("history")}
                  className={`min-h-11 w-full border border-[#1c2821]/13 px-3 text-xs font-black transition-colors hover:bg-[#1c2821]/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/11 dark:hover:bg-white/6 ${focusRing}`}
                >
                  Geçmişi aç
                </button>
              </AdminCard>
            </div>
          </div>
        </div>
      )}

      {activeView === "reports" && (
        <div className="grid min-w-0 gap-4 p-3 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-[#1c2821]/10 pb-4 dark:border-white/9 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
                Moderasyon kuyruğu
              </p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">
                Şikâyetler
              </h2>
            </div>
            <div
              role="group"
              aria-label="Şikâyet durumunu filtrele"
              className="grid grid-cols-3 gap-1 border border-[#1c2821]/11 p-1 dark:border-white/10"
            >
              {reportFilters.map((filter) => {
                const isActive = reportFilter === filter.id;
                const count =
                  filter.id === "all"
                    ? reports.length
                    : reports.filter(
                        (report) => report.status === filter.id,
                      ).length;

                return (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setReportFilter(filter.id)}
                    className={`min-h-11 px-2 text-[11px] font-black transition-colors sm:px-3 sm:text-xs ${focusRing} ${
                      isActive
                        ? "bg-[#5a1f32]/9 text-[#5a1f32] dark:bg-[#c7896d]/12 dark:text-[#e0aa8d]"
                        : "text-[#58635c] hover:bg-[#1c2821]/5 dark:text-[#aeb4af] dark:hover:bg-white/5"
                    }`}
                  >
                    {filter.label}
                    <span className="ml-1 font-mono text-[9px]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredReports.length > 0 && selectedReport && selectedTarget ? (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(15rem,0.76fr)_minmax(0,1.24fr)]">
              <div className="border border-[#1c2821]/11 bg-white/22 dark:border-white/9 dark:bg-white/[0.015]">
                <ul className="divide-y divide-[#1c2821]/9 dark:divide-white/8">
                  {filteredReports.map((report) => {
                    const target = getReportTarget(report, allPosts);
                    const isSelected = report.id === selectedReport.id;

                    return (
                      <li key={report.id}>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedReportId(report.id)}
                          className={`flex min-h-24 w-full cursor-pointer gap-3 border-l-3 px-3 py-3 text-left transition-colors ${focusRing} ${
                            isSelected
                              ? "border-[#5a1f32] bg-[#5a1f32]/7 dark:border-[#c7896d] dark:bg-[#c7896d]/9"
                              : "border-transparent hover:bg-[#1c2821]/4 dark:hover:bg-white/4"
                          }`}
                        >
                          <TargetTypeBadge type={report.targetType} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-black">
                                {reasonLabels[report.reason]}
                              </span>
                              <ReportStatusBadge report={report} compact />
                            </span>
                            <span className="mt-1.5 block truncate text-xs text-[#58635c] dark:text-[#aeb4af]">
                              {target.title}
                            </span>
                            <span className="mt-2 block font-mono text-[9px] text-[#58635c]/75 dark:text-[#aeb4af]/78">
                              {formatDate(report.reportedAt)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <article
                aria-label="Seçili şikâyet ayrıntıları"
                className="min-w-0 border border-[#1c2821]/12 bg-white/30 p-4 dark:border-white/10 dark:bg-white/[0.02] sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <TargetTypeBadge type={selectedReport.targetType} />
                      <ReportStatusBadge report={selectedReport} />
                    </div>
                    <h3 className="mt-3 text-xl font-black tracking-[-0.04em]">
                      {reasonLabels[selectedReport.reason]}
                    </h3>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#58635c] dark:text-[#aeb4af]">
                      Bildirim · {formatDate(selectedReport.reportedAt)}
                    </p>
                  </div>
                  {selectedTarget.post && (
                    <Link
                      href={`/gonderi/${selectedTarget.post.id}`}
                      className={`inline-flex min-h-11 items-center justify-center border border-[#1c2821]/13 px-3 text-xs font-black transition-colors hover:bg-[#1c2821]/5 dark:border-white/11 dark:hover:bg-white/6 ${focusRing}`}
                    >
                      İçeriğe git
                    </Link>
                  )}
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="border-l-3 border-[#9a5944]/48 bg-[#9a5944]/6 px-4 py-3 dark:border-[#c7896d]/48 dark:bg-[#c7896d]/7">
                    <p className="text-[10px] font-black uppercase tracking-[0.11em] text-[#7d3c2d] dark:text-[#d09272]">
                      Şikâyet açıklaması
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#1c2821]/75 dark:text-white/72">
                      {selectedReport.detail ||
                        "Kullanıcı ek bir açıklama paylaşmadı."}
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#58635c] dark:text-[#aeb4af]">
                      İncelenen içerik
                    </p>
                    <div className="mt-2 border border-[#1c2821]/11 bg-[#f5efe6]/72 p-4 dark:border-white/9 dark:bg-[#202226]/72">
                      <div className="flex items-center gap-2">
                        <CampusAuthorAvatar
                          author={selectedTarget.author}
                          authorId={selectedTarget.authorId}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black">
                            {selectedTarget.author}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#58635c] dark:text-[#aeb4af]">
                            {selectedReport.targetType === "post"
                              ? "Gönderi sahibi"
                              : "Yorum sahibi"}
                          </p>
                        </div>
                      </div>
                      <h4 className="mt-3 text-sm font-black">
                        {selectedTarget.title}
                      </h4>
                      <p className="mt-1.5 line-clamp-5 whitespace-pre-wrap break-words text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
                        {selectedTarget.excerpt}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedReport.status === "pending" ? (
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleReportAction(selectedReport, "dismissed")
                      }
                      className={`min-h-11 border border-[#1c2821]/14 px-3 text-xs font-black transition-colors hover:bg-[#1c2821]/6 dark:border-white/12 dark:hover:bg-white/7 ${focusRing}`}
                    >
                      Yok say
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleReportAction(
                          selectedReport,
                          "content-removed",
                        )
                      }
                      className={`min-h-11 border border-[#9a5944]/38 px-3 text-xs font-black text-[#7d3c2d] transition-colors hover:bg-[#9a5944]/8 dark:border-[#c7896d]/38 dark:text-[#d09272] dark:hover:bg-[#c7896d]/9 ${focusRing}`}
                    >
                      İçeriği kaldır
                    </button>
                    <button
                      type="button"
                      disabled={!selectedTarget.authorId}
                      onClick={() =>
                        handleReportAction(
                          selectedReport,
                          "user-suspended",
                        )
                      }
                      className={`min-h-11 bg-[#8b2f2a] px-3 text-xs font-black text-white transition-colors hover:bg-[#762620] disabled:cursor-not-allowed disabled:bg-[#8b2f2a]/28 disabled:text-white/65 dark:bg-[#d27368] dark:text-[#17191c] dark:hover:bg-[#df887d] dark:disabled:bg-[#d27368]/25 dark:disabled:text-white/38 ${focusRing}`}
                    >
                      Kullanıcıyı askıya al
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 border border-[#52735a]/24 bg-[#52735a]/7 px-4 py-3 dark:border-[#8fba9b]/22 dark:bg-[#8fba9b]/7">
                    <p className="text-xs font-black text-[#31523d] dark:text-[#b5d8bd]">
                      {selectedReport.resolution
                        ? resolutionLabels[selectedReport.resolution]
                        : "Şikâyet çözüldü"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
                      {selectedReport.resolutionNote ||
                        "Moderasyon kararı geçmişe kaydedildi."}
                      {selectedReport.resolvedAt
                        ? ` · ${formatDate(selectedReport.resolvedAt)}`
                        : ""}
                    </p>
                  </div>
                )}
              </article>
            </div>
          ) : (
            <AdminEmptyState
              title={
                reportFilter === "pending"
                  ? "Bekleyen şikâyet yok"
                  : reportFilter === "resolved"
                    ? "Çözülmüş şikâyet yok"
                    : "Henüz şikâyet yok"
              }
              description="Topluluk üyelerinden gelen gönderi ve yorum bildirimleri burada incelenecek."
            />
          )}
        </div>
      )}

      {activeView === "users" && (
        <div className="grid gap-4 p-3 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-[#1c2821]/10 pb-4 dark:border-white/9 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
                Hesaplar ve roller
              </p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">
                Kullanıcı yönetimi
              </h2>
            </div>
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Kullanıcılarda ara</span>
              <input
                type="search"
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="İsim, kullanıcı adı veya bölüm ara"
                className={`min-h-11 w-full border border-[#1c2821]/14 bg-white/50 px-3 text-xs placeholder:text-[#68736c] dark:border-white/12 dark:bg-white/[0.035] dark:placeholder:text-[#9ba39d] ${focusRing}`}
              />
            </label>
          </div>

          {filteredUsers.length > 0 ? (
            <ul className="grid gap-3">
              {filteredUsers.map((user) => {
                const isCurrentAdmin =
                  user.authorId === "local-current-account";

                return (
                  <li
                    key={user.authorId}
                    className="grid min-w-0 gap-4 border border-[#1c2821]/11 bg-white/26 p-4 dark:border-white/9 dark:bg-white/[0.018] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <CampusAuthorAvatar
                        author={user.author}
                        authorId={user.authorId}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-black">
                            {user.displayName}
                          </p>
                          <AccountStatusBadge status={user.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#58635c] dark:text-[#aeb4af]">
                          {user.author} · {user.department}
                        </p>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[#58635c]/75 dark:text-[#aeb4af]/75">
                          Katılım · {user.joinedLabel}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 min-[420px]:grid-cols-2 sm:grid-cols-[9rem_8rem]">
                      <label>
                        <span className="sr-only">
                          {user.author} için rol seç
                        </span>
                        <select
                          value={user.role}
                          disabled={
                            isCurrentAdmin || role !== "admin"
                          }
                          title={
                            role === "admin"
                              ? undefined
                              : "Rol değişikliği yalnızca yöneticilere açıktır"
                          }
                          onChange={(event) =>
                            handleRoleChange(
                              user,
                              event.target.value as CampusAdminRole,
                            )
                          }
                          className={`min-h-11 w-full border border-[#1c2821]/14 bg-[#fbf8f1] px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/12 dark:bg-[#202226] ${focusRing}`}
                        >
                          {(
                            [
                              "member",
                              "moderator",
                              "admin",
                            ] as const
                          ).map((role) => (
                            <option key={role} value={role}>
                              {campusAdminRoleLabels[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {isCurrentAdmin ? (
                        <span className="inline-flex min-h-11 items-center justify-center border border-[#1c2821]/10 px-3 text-center text-[10px] font-bold text-[#58635c] dark:border-white/9 dark:text-[#aeb4af]">
                          Mevcut hesap
                        </span>
                      ) : user.status === "active" ? (
                        <button
                          type="button"
                          onClick={() => handleSuspendUser(user)}
                          className={`min-h-11 border border-[#a03c36]/35 px-3 text-xs font-black text-[#8b2f2a] transition-colors hover:bg-[#8b2f2a]/7 dark:border-[#d27368]/35 dark:text-[#e18a7d] dark:hover:bg-[#d27368]/8 ${focusRing}`}
                        >
                          Askıya al
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestoreUser(user)}
                          className={`min-h-11 border border-[#52735a]/34 px-3 text-xs font-black text-[#31523d] transition-colors hover:bg-[#52735a]/8 dark:border-[#8fba9b]/32 dark:text-[#b5d8bd] dark:hover:bg-[#8fba9b]/8 ${focusRing}`}
                        >
                          Etkinleştir
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <AdminEmptyState
              title="Eşleşen kullanıcı bulunamadı"
              description="Arama ifadesini kısaltarak tekrar deneyebilirsin."
            />
          )}
        </div>
      )}

      {activeView === "history" && (
        <div className="grid gap-4 p-3 sm:p-6">
          <div className="border-b border-[#1c2821]/10 pb-4 dark:border-white/9">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
              Denetim kaydı
            </p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">
              Moderasyon geçmişi
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
              Şikâyet kararları, hesap durumları ve rol değişiklikleri
              kronolojik olarak saklanır.
            </p>
          </div>

          {moderationHistory.length > 0 ? (
            <ol className="relative grid gap-3 before:absolute before:bottom-6 before:left-[1.2rem] before:top-6 before:w-px before:bg-[#1c2821]/13 dark:before:bg-white/11">
              {moderationHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3"
                >
                  <span className="relative z-10 mt-4 grid size-10 place-items-center rounded-full border border-[#1c2821]/13 bg-[#fbf8f1] dark:border-white/12 dark:bg-[#202226]">
                    <span
                      aria-hidden="true"
                      className={`size-2.5 rounded-full ${
                        entry.action === "content-removed" ||
                        entry.action === "user-suspended"
                          ? "bg-[#b34d42]"
                          : entry.action === "dismissed" ||
                              entry.action === "user-restored"
                            ? "bg-[#52735a]"
                            : "bg-[#9a5944]"
                      }`}
                    />
                  </span>
                  <article className="border border-[#1c2821]/11 bg-white/24 p-4 dark:border-white/9 dark:bg-white/[0.018]">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black">
                          {historyLabels[entry.action]}
                        </h3>
                        <p className="mt-1 text-xs text-[#58635c] dark:text-[#aeb4af]">
                          {entry.author
                            ? `${entry.author} · `
                            : ""}
                          {entry.targetType
                            ? entry.targetType === "post"
                              ? "Gönderi"
                              : "Yorum"
                            : "Hesap işlemi"}
                        </p>
                      </div>
                      <time
                        dateTime={new Date(entry.createdAt).toISOString()}
                        className="font-mono text-[9px] text-[#58635c] dark:text-[#aeb4af]"
                      >
                        {formatDate(entry.createdAt)}
                      </time>
                    </div>
                    {entry.note && (
                      <p className="mt-3 border-l-2 border-[#9a5944]/35 pl-3 text-xs leading-5 text-[#58635c] dark:border-[#c7896d]/38 dark:text-[#aeb4af]">
                        {entry.note}
                      </p>
                    )}
                    <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-[#58635c]/72 dark:text-[#aeb4af]/72">
                      İşlemi yapan · {entry.moderator}
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <AdminEmptyState
              title="Moderasyon geçmişi boş"
              description="Bir şikâyeti çözdüğünde veya kullanıcı rolünü değiştirdiğinde işlem burada kaydedilecek."
            />
          )}
        </div>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "default" | "alert" | "team" | "muted";
}) {
  const toneClasses = {
    default:
      "border-[#52735a]/20 bg-[#52735a]/5 dark:border-[#8fba9b]/18 dark:bg-[#8fba9b]/5",
    alert:
      "border-[#a03c36]/23 bg-[#a03c36]/6 dark:border-[#d27368]/22 dark:bg-[#d27368]/6",
    team: "border-[#5a1f32]/20 bg-[#5a1f32]/5 dark:border-[#c7896d]/20 dark:bg-[#c7896d]/6",
    muted:
      "border-[#1c2821]/12 bg-white/24 dark:border-white/10 dark:bg-white/[0.02]",
  };

  return (
    <article className={`min-w-0 border p-3 sm:p-4 ${toneClasses[tone]}`}>
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-[#58635c] dark:text-[#aeb4af]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-[-0.06em] sm:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-[#58635c] dark:text-[#aeb4af] sm:text-xs">
        {helper}
      </p>
    </article>
  );
}

function AdminCard({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 border border-[#1c2821]/11 bg-white/24 p-4 dark:border-white/9 dark:bg-white/[0.018] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-[#7d3c2d] dark:text-[#c7896d]">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-black tracking-[-0.035em]">
            {title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
            {description}
          </p>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TargetTypeBadge({
  type,
}: {
  type: CampusContentReport["targetType"];
}) {
  return (
    <span
      className={`inline-flex min-h-6 shrink-0 items-center px-2 font-mono text-[9px] font-black uppercase tracking-[0.08em] ${
        type === "post"
          ? "bg-[#5a1f32]/9 text-[#5a1f32] dark:bg-[#c7896d]/12 dark:text-[#e0aa8d]"
          : "bg-[#395943]/10 text-[#31523d] dark:bg-[#8fba9b]/11 dark:text-[#b5d8bd]"
      }`}
    >
      {type === "post" ? "Gönderi" : "Yorum"}
    </span>
  );
}

function ReportStatusBadge({
  report,
  compact = false,
}: {
  report: CampusContentReport;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-mono font-black uppercase tracking-[0.07em] ${
        compact ? "min-h-5 px-1.5 text-[8px]" : "min-h-6 px-2 text-[9px]"
      } ${
        report.status === "pending"
          ? "bg-[#a03c36]/10 text-[#8b2f2a] dark:bg-[#d27368]/12 dark:text-[#e18a7d]"
          : "bg-[#52735a]/10 text-[#31523d] dark:bg-[#8fba9b]/11 dark:text-[#b5d8bd]"
      }`}
    >
      {report.status === "pending" ? "Bekliyor" : "Çözüldü"}
    </span>
  );
}

function AccountStatusBadge({
  status,
}: {
  status: CampusManagedUser["status"];
}) {
  return (
    <span
      className={`inline-flex min-h-5 items-center rounded-full px-2 font-mono text-[8px] font-black uppercase tracking-[0.07em] ${
        status === "active"
          ? "bg-[#52735a]/10 text-[#31523d] dark:bg-[#8fba9b]/11 dark:text-[#b5d8bd]"
          : "bg-[#a03c36]/10 text-[#8b2f2a] dark:bg-[#d27368]/12 dark:text-[#e18a7d]"
      }`}
    >
      {status === "active" ? "Aktif" : "Askıda"}
    </span>
  );
}

function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border border-dashed border-[#1c2821]/16 px-4 py-10 text-center dark:border-white/13">
      <span
        aria-hidden="true"
        className="mx-auto grid size-12 place-items-center rounded-full bg-[#1c2821]/6 font-serif text-xl font-black italic text-[#58635c] dark:bg-white/6 dark:text-[#aeb4af]"
      >
        ✓
      </span>
      <h3 className="mt-3 text-sm font-black">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
        {description}
      </p>
    </div>
  );
}

function AdminPanelSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Yönetim paneli yükleniyor"
      className="min-h-[calc(100svh-4rem)] bg-[#fbf8f1] p-3 dark:bg-[#17191c] sm:p-6 md:min-h-svh"
    >
      <div className="h-24 animate-pulse bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            aria-hidden="true"
            className="h-28 animate-pulse bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="h-80 animate-pulse bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none" />
        <div className="h-80 animate-pulse bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none" />
      </div>
    </section>
  );
}
