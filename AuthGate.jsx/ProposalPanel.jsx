import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import PanelHeading from "@/components/common/PanelHeading";
import StatusPill from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { money } from "@/lib/format";
import { adjustProposal, generateProposal, respondProposal } from "@/lib/server-fns";

export default function ProposalPanel({ agreement, proposal, onChanged }) {
  const runGenerate = useServerFn(generateProposal);
  const runAdjust = useServerFn(adjustProposal);
  const runRespond = useServerFn(respondProposal);
  const [busy, setBusy] = useState(null);

  const isPending = proposal?.status === "pending";
  const isLocked = Boolean(proposal?.customer_approved || proposal?.retailer_approved);
  const amount = proposal?.proposed_instalment || 0;
  const term = amount && agreement ? Math.max(1, Math.ceil(Number(agreement.balance) / amount)) : 0;

  async function generate() {
    setBusy("generate");
    try {
      await runGenerate({ data: { agreement_id: agreement.id } });
      toast.success("Schedule proposal drafted");
      await onChanged?.();
    } catch (error) {
      toast.error(error?.message || "Could not draft a proposal");
    } finally {
      setBusy(null);
    }
  }

  async function adjust(value) {
    setBusy("adjust");
    try {
      await runAdjust({ data: { proposal_id: proposal.id, instalment: value } });
      await onChanged?.();
    } catch (error) {
      toast.error(error?.message || "Could not update the proposal");
    } finally {
      setBusy(null);
    }
  }

  async function approve(side) {
    setBusy(side);
    try {
      const res = await runRespond({ data: { proposal_id: proposal.id, side } });
      toast.success(
        res.applied
          ? `Version ${res.version} recorded on Fuji`
          : `${side === "customer" ? "Customer" : "Retailer"} approval recorded`,
      );
      await onChanged?.();
    } catch (error) {
      toast.error(error?.message || "Could not record the approval");
    } finally {
      setBusy(null);
    }
  }

  if (!agreement) {
    return <PanelHeading label="AI schedule proposal" hint="Select an agreement to work on." />;
  }

  return (
    <div>
      <PanelHeading
        label="AI schedule proposal"
        hint="The agent proposes. Both parties approve. The contract records it."
        action={
          <StatusPill tone={isPending ? "pending" : "outline"}>
            {isPending ? "Pending" : proposal?.status === "approved" ? "Applied" : "Idle"}
          </StatusPill>
        }
      />

      {!isPending ? (
        <div className="mt-3">
          <p className="text-[12px] leading-5 text-muted-foreground">
            {proposal?.status === "approved"
              ? `Version ${proposal.applied_version} is live at ${money(proposal.proposed_instalment)} over ${proposal.proposed_term} months.`
              : `Balance of ${money(agreement.balance)} at ${money(agreement.instalment_amount)} per month. Run the agent to model a revised schedule.`}
          </p>
          <Button className="mt-3 w-full" onClick={generate} disabled={busy === "generate" || agreement.status !== "active"}>
            {busy === "generate" ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            Run AI analysis
          </Button>
          {agreement.status !== "active" ? (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              This agreement is {agreement.status}.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-md border border-border bg-secondary/40 p-3">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Agent analysis
            </div>
            <p className="mt-1.5 text-[12px] leading-5 text-foreground/80">{proposal.analysis}</p>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Proposed instalment</p>
              <p className="font-display text-[28px] font-bold leading-9 tabular-nums">{money(amount)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Term</p>
              <p className="font-display text-[20px] font-bold leading-7 tabular-nums">{term} months</p>
            </div>
          </div>

          <Slider
            className="mt-3"
            value={[amount]}
            min={50}
            max={Math.max(100, Number(agreement.balance))}
            step={10}
            disabled={isLocked || busy === "adjust"}
            onValueCommit={(v) => adjust(v[0])}
            aria-label="Proposed instalment amount"
          />
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{money(50)}</span>
            <span>was {money(proposal.current_instalment)}</span>
            <span>{money(agreement.balance)}</span>
          </div>

          <p className="mt-3 text-[12px] leading-5 text-muted-foreground">{proposal.rationale}</p>

          <div className="mt-4 space-y-2">
            <ApprovalRow
              label="Customer approval"
              sub={agreement.customer_name}
              done={proposal.customer_approved}
              disabled={Boolean(busy)}
              onClick={() => approve("customer")}
            />
            <ApprovalRow
              label="Retailer approval"
              sub="You"
              done={proposal.retailer_approved}
              disabled={Boolean(busy)}
              onClick={() => approve("retailer")}
            />
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            {proposal.customer_approved && proposal.retailer_approved
              ? "Both approvals recorded — version applied"
              : `${term} months at ${money(amount)} · both approvals required`}
          </div>
        </>
      )}
    </div>
  );
}

function ApprovalRow({ label, sub, done, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={done || disabled}
      className={`flex w-full items-center gap-2.5 rounded-md border p-2.5 text-left transition-colors disabled:cursor-default ${
        done ? "border-success/40 bg-success/5" : "border-border hover:bg-secondary/60"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          done ? "border-success bg-success text-white" : "border-border bg-card"
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{done ? "Approved" : sub}</span>
      </span>
    </button>
  );
}
