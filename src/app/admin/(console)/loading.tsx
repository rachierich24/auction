import {
  ChartSkeleton,
  HeaderSkeleton,
  TilesSkeleton,
} from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton withRange />
      <TilesSkeleton count={8} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </>
  );
}
