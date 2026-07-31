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
      className={`flex flex-wrap items-center gap-2 border-l-2 border-[#ff7a45]/45 pl-3 ${
        variant === "detail" ? "mt-5" : "mt-3"
      }`}
    >
      <p
        className={`mr-1 font-black tracking-[-0.025em] text-[#ff7a45] ${
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
