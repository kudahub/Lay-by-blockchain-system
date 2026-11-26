import { Check } from "lucide-react";
import StatusPill from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { avaxFor } from "@/lib/wallet";

export default function PlanCard({ plan, current, onChoose }) {
  return (
    <div
      className={`flex h-full flex-col rounded-md border bg-card p-4 ${
        plan.featured ? "border-foreground/30 ring-1 ring-foreground/10" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold">{plan.name}</h3>
          <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{plan.blurb}</p>
        </div>
        {current ? <StatusPill tone="active">Current</StatusPill> : plan.featured ? <StatusPill tone="pending">Popular</StatusPill> : null}
      </div>

      <p className="mt-4 font-display text-[26px] font-bold leading-8 tabular-nums">
        {money(plan.price)}
        <span className="ml-1 text-[12px] font-normal text-muted-foreground">/ month</span>
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">≈ {avaxFor(plan.price)} AVAX on Fuji</p>

      <ul className="mt-3 flex-1 space-y-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-[12px] leading-5 text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            {f}
          </li>
        ))}
      </ul>

      <Button
        className="mt-4 w-full"
        variant={current ? "outline" : "default"}
        onClick={() => onChoose(plan)}
        disabled={current}
      >
        {current ? "Active plan" : `Choose ${plan.name}`}
      </Button>
    </div>
  );
}