import StatusPill from "@/components/common/StatusPill";

export default function ConsoleHeader({ stats }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Retailer console
          </p>
          <h1 className="mt-1 text-[28px] font-bold leading-9">Agreement operations</h1>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-muted-foreground">
            Every instalment, schedule change and refund is written to an Avalanche Fuji contract
            event before the balance moves.
          </p>
        </div>
        <StatusPill tone="outline" mono>
          Demo data · Fuji simulation
        </StatusPill>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 font-display text-[22px] font-bold leading-7 tabular-nums">{s.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{s.delta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}