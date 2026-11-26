import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import StatusPill from "@/components/common/StatusPill";
import { formatDate, money } from "@/lib/format";
import { PLAN_MAP } from "@/lib/plans";

export default function SubscriptionStrip() {
  const [subscription, setSubscription] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const page = await base44.entities.Subscription.filter(
      { status: "active" },
      { sort: "-created_date", limit: 1 },
    );
    const rows = page?.items ?? page ?? [];
    setSubscription(rows[0] || null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const plan = subscription ? PLAN_MAP[subscription.plan] : null;

  return (
    <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-[1.4fr_1fr_auto]">
      <div className="bg-card p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Retailer subscription</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-[14px] font-semibold">{loaded && plan ? plan.name : loaded ? "No active plan" : "Loading…"}</p>
          {plan ? (
            <StatusPill tone="active">
              <CheckCircle2 className="h-3 w-3" /> Active
            </StatusPill>
          ) : null}
        </div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {plan ? plan.blurb : "Choose a plan to unlock the AI assistant and reporting."}
        </p>
      </div>
      <div className="bg-card p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Billed via Binance Pay</p>
        <p className="mt-1 text-[14px] font-semibold tabular-nums">
          {subscription ? money(subscription.amount) : money(plan?.price || 0)}
          <span className="ml-1 text-[12px] font-normal text-muted-foreground">/ month</span>
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {subscription
            ? `renews ${formatDate(subscription.period_end)} · ${subscription.reference}`
            : "no invoice yet"}
        </p>
      </div>
      <div className="flex items-center bg-card p-3">
        <Link to="/pricing" className="inline-flex items-center gap-1 text-[12px] font-medium hover:text-avalanche">
          Manage plan <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}