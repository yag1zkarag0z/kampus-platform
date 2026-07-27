import type { CampusPostListing } from "@/data/campusPosts";

type CampusListingMetaProps = {
  listing: CampusPostListing;
  variant?: "default" | "compact" | "detail";
};

const priceFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 0,
});

export default function CampusListingMeta({
  listing,
  variant = "default",
}: CampusListingMetaProps) {
  const priceLabel =
    listing.type === "Ücretsiz"
      ? "Ücretsiz"
      : `${listing.type === "Aranıyor" ? "Bütçe · " : ""}${priceFormatter.format(listing.price)} TL`;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 border-l-2 border-[#9a5944]/45 pl-3 dark:border-[#c7896d]/48 ${
        variant === "detail" ? "mt-5" : "mt-3"
      }`}
    >
      <p
        className={`mr-1 font-black tracking-[-0.025em] text-[#5a1f32] dark:text-[#d09272] ${
          variant === "detail"
            ? "text-2xl sm:text-3xl"
            : variant === "compact"
              ? "text-base"
              : "text-lg"
        }`}
      >
        {priceLabel}
      </p>
      {listing.type !== "Ücretsiz" && (
        <span className="border border-[#1c2821]/13 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#1c2821]/66 dark:border-white/11 dark:text-white/62">
          {listing.type}
        </span>
      )}
      <span className="border border-[#1c2821]/10 px-2 py-1 text-[10px] font-bold text-[#58635c] dark:border-white/9 dark:text-[#aeb4af]">
        {listing.condition}
      </span>
    </div>
  );
}
