import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import PlanCard from "@/components/pricing/PlanCard";
import WalletPay from "@/components/pricing/WalletPay";
import StatusPill from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { money } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { avaxFor } from "@/lib/wallet";

export default function PlanGrid({ currentPlanId, onDone }) {
  const [selected, setSelected] = useState(null);
  const [paid, setPaid] = useState(false);

  function choose(plan) {
    setPaid(false);
    setSelected(plan);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} current={plan.id === currentPlanId} onChoose={choose} />
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[17px]">Pay with your wallet</DialogTitle>
            <DialogDescription>
              Connect Core Wallet or MetaMask and pay the {selected?.name} plan on Avalanche Fuji. The plan
              activates once the transaction is confirmed on-chain.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">{selected?.name} · monthly</span>
              <span className="font-semibold tabular-nums">{money(selected?.price || 0)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Due in AVAX</span>
              <span className="font-mono tabular-nums">{avaxFor(selected?.price || 0)} AVAX</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Fuji testnet · chain 43113
            </div>
          </div>

          {selected ? (
            <WalletPay
              plan={selected}
              onPaid={async () => {
                setPaid(true);
                await onDone?.();
              }}
            />
          ) : null}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSelected(null)}>
              {paid ? "Done" : "Cancel"}
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            <StatusPill tone="outline" mono>
              avalanche_fuji_wallet
            </StatusPill>
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}