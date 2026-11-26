import { useState } from "react";
import { money } from "@/lib/format";
import { PLANS } from "@/lib/plans";

const START = { starter: 34, business: 33, enterprise: 33 };

export default function RevenueModel() {
  const [counts, setCounts] = useState(START);
  const total = PLANS.reduce((sum, p) => sum + p.price * (Number(counts[p.id]) || 0), 0);

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Revenue model</p>
        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
          Illustrative subscription revenue before costs, tax and payment fees. Change the retailer mix to see
          the monthly run rate.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.id} className="bg-card p-3">
            <label className="text-[11px] font-medium text-muted-foreground" htmlFor={`count-${p.id}`}>
              {p.name} retailers
            </label>
            <input
              id={`count-${p.id}`}
              type="number"
              min="0"
              max="10000"
              value={counts[p.id]}
              onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-[14px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {money(p.price)} × {Number(counts[p.id]) || 0} = {money(p.price * (Number(counts[p.id]) || 0))}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2 border-t border-border p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Monthly subscription revenue</p>
          <p className="font-display text-[28px] font-bold leading-9 tabular-nums">{money(total)}</p>
        </div>
        <p className="max-w-xs text-[11px] leading-4 text-muted-foreground">
          Customers never pay a subscription to use their own lay-by agreement — billing sits with the retailer.
        </p>
      </div>
    </div>
  );
}