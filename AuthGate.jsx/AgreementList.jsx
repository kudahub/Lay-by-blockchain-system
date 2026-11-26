import PanelHeading from "@/components/common/PanelHeading";
import StatusPill from "@/components/common/StatusPill";
import { money } from "@/lib/format";

export default function AgreementList({ agreements, selectedId, onSelect, title = "Agreements" }) {
  return (
    <div>
      <PanelHeading
        label="Lay-by agreements"
        hint={`${agreements.filter((a) => a.status === "active").length} active · balances move only on contract events`}
      />
      <ul className="mt-3 space-y-2">
        {agreements.map((a) => (
          <li key={a.id}>
            <AgreementRow
              agreement={a}
              selected={a.id === selectedId}
              onSelect={onSelect}
            />
          </li>
        ))}
        {agreements.length === 0 ? (
          <li className="rounded-md border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground">
            No agreements yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function AgreementRow({ agreement: a, selected, onSelect }) {
  const paidPct = a.total_amount ? Math.min(100, Math.round((a.paid_to_date / a.total_amount) * 100)) : 0;
  const tone = a.status === "completed" ? "active" : a.status === "cancelled" ? "danger" : "pending";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(a.id)}
      className={`block w-full rounded-md border p-3 text-left transition-colors ${
        selected ? "border-foreground/40 bg-secondary/60" : "border-border hover:border-foreground/25"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{a.customer_name}</p>
          <p className="truncate text-[12px] text-muted-foreground">{a.item}</p>
        </div>
        <StatusPill tone={tone}>
          {a.status === "completed" ? "Settled" : a.status === "cancelled" ? "Cancelled" : `${a.instalments_paid}/${a.term_months}`}
        </StatusPill>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-success" style={{ width: `${paidPct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>
          {money(a.paid_to_date)} / {money(a.total_amount)}
        </span>
        <span className="text-foreground">{money(a.balance)} left</span>
      </div>
    </button>
  );
}