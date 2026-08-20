export default function Loading() {
  return (
    <div className="gutter mx-auto max-w-[110rem] py-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] lg:gap-14">
        <div>
          <div className="skeleton aspect-[4/3] rounded-sm" />
          <div className="mt-3 hidden grid-cols-6 gap-3 lg:grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton aspect-square rounded-sm" />
            ))}
          </div>
        </div>
        <div>
          <div className="skeleton h-2.5 w-32 rounded-full" />
          <div className="skeleton mt-4 h-12 w-full rounded-sm" />
          <div className="skeleton mt-3 h-4 w-3/4 rounded-sm" />
          <div className="skeleton mt-6 h-[28rem] rounded-sm" />
        </div>
      </div>
    </div>
  );
}
