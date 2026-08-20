import { TilesSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <div className="gutter mx-auto max-w-[110rem] py-12 md:py-16">
      <div className="skeleton h-2.5 w-20 rounded-full" />
      <div className="skeleton mt-3 h-9 w-64 rounded-sm" />
      <TilesSkeleton count={5} />
      <div className="skeleton mt-10 h-12 w-full rounded-sm" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-sm" />
        ))}
      </div>
    </div>
  );
}
