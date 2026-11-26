import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { money } from "@/lib/format";
import { refundFor } from "@/lib/schedule";
import { cancelAgreement } from "@/lib/server-fns";

export default function CancellationPanel({ agreement, onChanged }) {
  const run = useServerFn(cancelAgreement);
  const [busy, setBusy] = useState(false);
  const { fee, refund } = refundFor(agreement.total_amount, agreement.paid_to_date, 0.1);

  async function cancel() {
    setBusy(true);
    try {
      const res = await run({ data: { agreement_id: agreement.id } });
      toast.success(`Cancelled · refund of ${money(res.refund)} recorded`);
      await onChanged?.();
    } catch (error) {
      toast.error(error?.message || "Could not cancel the agreement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <AlertTriangle className="h-3 w-3" /> Cancellation terms
      </div>
      <dl className="mt-2 space-y-1.5 text-[12px]">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Paid to date</dt>
          <dd className="tabular-nums">{money(agreement.paid_to_date)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Cancellation fee (10% of total)</dt>
          <dd className="tabular-nums">−{money(fee)}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
          <dt>Refund due</dt>
          <dd className="tabular-nums">{money(refund)}</dd>
        </div>
      </dl>

      {agreement.status === "active" ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="mt-3 w-full border-avalanche/40 text-avalanche hover:bg-avalanche/5">
              Cancel agreement
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this agreement?</AlertDialogTitle>
              <AlertDialogDescription>
                The contract will record a {money(fee)} cancellation fee and a {money(refund)} refund, then
                remove the remaining instalments. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep agreement</AlertDialogCancel>
              <AlertDialogAction onClick={cancel} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Cancel and refund
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <p className="mt-3 rounded bg-secondary p-2 text-[11px] text-muted-foreground">
          {agreement.status === "cancelled"
            ? `Cancelled on ${agreement.cancelled_on}. Refund recorded: ${money(agreement.refund_due || 0)}.`
            : "This agreement is settled — nothing to refund."}
        </p>
      )}
    </div>
  );
}
