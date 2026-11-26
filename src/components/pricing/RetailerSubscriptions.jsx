import { useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, Check, CreditCard, ShieldCheck } from "lucide-react";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 199,
    description: "For a single-store retailer starting with lay-by.",
    features: [
      "Basic lay-by management",
      "Contract-backed agreements",
      "Instalment reminders",
      "Fuji audit trail",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 399,
    description: "For retailers who need the AI assistant and flexible schedules.",
    popular: true,
    features: [
      "Everything in Starter",
      "AI schedule proposals",
      "Flexible payment plans",
      "Monthly reports",
      "Dual-approval change flow",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 999,
    description: "For multi-branch groups and white-label partners.",
    features: [
      "Everything in Business",
      "Advanced analytics",
      "Multiple branches",
      "ERP and POS integrations",
      "White-label licensing",
    ],
  },
];

const currency = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 });

export default function RetailerSubscriptions({ role, onOpenArchitecture }) {
  const [mix, setMix] = useState({ starter: 34, business: 33, enterprise: 33 });
  const [pendingPlan, setPendingPlan] = useState(null);
  const revenue = useMemo(
    () => plans.reduce((total, plan) => total + plan.price * mix[plan.id], 0),
    [mix],
  );
  const eligible = role === "merchant";

  function updateMix(planId, value) {
    const count = value === "" ? 0 : Math.max(0, Math.min(1_000_000, Math.floor(Number(value) || 0)));
    setMix((current) => ({ ...current, [planId]: count }));
  }

  return (
    <div className="subscription-page">
      <section className="subscription-hero">
        <div>
          <p className="eyebrow">Retailer subscriptions</p>
          <h2>Retailers pay for the platform.</h2>
          <p>Customers never pay a subscription to use their own lay-by agreement. Retailer billing stays on Binance Pay, separate from Fuji customer escrow.</p>
        </div>
        <span className="architecture-status simulated"><CreditCard size={13} /> Binance Pay · simulated</span>
      </section>

      <section className="current-subscription">
        <div className="current-subscription-icon"><BadgeCheck size={19} /></div>
        <div>
          <p className="eyebrow">Current subscription</p>
          <strong>{pendingPlan ? "No active plan yet — demo invoice awaiting verified payment." : eligible ? "No active plan yet — choose one below to preview billing." : "No customer subscription — lay-by agreements are free to use."}</strong>
          {pendingPlan && <small>{pendingPlan.name} · {currency.format(pendingPlan.price)}/month · Invoice DEMO-BP-{pendingPlan.id.toUpperCase()} · no Binance request was sent.</small>}
        </div>
        {pendingPlan && <span className="architecture-status simulated">Pending demo</span>}
      </section>

      <section className="plan-grid" aria-label="Retailer subscription plans">
        {plans.map((plan) => (
          <article className={plan.popular ? "plan-card popular" : "plan-card"} key={plan.id}>
            {plan.popular && <span className="plan-popular">Popular</span>}
            <p className="eyebrow">{plan.name}</p>
            <h3>{plan.description}</h3>
            <div className="plan-price">{currency.format(plan.price)}<span>/ month</span></div>
            <p className="plan-billing-note">Retailer billing · Binance Pay invoice</p>
            <ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
            <button
              className={plan.popular ? "primary-button full-width" : "secondary-button full-width"}
              onClick={() => setPendingPlan(plan)}
              disabled={!eligible}
              title={!eligible ? "Customers do not pay a subscription." : "Preview a simulated Binance Pay invoice"}
            >
              {eligible ? `Preview ${plan.name} invoice` : "For retailers"} <ArrowRight size={14} />
            </button>
          </article>
        ))}
      </section>

      {!eligible && <div className="notice subscription-customer-note"><ShieldCheck size={16} />You are using a customer account. Customers never need a paid plan to use a lay-by agreement.</div>}

      <section className="revenue-card">
        <div className="revenue-heading">
          <div><p className="eyebrow">Revenue model</p><h3>Illustrative monthly subscription revenue</h3></div>
          <span className="architecture-status">Before costs, tax and payment fees</span>
        </div>
        <p>Change the retailer mix to see the monthly run rate.</p>
        <div className="revenue-mix">
          {plans.map((plan) => (
            <label key={plan.id}>
              <span>{plan.name} retailers</span>
              <span className="revenue-equation">{currency.format(plan.price)} ×</span>
              <input type="number" min="0" max="1000000" step="1" value={mix[plan.id]} onChange={(event) => updateMix(plan.id, event.target.value)} />
              <strong>= {currency.format(plan.price * mix[plan.id])}</strong>
            </label>
          ))}
        </div>
        <div className="revenue-total"><span>Monthly subscription revenue</span><strong>{currency.format(revenue)}</strong></div>
        <p className="revenue-footnote">Customers never pay a subscription to use their own lay-by agreement — billing sits with the retailer.</p>
      </section>

      <section className="before-live-card">
        <div className="revenue-heading"><div><p className="eyebrow">Before this goes live</p><h3>Payment and entitlement safeguards</h3></div></div>
        <ul>
          <li><ShieldCheck size={15} />Retailers pay LaybyFlex through Binance Pay merchant invoices; customer escrow is not used for subscription billing.</li>
          <li><ShieldCheck size={15} />A plan activates only after the backend verifies the Binance webhook signature, invoice identity, and final payment status.</li>
          <li><ShieldCheck size={15} />Binance merchant credentials and production webhook verification are not configured. Invoice actions on this page are local previews only.</li>
          <li><ShieldCheck size={15} />Fuji agreement transactions remain a separate testnet flow; this page never requests AVAX or customer lay-by funds.</li>
        </ul>
        <button className="link-button architecture-link" onClick={onOpenArchitecture}>Review the two-rail architecture <ArrowRight size={14} /></button>
      </section>
    </div>
  );
}
