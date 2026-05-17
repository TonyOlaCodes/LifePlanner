"use client";

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="page-skeleton fade-in" aria-busy aria-label="Loading">
      <Skeleton style={{ height: 28, width: "55%", marginBottom: 8 }} />
      <Skeleton style={{ height: 14, width: "40%", marginBottom: 24 }} />
      <Skeleton style={{ height: 120, borderRadius: 20, marginBottom: 16 }} />
      <Skeleton style={{ height: 88, borderRadius: 16, marginBottom: 12 }} />
      <Skeleton style={{ height: 88, borderRadius: 16, marginBottom: 12 }} />
      <Skeleton style={{ height: 88, borderRadius: 16 }} />
    </div>
  );
}
