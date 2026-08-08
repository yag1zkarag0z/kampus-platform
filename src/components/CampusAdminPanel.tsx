"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import ActionStatusText from "@/components/ActionStatusText";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import { campusButton } from "@/components/campusButtonStyles";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import {
  type CampusModerationResolution,
  type CampusReportReason,
  useCampusModeration,
} from "@/components/CampusModerationProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { useActionStatus } from "@/components/useActionStatus";
import {
  campusAdminRoleLabels,
  type CampusAdminRole,
} from "@/data/campusAdmin";
import type {
  ManagedUserDto,
  ModerationHistoryEntryDto,
  ReportSummaryDto,
} from "@/moderation/client";

type AdminView = "overview" | "reports" | "users" | "history";
type ReportFilter = "pending" | "resolved" | "all";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

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
  personal_information: "Kişisel bilgi",
  misleading: "Yanıltıcı içerik",
  other: "Diğer",
};

const resolutionLabels: Record<CampusModerationResolution, string> = {
  dismissed: "İhlal bulunmadı",
  content_removed: "İçerik kaldırıldı",
  user_suspended: "Kullanıcı askıya alındı",
};

const historyLabels: Record<ModerationHistoryEntryDto["action"], string> = {
  report_dismissed: "Şikâyet reddedildi",
  content_removed: "İçerik kaldırıldı",
  content_hidden: "İçerik otomatik gizlendi",
  content_restored: "İçerik yeniden yayımlandı",
  user_suspended: "Kullanıcı askıya alındı",
  user_restored: "Kullanıcı yeniden etkinleştirildi",
  role_changed: "Kullanıcı rolü değiştirildi",
};

/** Otomatik gizlemede insan aktör yoktur. */
function historyActorLabel(entry: ModerationHistoryEntryDto) {
  return entry.actor ? `@${entry.actor.username}` : "Otomatik koruma";
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export default function CampusAdminPanel() {
  const {
    accountId,
    profile,
    isHydrated: isAccountHydrated,
    sessionMode,
    role,
  } = useCampusAccount();
  const {
    reports,
    pendingReportCount,
    managedUsers,
    moderationHistory,
    isModerationHydrated,
    resolveReport,
    setUserRole,
    suspendUser,
    restoreUser,
  } = useCampusModeration();
  const { confirm: confirmAction } = useFeedback();
  const [activeView, setActiveView] =
    useState<AdminView>("overview");
  const [reportFilter, setReportFilter] =
    useState<ReportFilter>("pending");
  const [selectedReportId, setSelectedReportId] = useState<string>();
  const [userQuery, setUserQuery] = useState("");
  const [reportStatus, setReportStatus] = useActionStatus();
  const [userActionStatus, setUserActionStatus] = useActionStatus();
  const [userActionAnchor, setUserActionAnchor] = useState<string | null>(
    null,
  );

  const isHydrated = isAccountHydrated && isModerationHydrated;
  const sortedReports = useMemo(
    () =>
      [...reports].sort((first, second) => {
        if (first.status !== second.status) {
          return first.status === "pending" ? -1 : 1;
        }

        return (
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime()
        );
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
        user.username,
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
      <section className="grid min-h-[calc(100svh-4rem)] place-items-center bg-canvas px-4 py-16 text-white md:min-h-svh">
        <div className="w-full max-w-lg border border-white/12 bg-surface-raised p-6 text-center sm:p-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-danger">
            Yetkili alanı
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.045em]">
            Bu alan yönetici veya moderatör yetkisi gerektiriyor
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/62">
            Misafir profiliyle topluluğu inceleyebilirsin; moderasyon
            araçlarına erişmek için yönetici hesabıyla giriş yapmalısın.
          </p>
          <Link
            href="/giris"
            className={`mt-6 ${campusButton.primary} `}
          >
            Giriş yap
          </Link>
        </div>
      </section>
    );
  }

  const handleReportAction = async (
    report: ReportSummaryDto,
    resolution: CampusModerationResolution,
  ) => {
    const isDangerous = resolution !== "dismissed";
    const descriptions: Record<CampusModerationResolution, string> = {
      dismissed:
        "Şikâyet çözüldü olarak işaretlenecek ve içerik yayında kalacak.",
      content_removed:
        "İçerik kaldırılacak ve şikâyet çözülecek.",
      user_suspended: report.target.authorId
        ? `${report.target.author ? `@${report.target.author.username}` : "Kullanıcı"} askıya alınacak ve şikâyet çözülecek.`
        : "Bu içeriğin hesap sahibi belirlenemediği için kullanıcı askıya alınamaz.",
    };

    if (resolution === "user_suspended" && !report.target.authorId) {
      setReportStatus({
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
          : resolution === "content_removed"
            ? "İçeriği kaldır"
            : "Kullanıcıyı askıya al",
      tone: isDangerous ? "danger" : "default",
    });

    if (!confirmed) {
      return;
    }

    const wasResolved = await resolveReport(
      report.id,
      resolution,
      resolution === "dismissed"
        ? "Topluluk kuralları ihlali bulunmadı."
        : undefined,
    );

    setReportStatus({
      message: wasResolved
        ? `${resolutionLabels[resolution]}.`
        : "Şikâyet çözülemedi. Lütfen yeniden dene.",
      tone: wasResolved ? "success" : "error",
    });
  };

  const handleRoleChange = async (
    user: ManagedUserDto,
    nextRole: CampusAdminRole,
  ) => {
    const wasUpdated = await setUserRole(user.id, nextRole);
    setUserActionAnchor(user.id);
    setUserActionStatus({
      message: wasUpdated
        ? `@${user.username} artık ${campusAdminRoleLabels[nextRole].toLocaleLowerCase("tr-TR")}.`
        : "Rol değiştirilemedi.",
      tone: wasUpdated ? "success" : "error",
    });
  };

  const handleSuspendUser = async (user: ManagedUserDto) => {
    const confirmed = await confirmAction({
      title: `@${user.username} askıya alınsın mı?`,
      description:
        "Hesap askıya alınacak, mevcut oturumu bir sonraki istekte otomatik sonlanacak. Bu işlem daha sonra geri alınabilir.",
      confirmLabel: "Askıya al",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    const wasSuspended = await suspendUser(
      user.id,
      "Kullanıcı yönetiminden askıya alındı.",
    );
    setUserActionAnchor(user.id);
    setUserActionStatus({
      message: wasSuspended
        ? `@${user.username} askıya alındı.`
        : "Kullanıcı askıya alınamadı.",
      tone: wasSuspended ? "success" : "error",
    });
  };

  const handleRestoreUser = async (user: ManagedUserDto) => {
    const confirmed = await confirmAction({
      title: `@${user.username} yeniden etkinleştirilsin mi?`,
      description:
        "Kullanıcının hesap durumu yeniden aktif olarak işaretlenecek.",
      confirmLabel: "Etkinleştir",
    });

    if (!confirmed) {
      return;
    }

    const wasRestored = await restoreUser(user.id);
    setUserActionAnchor(user.id);
    setUserActionStatus({
      message: wasRestored
        ? `@${user.username} yeniden etkinleştirildi.`
        : "Hesap durumu değiştirilemedi.",
      tone: wasRestored ? "success" : "error",
    });
  };

  return (
    <section
      aria-labelledby="admin-panel-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-canvas text-white md:min-h-svh"
    >
      <header className="border-b border-white/10 bg-surface-raised">
        <div className="flex min-h-24 flex-col justify-center gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-[#69c990] shadow-[0_0_0_4px_rgba(143,186,155,0.14)]"
              />
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-brand">
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
          <div className="flex items-center gap-3 border-l-2 border-brand/35 pl-3">
            <div className="text-right">
              <p className="text-xs font-black">{profile.displayName}</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">
                {campusAdminRoleLabels[role]}
              </p>
            </div>
            <CampusAuthorAvatar
              author={`@${profile.username}`}
              authorId={accountId ?? undefined}
              avatarUrl={profile.avatarUrl}
              size="md"
            />
          </div>
        </div>

        <nav
          aria-label="Yönetim paneli bölümleri"
          className="overflow-x-auto border-t border-white/7 px-2 py-2 sm:px-5"
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
                      ? "bg-brand/12 text-brand"
                      : "text-white/55 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {view.label}
                  {count !== undefined && count > 0 && (
                    <span className="ml-2 inline-flex min-w-5 justify-center rounded-full bg-danger px-1.5 py-0.5 font-mono text-[9px] text-[#0b0b0c]">
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
                  className={`min-h-11 px-3 text-xs font-black text-brand hover:bg-brand/8 ${focusRing}`}
                >
                  Tümünü incele
                </button>
              }
            >
              {sortedReports.filter(
                (report) => report.status === "pending",
              ).length > 0 ? (
                <ul className="divide-y divide-white/8">
                  {sortedReports
                    .filter((report) => report.status === "pending")
                    .slice(0, 4)
                    .map((report) => (
                      <li key={report.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReportId(report.id);
                            setReportFilter("pending");
                            setActiveView("reports");
                          }}
                          className={`flex min-h-20 w-full cursor-pointer items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-white/4 ${focusRing}`}
                        >
                          <TargetTypeBadge type={report.targetType} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black">
                              {report.target.excerpt ||
                                "İçerik artık mevcut değil"}
                            </span>
                            <span className="mt-1 block truncate text-xs text-white/55">
                              {reasonLabels[report.reason]}
                              {report.target.author
                                ? ` · @${report.target.author.username}`
                                : ""}
                            </span>
                          </span>
                          <span className="hidden font-mono text-[9px] text-white/55 sm:block">
                            {formatDate(report.createdAt)}
                          </span>
                        </button>
                      </li>
                    ))}
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
                description="Kayıtlı yönetim ve moderatör rolleri."
              >
                <dl className="grid gap-3">
                  {(["admin", "moderator", "member"] as const).map(
                    (roleOption) => (
                      <div
                        key={roleOption}
                        className="flex items-center justify-between border-b border-white/7 pb-3 last:border-0 last:pb-0"
                      >
                        <dt className="text-xs font-bold text-white/55">
                          {campusAdminRoleLabels[roleOption]}
                        </dt>
                        <dd className="font-mono text-sm font-black">
                          {
                            managedUsers.filter(
                              (user) => user.role === roleOption,
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
                    ? `${historyActorLabel(moderationHistory[0])} · ${formatDate(
                        moderationHistory[0].createdAt,
                      )}`
                    : "İlk moderasyon kararın burada özetlenecek."
                }
              >
                <button
                  type="button"
                  disabled={moderationHistory.length === 0}
                  onClick={() => setActiveView("history")}
                  className={`min-h-11 w-full border border-white/12 px-3 text-xs font-black transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
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
          <div className="flex flex-col gap-3 border-b border-white/9 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                Moderasyon kuyruğu
              </p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">
                Şikâyetler
              </h2>
            </div>
            <div
              role="group"
              aria-label="Şikâyet durumunu filtrele"
              className="grid grid-cols-3 gap-1 border border-white/10 p-1"
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
                        ? "bg-brand/12 text-brand"
                        : "text-white/55 hover:bg-white/5"
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

          {filteredReports.length > 0 && selectedReport ? (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(15rem,0.76fr)_minmax(0,1.24fr)]">
              <div className="border border-white/9 bg-surface-raised">
                <ul className="divide-y divide-white/8">
                  {filteredReports.map((report) => {
                    const isSelected = report.id === selectedReport.id;

                    return (
                      <li key={report.id}>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedReportId(report.id)}
                          className={`flex min-h-24 w-full cursor-pointer gap-3 border-l-3 px-3 py-3 text-left transition-colors ${focusRing} ${
                            isSelected
                              ? "border-brand bg-brand/9"
                              : "border-transparent hover:bg-white/4"
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
                            <span className="mt-1.5 block truncate text-xs text-white/55">
                              {report.target.excerpt ||
                                "İçerik artık mevcut değil"}
                            </span>
                            <span className="mt-2 block font-mono text-[9px] text-white/45">
                              {formatDate(report.createdAt)}
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
                className="min-w-0 border border-white/10 bg-surface-raised p-4 sm:p-5"
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
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-white/55">
                      Bildirim · {formatDate(selectedReport.createdAt)}
                    </p>
                  </div>
                  <Link
                    href={`/gonderi/${selectedReport.postId}`}
                    className={`inline-flex min-h-11 items-center justify-center border border-white/12 px-3 text-xs font-black transition-colors hover:bg-white/6 ${focusRing}`}
                  >
                    İçeriğe git
                  </Link>
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="border-l-3 border-brand/48 bg-brand/7 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.11em] text-brand">
                      Şikâyet açıklaması
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      {selectedReport.detail ||
                        "Kullanıcı ek bir açıklama paylaşmadı."}
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
                      İncelenen içerik
                    </p>
                    <div className="mt-2 border border-white/9 bg-surface-raised/72 p-4">
                      <div className="flex items-center gap-2">
                        <CampusAuthorAvatar
                          author={
                            selectedReport.target.author
                              ? `@${selectedReport.target.author.username}`
                              : "Bilinmeyen kullanıcı"
                          }
                          authorId={selectedReport.target.authorId || undefined}
                          avatarUrl={undefined}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black">
                            {selectedReport.target.author
                              ? selectedReport.target.author.displayName
                              : "Bilinmeyen kullanıcı"}
                          </p>
                          <p className="mt-0.5 text-[10px] text-white/55">
                            {selectedReport.targetType === "post"
                              ? "Gönderi sahibi"
                              : "Yorum sahibi"}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-5 whitespace-pre-wrap break-words text-xs leading-5 text-white/55">
                        {selectedReport.target.excerpt ||
                          "İçerik artık mevcut değil."}
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
                      className={`min-h-11 border border-white/12 px-3 text-xs font-black transition-colors hover:bg-white/7 ${focusRing}`}
                    >
                      Yok say
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleReportAction(
                          selectedReport,
                          "content_removed",
                        )
                      }
                      className={`min-h-11 border border-danger/38 px-3 text-xs font-black text-danger transition-colors hover:bg-danger/9 ${focusRing}`}
                    >
                      İçeriği kaldır
                    </button>
                    <button
                      type="button"
                      disabled={!selectedReport.target.authorId}
                      onClick={() =>
                        handleReportAction(
                          selectedReport,
                          "user_suspended",
                        )
                      }
                      className={`min-h-11 bg-danger px-3 text-xs font-black text-[#0b0b0c] transition-colors hover:bg-danger/85 disabled:cursor-not-allowed disabled:bg-danger/25 disabled:text-white/38 ${focusRing}`}
                    >
                      Kullanıcıyı askıya al
                    </button>
                  </div>
                ) : null}

                {reportStatus && (
                  <ActionStatusText status={reportStatus} className="mt-3" />
                )}

                {selectedReport.status !== "pending" && (
                  <div className="mt-5 border border-[#69c990]/22 bg-[#69c990]/7 px-4 py-3">
                    <p className="text-xs font-black text-[#9be4b4]">
                      {selectedReport.resolution
                        ? resolutionLabels[selectedReport.resolution]
                        : "Şikâyet çözüldü"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/55">
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
          <div className="flex flex-col gap-3 border-b border-white/9 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
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
                className={`min-h-11 w-full border border-white/12 bg-white/[0.035] px-3 text-xs placeholder:text-white/45 ${focusRing}`}
              />
            </label>
          </div>

          {filteredUsers.length > 0 ? (
            <ul className="grid gap-3">
              {filteredUsers.map((user) => {
                const isCurrentAdmin = user.id === accountId;

                return (
                  <li
                    key={user.id}
                    className="grid min-w-0 gap-4 border border-white/9 bg-white/[0.018] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <CampusAuthorAvatar
                        author={`@${user.username}`}
                        authorId={user.id}
                        avatarUrl={user.avatarUrl}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-black">
                            {user.displayName}
                          </p>
                          <AccountStatusBadge status={user.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-white/55">
                          @{user.username} · {user.department}
                        </p>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-white/45">
                          Katılım · {user.joinedLabel}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 min-[420px]:grid-cols-2 sm:grid-cols-[9rem_8rem]">
                      <label>
                        <span className="sr-only">
                          @{user.username} için rol seç
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
                            void handleRoleChange(
                              user,
                              event.target.value as CampusAdminRole,
                            )
                          }
                          className={`min-h-11 w-full border border-white/12 bg-surface-raised px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-55 ${focusRing}`}
                        >
                          {(
                            [
                              "member",
                              "moderator",
                              "admin",
                            ] as const
                          ).map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {campusAdminRoleLabels[roleOption]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {isCurrentAdmin ? (
                        <span className="inline-flex min-h-11 items-center justify-center border border-white/9 px-3 text-center text-[10px] font-bold text-white/55">
                          Mevcut hesap
                        </span>
                      ) : user.status === "active" ? (
                        <button
                          type="button"
                          onClick={() => void handleSuspendUser(user)}
                          className={`min-h-11 border border-danger/35 px-3 text-xs font-black text-danger transition-colors hover:bg-danger/8 ${focusRing}`}
                        >
                          Askıya al
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleRestoreUser(user)}
                          className={`min-h-11 border border-[#69c990]/32 px-3 text-xs font-black text-[#9be4b4] transition-colors hover:bg-[#69c990]/8 ${focusRing}`}
                        >
                          Etkinleştir
                        </button>
                      )}
                    </div>

                    {userActionStatus && userActionAnchor === user.id && (
                      <ActionStatusText
                        status={userActionStatus}
                        className="sm:col-span-2"
                      />
                    )}
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
          <div className="border-b border-white/9 pb-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
              Denetim kaydı
            </p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">
              Moderasyon geçmişi
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-white/55">
              Şikâyet kararları, hesap durumları ve rol değişiklikleri
              kronolojik olarak saklanır.
            </p>
          </div>

          {moderationHistory.length > 0 ? (
            <ol className="relative grid gap-3 before:absolute before:bottom-6 before:left-[1.2rem] before:top-6 before:w-px before:bg-white/11">
              {moderationHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3"
                >
                  <span className="relative z-10 mt-4 grid size-10 place-items-center rounded-full border border-white/12 bg-surface-raised">
                    <span
                      aria-hidden="true"
                      className={`size-2.5 rounded-full ${
                        entry.action === "content_removed" ||
                        entry.action === "user_suspended"
                          ? "bg-danger"
                          : entry.action === "report_dismissed" ||
                              entry.action === "user_restored"
                            ? "bg-[#69c990]"
                            : "bg-brand"
                      }`}
                    />
                  </span>
                  <article className="border border-white/9 bg-white/[0.018] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black">
                          {historyLabels[entry.action]}
                        </h3>
                        <p className="mt-1 text-xs text-white/55">
                          {entry.target
                            ? `@${entry.target.username} · `
                            : ""}
                          {entry.postId ? "İçerik işlemi" : "Hesap işlemi"}
                        </p>
                      </div>
                      <time
                        dateTime={entry.createdAt}
                        className="font-mono text-[9px] text-white/55"
                      >
                        {formatDate(entry.createdAt)}
                      </time>
                    </div>
                    {entry.note && (
                      <p className="mt-3 border-l-2 border-brand/38 pl-3 text-xs leading-5 text-white/55">
                        {entry.note}
                      </p>
                    )}
                    <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-white/45">
                      İşlemi yapan · {historyActorLabel(entry)}
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
    default: "border-[#69c990]/18 bg-[#69c990]/5",
    alert: "border-danger/22 bg-danger/6",
    team: "border-brand/20 bg-brand/6",
    muted: "border-white/10 bg-white/[0.02]",
  };

  return (
    <article className={`min-w-0 border p-3 sm:p-4 ${toneClasses[tone]}`}>
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-white/55">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-[-0.06em] sm:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-white/55 sm:text-xs">
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
    <section className="min-w-0 border border-white/9 bg-white/[0.018] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-brand">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-black tracking-[-0.035em]">
            {title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-white/55">
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
  type: ReportSummaryDto["targetType"];
}) {
  return (
    <span
      className={`inline-flex min-h-6 shrink-0 items-center px-2 font-mono text-[9px] font-black uppercase tracking-[0.08em] ${
        type === "post"
          ? "bg-brand/12 text-brand"
          : "bg-[#69c990]/11 text-[#9be4b4]"
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
  report: ReportSummaryDto;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-mono font-black uppercase tracking-[0.07em] ${
        compact ? "min-h-5 px-1.5 text-[8px]" : "min-h-6 px-2 text-[9px]"
      } ${
        report.status === "pending"
          ? "bg-danger/12 text-danger"
          : "bg-[#69c990]/11 text-[#9be4b4]"
      }`}
    >
      {report.status === "pending" ? "Bekliyor" : "Çözüldü"}
    </span>
  );
}

function AccountStatusBadge({
  status,
}: {
  status: ManagedUserDto["status"];
}) {
  return (
    <span
      className={`inline-flex min-h-5 items-center rounded-full px-2 font-mono text-[8px] font-black uppercase tracking-[0.07em] ${
        status === "active"
          ? "bg-[#69c990]/11 text-[#9be4b4]"
          : "bg-danger/12 text-danger"
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
    <div className="border border-dashed border-white/13 px-4 py-10 text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid size-12 place-items-center rounded-full bg-white/6 font-serif text-xl font-black italic text-white/55"
      >
        ✓
      </span>
      <h3 className="mt-3 text-sm font-black">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-white/55">
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
      className="min-h-[calc(100svh-4rem)] bg-canvas p-3 sm:p-6 md:min-h-svh"
    >
      <div className="h-24 animate-pulse bg-white/6 motion-reduce:animate-none" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            aria-hidden="true"
            className="h-28 animate-pulse bg-white/6 motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="h-80 animate-pulse bg-white/6 motion-reduce:animate-none" />
        <div className="h-80 animate-pulse bg-white/6 motion-reduce:animate-none" />
      </div>
    </section>
  );
}
