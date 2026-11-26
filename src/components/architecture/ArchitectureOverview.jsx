import { useState } from "react";
import {
  ArrowRight, BadgeCheck, Bot, Check, CheckCircle2, Clock3, CreditCard,
  ExternalLink, FileLock2, Network, Play, ShieldCheck, Wallet,
} from "lucide-react";
import { ESCROW_ADDRESS, FUJI_CHAIN_ID, FUJI_EXPLORER } from "../../lib/chainConfig.js";

const subscriptionSteps = [
  ["Retailer selects a plan", "Starter, Business, or Enterprise. The plan belongs to the retailer account."],
  ["Invoice is issued", "Binance Pay creates a merchant invoice for the selected plan."],
  ["Retailer approves in Binance", "Payment happens in Binance Pay or the merchant QR flow."],
  ["Payment notification arrives", "The production webhook endpoint receives Binance's signed notification."],
  ["Signature and status are checked", "The verifier checks authenticity, invoice identity, and final payment status."],
  ["Subscription activates or renews", "Only a verified payment changes retailer entitlements."],
];

const agreementSteps = [
  ["Retailer creates version 1", "Terms, deposit, schedule, and cancellation policy are hashed for the agreement record."],
  ["Customer reviews and accepts", "The customer sees the ZAR schedule and cancellation terms before consent."],
  ["Instalment is confirmed", "The Fuji contract verifies the test-token transfer and emits the payment event."],
  ["Verified event updates the view", "The API reconciles confirmed contract events; the UI does not edit balances."],
  ["Hardship proposal is prepared", "The schedule preview explains a proposed revision; the assistant cannot sign or move funds."],
  ["Both parties approve a revision", "Customer and retailer consent are required before a new contract version is recorded (revision writes are not yet deployed)."],
  ["Cancellation or completion settles", "Escrow applies the agreed refund rule or releases the completed balance."],
];

const judgeChecks = [
  { title: "Fuji agreement contract", status: ESCROW_ADDRESS ? "Address configured" : "Deploy to Fuji", tone: ESCROW_ADDRESS ? "ready" : "pending" },
  { title: "Agreement creation and acceptance", status: "Wallet flow implemented", tone: "ready" },
  { title: "Instalments and balance tracking", status: "Confirmed Fuji events", tone: "ready" },
  { title: "Cancellation and refund", status: "Contract rules implemented", tone: "ready" },
  { title: "AI revised schedule", status: "Preview simulation", tone: "simulated" },
  { title: "Consent from both parties", status: "Revision flow preview", tone: "simulated" },
  { title: "Append-only audit trail", status: "DB-guarded event log", tone: "ready" },
  { title: "Binance Pay retailer billing", status: "Simulation; credentials pending", tone: "simulated" },
];

const decisions = [
  ["Agreement contracts", "Solidity on Avalanche Fuji · chain 43113", "EVM-compatible testnet and public transaction explorer."],
  ["Payment verification", "Confirmed contract events", "A UI action alone cannot mark an instalment paid."],
  ["Agentic layer", "Tool-scoped schedule proposer", "Explains options; no wallet, funds, or approval authority."],
  ["Retailer subscriptions", "Binance Pay merchant invoices", "Retailers pay LaybyFlex; customer lay-by funds remain separate."],
  ["Documents and privacy", "Encrypted private store + IPFS hash", "Personal documents stay off-chain; the hash is for integrity only."],
  ["Privacy extension", "Zero-knowledge proofs · phase 2", "Potential eligibility proofs without exposing extra customer data."],
];

function FlowSteps({ steps, activeStep = -1 }) {
  return (
    <ol className="architecture-steps">
      {steps.map(([title, detail], index) => (
        <li className={index === activeStep ? "architecture-step current" : "architecture-step"} key={title}>
          <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
          <span><strong>{title}</strong><small>{detail}</small></span>
        </li>
      ))}
    </ol>
  );
}

function StatusTag({ children, tone = "ready" }) {
  return <span className={`architecture-status ${tone}`}>{children}</span>;
}

function SubscriptionPreview() {
  const [plan, setPlan] = useState("Business");
  const [step, setStep] = useState(0);
  const invoiceId = `DEMO-${plan.toUpperCase()}-${new Date().toISOString().slice(5, 10).replace("-", "")}`;
  const current = step > 0 ? subscriptionSteps[step - 1] : null;

  function advance() {
    setStep((value) => value >= subscriptionSteps.length ? 0 : value + 1);
  }

  return (
    <section className="architecture-demo-card">
      <div className="architecture-card-heading">
        <span className="architecture-icon subscription-icon"><CreditCard size={19} /></span>
        <div><p className="eyebrow">Subscription rail</p><h3>Binance Pay invoice preview</h3></div>
        <StatusTag tone="simulated">Simulated</StatusTag>
      </div>
      <p className="architecture-copy">A retailer subscription never draws from a customer's lay-by escrow.</p>
      <div className="plan-picker" role="group" aria-label="Choose a demo subscription plan">
        {["Starter", "Business", "Enterprise"].map((item) => (
          <button key={item} className={plan === item ? "plan-choice selected" : "plan-choice"} onClick={() => { setPlan(item); setStep(0); }}>
            <strong>{item}</strong><small>Monthly retailer plan</small>
          </button>
        ))}
      </div>
      <div className="subscription-preview-state" aria-live="polite">
        {current ? (
          <>
            <div className="preview-state-title"><CheckCircle2 size={17} /><strong>{current[0]}</strong></div>
            <p>{current[1]}</p>
            {step >= 2 && <code>{invoiceId}</code>}
            {step === 5 && <small className="simulation-note">Mock-only: no real Binance signature or payment was received.</small>}
            {step === 6 && <small className="simulation-note">Preview complete. No live subscription entitlement was changed.</small>}
          </>
        ) : (
          <p>Step through plan selection, invoice, notification, verification, and renewal. This is a local preview only.</p>
        )}
      </div>
      <button className="secondary-button architecture-action" onClick={advance}>
        <Play size={15} /> {step >= subscriptionSteps.length ? "Reset preview" : step === 0 ? "Start invoice preview" : "Next simulated step"}
      </button>
      <div className="step-progress" aria-label={`${step} of ${subscriptionSteps.length} steps previewed`}>
        {subscriptionSteps.map((item, index) => <span className={index < step ? "done" : ""} key={item[0]} />)}
      </div>
    </section>
  );
}

function HardshipPreview({ agreement }) {
  const [proposed, setProposed] = useState(false);
  const [customerApproved, setCustomerApproved] = useState(false);
  const [retailerApproved, setRetailerApproved] = useState(false);
  const paidCents = (agreement?.instalments || [])
    .filter((instalment) => instalment.status === "paid")
    .reduce((total, instalment) => total + Number(instalment.amount_zar_cents), 0);
  const remainingCents = agreement
    ? Math.max(0, Number(agreement.total_zar_cents) - paidCents)
    : 480_000;
  const monthsBefore = agreement ? Math.max(1, Number(agreement.term_months)) : 6;
  const monthsAfter = Math.min(monthsBefore + 3, 36);
  const extensionMonths = monthsAfter - monthsBefore;
  const reductionPercent = monthsAfter > monthsBefore
    ? Math.round((1 - monthsBefore / monthsAfter) * 100)
    : 0;
  const money = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });
  const formatCents = (cents) => money.format(cents / 100);
  const approvalsComplete = customerApproved && retailerApproved;

  function reset() {
    setProposed(false);
    setCustomerApproved(false);
    setRetailerApproved(false);
  }

  return (
    <section className="architecture-demo-card">
      <div className="architecture-card-heading">
        <span className="architecture-icon agent-icon"><Bot size={19} /></span>
        <div><p className="eyebrow">Agentic layer</p><h3>Hardship schedule preview</h3></div>
        <StatusTag tone="simulated">Simulation</StatusTag>
      </div>
      <p className="architecture-copy">A deterministic example shows how an assistant can explain a proposal without changing the ledger.</p>
      <div className="schedule-comparison">
        <div><small>Current schedule</small><strong>{monthsBefore} × {formatCents(remainingCents / monthsBefore)}</strong></div>
        <ArrowRight size={17} />
        <div><small>Proposed schedule</small><strong>{monthsAfter} × {formatCents(remainingCents / monthsAfter)}</strong></div>
      </div>
      {proposed ? (
        <>
          <div className="proposal-explanation">
            <strong>{extensionMonths ? `Proposal: extend by ${extensionMonths} months` : "Proposal: adjust the remaining schedule"}</strong>
            <p>{reductionPercent ? `Monthly instalments fall by about ${reductionPercent}%. ` : ""}The remaining balance is unchanged; no fees or interest are added in this example.</p>
          </div>
          <div className="approval-controls">
            <button className={customerApproved ? "approval-button approved" : "approval-button"} onClick={() => setCustomerApproved((value) => !value)}>
              {customerApproved ? <Check size={14} /> : <Clock3 size={14} />} Customer {customerApproved ? "approved (demo)" : "approval"}
            </button>
            <button className={retailerApproved ? "approval-button approved" : "approval-button"} onClick={() => setRetailerApproved((value) => !value)}>
              {retailerApproved ? <Check size={14} /> : <Clock3 size={14} />} Retailer {retailerApproved ? "approved (demo)" : "approval"}
            </button>
          </div>
          {approvalsComplete && <div className="revision-preview"><BadgeCheck size={16} /><span><strong>Version 2 preview ready</strong><small>Both demo approvals are present. No contract call or schedule change was made.</small></span></div>}
          <button className="link-button reset-preview" onClick={reset}>Reset proposal preview</button>
        </>
      ) : (
        <button className="secondary-button architecture-action" onClick={() => setProposed(true)}><Bot size={15} /> Generate hardship proposal</button>
      )}
      <p className="simulation-note">No live AI call. In production, the agent has no signer; both parties must approve before a revision is written.</p>
    </section>
  );
}

export default function ArchitectureOverview({ agreement, onOpenAgreements }) {
  return (
    <div className="architecture-page">
      <section className="architecture-hero">
        <div>
          <p className="eyebrow">Reference architecture</p>
          <h2>Two rails, one platform</h2>
          <p>Retailer billing stays on Binance Pay. Customer lay-by agreements stay on Avalanche Fuji. Keeping the rails separate protects customer escrow from subscription billing.</p>
        </div>
        <div className="architecture-hero-tags">
          <StatusTag tone="simulated">Binance Pay · simulated</StatusTag>
          <StatusTag>Fuji · chain {FUJI_CHAIN_ID}</StatusTag>
        </div>
      </section>

      <section className="rail-map" aria-label="Two-rail platform architecture">
        <div className="rail-map-heading"><Network size={18} /><div><strong>Platform boundaries</strong><small>Subscriptions and customer funds never share a settlement path.</small></div></div>
        <div className="rail-lane subscription-lane">
          <div className="lane-label"><CreditCard size={16} /><span>Subscription rail<small>Retailer → LaybyFlex</small></span></div>
          <div className="lane-node">Retailer console</div><ArrowRight className="lane-arrow" size={16} />
          <div className="lane-node">Binance Pay invoice</div><ArrowRight className="lane-arrow" size={16} />
          <div className="lane-node">Signed webhook verifier · pending</div><ArrowRight className="lane-arrow" size={16} />
          <div className="lane-node">Plan entitlement</div>
          <StatusTag tone="simulated">Simulation</StatusTag>
        </div>
        <div className="rail-lane agreement-lane">
          <div className="lane-label"><Wallet size={16} /><span>Agreement rail<small>Retailer → customer</small></span></div>
          <div className="lane-node">Retailer + customer portals</div><ArrowRight className="lane-arrow" size={16} />
          <div className="lane-node">API, auth + verifier</div><ArrowRight className="lane-arrow" size={16} />
          <div className="lane-node">Oracle relay · pending</div><ArrowRight className="lane-arrow" size={16} />
          <div className="lane-node">Fuji escrow contract</div><ArrowRight className="lane-arrow" size={16} />
          <div className="lane-node">Events + audit</div>
          <StatusTag tone={ESCROW_ADDRESS ? "ready" : "pending"}>{ESCROW_ADDRESS ? "Address set" : "Deploy required"}</StatusTag>
        </div>
        <div className="rail-map-footer"><ShieldCheck size={15} /> The current Fuji flow reconciles confirmed contract events; production webhook verification and the oracle relay are pending.</div>
      </section>

      <section className="architecture-section">
        <div className="architecture-section-heading"><div><p className="eyebrow">Retailer → LaybyFlex</p><h3>Subscription lifecycle</h3></div><StatusTag tone="simulated">Binance credentials pending</StatusTag></div>
        <div className="architecture-two-column">
          <FlowSteps steps={subscriptionSteps} />
          <SubscriptionPreview />
        </div>
      </section>

      <section className="architecture-section">
        <div className="architecture-section-heading"><div><p className="eyebrow">Retailer → customer lay-by</p><h3>Agreement lifecycle</h3></div><StatusTag>Fuji · 43113</StatusTag></div>
        <div className="architecture-two-column">
          <FlowSteps steps={agreementSteps} />
          <div className="agreement-rail-card">
            <div className="architecture-card-heading"><span className="architecture-icon chain-icon"><Wallet size={19} /></span><div><p className="eyebrow">Balance authority</p><h3>Contract is the ledger</h3></div></div>
            <div className="source-of-truth">
              <div><CheckCircle2 size={16} /><span>Amounts and due schedule</span></div>
              <div><CheckCircle2 size={16} /><span>Confirmed payment events</span></div>
              <div><CheckCircle2 size={16} /><span>Cancellation refund calculation</span></div>
              <div><CheckCircle2 size={16} /><span>Completion and merchant release</span></div>
            </div>
            <div className="contract-address-card">
              <span>Escrow contract</span>
              {ESCROW_ADDRESS ? <a href={`${FUJI_EXPLORER}/address/${ESCROW_ADDRESS}`} target="_blank" rel="noreferrer">{ESCROW_ADDRESS}<ExternalLink size={13} /></a> : <strong>Not deployed / address not configured</strong>}
            </div>
            <button className="primary-button architecture-action" onClick={onOpenAgreements}>Open agreement console <ArrowRight size={15} /></button>
            <p className="simulation-note">Chain writes require a deployed contract and a wallet on Fuji. Test tUSDC has no monetary value.</p>
          </div>
        </div>
      </section>

      <section className="architecture-section">
        <div className="architecture-section-heading"><div><p className="eyebrow">Controlled assistance</p><h3>Hardship proposal and dual consent</h3></div><StatusTag tone="simulated">Preview only</StatusTag></div>
        <div className="architecture-two-column">
          <div className="trust-card">
            <div className="architecture-card-heading"><span className="architecture-icon agent-icon"><Bot size={19} /></span><div><p className="eyebrow">Tool-scoped assistant</p><h3>Suggests, never settles</h3></div></div>
            <p>The assistant can read payment history, explain agreement terms, and model a revised schedule. It cannot approve changes, sign transactions, calculate authoritative balances, or move funds.</p>
            <div className="boundary-callout"><ShieldCheck size={17} /><span>Only explicit customer and retailer approvals can authorize a revision. The contract remains the source of truth.</span></div>
          </div>
          <HardshipPreview agreement={agreement?.status === "active" ? agreement : null} />
        </div>
      </section>

      <section className="architecture-section">
        <div className="architecture-section-heading"><div><p className="eyebrow">Trust boundaries</p><h3>What stays protected</h3></div></div>
        <div className="trust-grid">
          <article className="trust-card"><ShieldCheck size={19} /><h4>AI cannot move money</h4><p>Proposals are advisory. Approval, balances, and refunds belong to contract state, not model output.</p></article>
          <article className="trust-card"><BadgeCheck size={19} /><h4>Unverified webhooks change nothing</h4><p>Production notifications must pass signature, invoice, and final-status checks before subscription entitlements change.</p></article>
          <article className="trust-card"><FileLock2 size={19} /><h4>Personal data stays off-chain</h4><p>Account data stays in the application database. Encrypted document storage and IPFS hashes are planned; no identity documents are published on-chain.</p></article>
        </div>
      </section>

      <section className="architecture-section">
        <div className="architecture-section-heading"><div><p className="eyebrow">Judge walkthrough</p><h3>What this prototype demonstrates</h3></div></div>
        <div className="judge-checklist">
          {judgeChecks.map((item) => <div className="judge-check" key={item.title}><span>{item.status === "Contract rules implemented" || item.status === "Confirmed Fuji events" ? <CheckCircle2 size={16} /> : item.tone === "pending" ? <Clock3 size={16} /> : <Check size={16} />}</span><strong>{item.title}</strong><StatusTag tone={item.tone}>{item.status}</StatusTag></div>)}
        </div>
      </section>

      <section className="architecture-section decision-section">
        <div className="architecture-section-heading"><div><p className="eyebrow">Technology decisions</p><h3>Chosen for the prototype</h3></div></div>
        <div className="decision-list">
          {decisions.map(([area, choice, reason]) => <div className="decision-row" key={area}><strong>{area}</strong><span>{choice}</span><small>{reason}</small></div>)}
        </div>
        <div className="architecture-disclaimer"><ShieldCheck size={16} /><p>Working prototype: Fuji wallet flows require deployed addresses. Binance Pay and hardship-agent interactions above are explicitly simulated until credentials and the production verification services are configured. This is not a real-money payment system.</p></div>
      </section>
    </div>
  );
}
