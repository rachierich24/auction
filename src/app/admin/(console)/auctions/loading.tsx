import { HeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="skeleton mt-8 h-20 rounded-sm" />
      <div className="mt-5">
        <TableSkeleton />
      </div>
    </>
  );
}
