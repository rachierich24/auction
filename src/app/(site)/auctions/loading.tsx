import { AuctionCardSkeleton } from "@/components/auction/auction-card";

/**
 * Streamed while the catalogue query runs. Matches the real grid's geometry so
 * the page does not reflow when results arrive.
 */
export default function AuctionsLoading() {
  return (
    <>
      <section className="gutter mx-auto max-w-[110rem] py-12 md:py-16">
        <div className="skeleton h-2.5 w-24 rounded-full" />
        <div className="skeleton mt-6 h-14 w-full max-w-2xl rounded-sm" />
        <div className="skeleton mt-5 h-4 w-full max-w-lg rounded-sm" />
      </section>

      <div className="h-[8.5rem] border-y border-line bg-surface" />

      <section className="gutter mx-auto max-w-[110rem] py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <AuctionCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </>
  );
}
