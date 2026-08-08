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
    /* İlan kartı fiyatıyla ayrışsın: akışta bir ilanı sohbetten ayıran ilk
       şey fiyat, o yüzden kendi yüzeyinde ve büyük gösteriliyor. */
    <div
      className={`flex flex-wrap items-center gap-2 border border-brand/30 bg-brand/[0.07] px-3 py-2.5 ${
        variant === "detail" ? "mt-5" : "mt-3"
      }`}
    >
      <p
        className={`mr-1 font-black tracking-[-0.03em] text-brand ${
          variant === "detail"
            ? "text-3xl sm:text-4xl"
            : variant === "compact"
              ? "text-xl"
              : "text-2xl"
        }`}
      >
        {priceLabel}
      </p>
      {listing.type !== "Ücretsiz" && (
        <span className="border border-white/12 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white/62">
          {listing.type}
        </span>
      )}
      <span className="border border-white/12 px-2 py-1 text-[10px] font-bold text-white/55">
        {listing.condition}
      </span>
    </div>
  );
}
