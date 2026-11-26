import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import StatusPill from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { formatDate, money, shortHash } from "@/lib/format";
import { recordInstalment } from "@/lib/server-fns";

export default function InstalmentTable({ agreement, instalments, onChanged }) {
  const run = useServerFn(recordInstalment);
  const [busy, setBusy] = useState(false);
  const nextDue = instalments.find((i) => i.status === "due");

  async function pay() {
    setBusy(true);
    try {
      const res = await run({ data: { agreement_id: agreement.id } });
      toast.success(
        res.completed
          ? `Final instalment recorded — agreement settled`
          : `${money(res.amount)} recorded · ${money(res.balance)} outstanding`,
      );
      await onChanged?.();
    } catch (error) {
      toast.error(error?.message || "Could not record the instalment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Instalment schedule</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {instalments.filter((i) => i.status === "paid").length} of {instalments.length} settled
          </p>
        </div>
        {nextDue && agreement.status === "active" ? (
          <Button size="sm" onClick={pay} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Record {money(nextDue.amount)} payment
          </Button>
        ) : (
          <StatusPill tone="outline">{agreement.status === "cancelled" ? "Cancelled" : "No payment due"}</StatusPill>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">Due</th>
              <th className="py-2 pr-3 font-medium">Amount</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">Event</th>
            </tr>
          </thead>
          <tbody>
            {instalments.map((i) => (
              <tr key={i.id} className="border-b border-border/70 last:border-0">
                <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">{i.sequence}</td>
                <td className="py-2 pr-3 text-[12px]">{formatDate(i.due_date)}</td>
                <td className="py-2 pr-3 text-[12px] tabular-nums">{money(i.amount)}</td>
                <td className="py-2 pr-3">
                  <StatusPill tone={i.status === "paid" ? "active" : "pending"}>
                    {i.status === "paid" ? "Paid" : "Due"}
                  </StatusPill>
                </td>
                <td className="py-2 font-mono text-[10px] text-muted-foreground">
                  {i.tx_hash ? `${shortHash(i.tx_hash)} · #${i.block_number}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}