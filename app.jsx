import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowRight, BadgeCheck, Check, ChevronDown, CircleDollarSign,
  ClipboardList, CreditCard, ExternalLink, LayoutDashboard, LogOut, Package, Plus,
  Network, RefreshCw, ShieldCheck, Wallet, X,
} from "lucide-react";
import { BrowserProvider, Contract, formatUnits } from "ethers";
import { escrowAbi, testUsdcAbi } from "./src/lib/contractAbi.js";
import { ESCROW_ADDRESS, FUJI_CHAIN_HEX, FUJI_EXPLORER, FUJI_RPC, TOKEN_ADDRESS } from "./src/lib/chainConfig.js";
import ArchitectureOverview from "./src/components/architecture/ArchitectureOverview.jsx";
import RetailerSubscriptions from "./src/components/pricing/RetailerSubscriptions.jsx";

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "agreements", label: "Lay-by agreements", icon: ClipboardList },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "architecture", label: "Architecture", icon: Network },
];

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function zar(cents) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(cents || 0) / 100);
}

function shortAddress(value) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";
}

function centsFromInput(value) {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) throw new Error("Enter a valid ZAR amount with up to two decimals.");
  return Math.round(Number(value) * 100);
}

async function fujiSigner() {
  if (!window.ethereum) throw new Error("Install Core Wallet or MetaMask to continue.");
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: FUJI_CHAIN_HEX }] });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: FUJI_CHAIN_HEX,
        chainName: "Avalanche Fuji Testnet",
        nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
        rpcUrls: [FUJI_RPC],
        blockExplorerUrls: [FUJI_EXPLORER],
      }],
    });
  }
  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("customer");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload = mode === "register" ? { ...form, role } : { email: form.email, password: form.password };
      const result = await api(path, { method: "POST", body: JSON.stringify(payload) });
      onAuthenticated(result.user);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand"><div className="brand-mark"><Package size={18} /></div><span>Lay-by</span></div>
        <p className="eyebrow">Avalanche Fuji · Test environment</p>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">{mode === "login" ? "Sign in to manage your lay-by agreements." : "Choose an account type to get started."}</p>
        <form className="form-stack" onSubmit={submit}>
          {mode === "register" && <>
            <label>Full name<input required maxLength={120} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
            <label>Account type<select value={role} onChange={(e) => setRole(e.target.value)}><option value="customer">Customer</option><option value="merchant">Merchant</option></select></label>
          </>}
          <label>Email<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={12} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><small>Use at least 12 characters.</small></label>
          {error && <div className="notice error" role="alert">{error}</div>}
          <button className="primary-button full-width" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <button className="link-button auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        <p className="test-warning"><ShieldCheck size={15} /> Fuji test tokens have no monetary value.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("overview");
  const [agreements, setAgreements] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [auditEvents, setAuditEvents] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const selected = useMemo(() => agreements.find((agreement) => agreement.id === selectedId), [agreements, selectedId]);
  const activeCount = agreements.filter((agreement) => ["active", "offered", "cancellation_requested"].includes(agreement.status)).length;
  const totalOutstanding = agreements.reduce((sum, agreement) => {
    if (agreement.status === "cancelled") return sum;
    const paid = (agreement.instalments || []).filter((row) => row.status === "paid").reduce((acc, row) => acc + Number(row.amount_zar_cents), 0);
    return sum + Math.max(0, Number(agreement.total_zar_cents) - paid);
  }, 0);
  const collected = agreements.reduce((sum, agreement) => sum + (agreement.instalments || []).filter((row) => row.status === "paid").reduce((acc, row) => acc + Number(row.amount_zar_cents), 0), 0);

  async function loadAgreements() {
    const result = await api("/api/agreements");
    setAgreements(result.agreements);
    setSelectedId((current) => current && result.agreements.some((agreement) => agreement.id === current) ? current : result.agreements[0]?.id || "");
  }

  async function loadAudit(agreementId) {
    const result = await api(`/api/agreements/${agreementId}/audit`);
    setAuditEvents(result.events);
  }

  useEffect(() => {
    api("/api/auth/me")
      .then(({ user: current }) => setUser(current))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    loadAgreements().catch((loadError) => setError(loadError.message));
  }, [user]);

  useEffect(() => {
    if (!user || !selectedId) {
      setAuditEvents([]);
      return undefined;
    }
    let active = true;
    api(`/api/agreements/${selectedId}/audit`)
      .then(({ events }) => { if (active) setAuditEvents(events); })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [selectedId, user]);

  function reportError(message) {
    setError(message);
    setNotice("");
  }

  async function connectWallet() {
    setError("");
    setBusy(true);
    try {
      const signer = await fujiSigner();
      const address = await signer.getAddress();
      const { message } = await api("/api/wallet/challenge", { method: "POST", body: JSON.stringify({ address }) });
      const signature = await signer.signMessage(message);
      const result = await api("/api/wallet/verify", { method: "POST", body: JSON.stringify({ address, signature }) });
      setUser(result.user);
      setNotice(`Wallet linked: ${shortAddress(address)}`);
    } catch (walletError) {
      reportError(walletError.message || "Wallet connection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function getTestTokens() {
    setError("");
    setBusy(true);
    try {
      if (!TOKEN_ADDRESS) throw new Error("Set VITE_TOKEN_CONTRACT_ADDRESS in .env and restart the app.");
      const signer = await fujiSigner();
      if ((await signer.getAddress()).toLowerCase() !== user.wallet_address?.toLowerCase()) {
        throw new Error("Connect the wallet linked to your account.");
      }
      const token = new Contract(TOKEN_ADDRESS, testUsdcAbi, signer);
      const transaction = await token.faucet();
      await transaction.wait();
      setNotice("Test tUSDC sent to your wallet. This token has no monetary value.");
    } catch (faucetError) {
      reportError(faucetError.message || "Test token faucet failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setAgreements([]);
    setSelectedId("");
    setTab("overview");
  }

  async function verifyTx(path, transaction) {
    await api(path, { method: "POST", body: JSON.stringify({ tx_hash: transaction.hash }) });
    await loadAgreements();
    const agreementId = path.match(/^\/api\/agreements\/([^/]+)/)?.[1];
    if (agreementId) await loadAudit(agreementId);
  }

  async function createAgreement(data) {
    setError("");
    setBusy(true);
    try {
      if (!user.wallet_address) throw new Error("Link your merchant wallet before creating an agreement.");
      if (!ESCROW_ADDRESS) throw new Error("Set VITE_ESCROW_CONTRACT_ADDRESS in .env and restart the app.");
      const signer = await fujiSigner();
      if ((await signer.getAddress()).toLowerCase() !== user.wallet_address.toLowerCase()) {
        throw new Error("Connected wallet does not match your linked merchant wallet.");
      }
      const result = await api("/api/agreements", { method: "POST", body: JSON.stringify(data) });
      const escrow = new Contract(ESCROW_ADDRESS, escrowAbi, signer);
      const transaction = await escrow.createAgreement(
        result.chain.externalRef,
        result.chain.termsHash,
        result.chain.customerWallet,
        result.chain.totalZarCents,
        result.chain.fxRateE6,
        result.chain.totalTokenUnits,
        result.chain.depositTokenUnits,
        result.chain.monthlyInstallments,
        result.chain.intervalSeconds,
        result.chain.cancellationRefundBps,
      );
      setNotice("Agreement transaction sent. Waiting for Fuji confirmation…");
      await transaction.wait();
      await verifyTx(`/api/agreements/${result.agreement.id}/confirm`, transaction);
      setTab("agreements");
      setCreating(false);
      setNotice("Agreement created on Fuji and awaiting customer acceptance.");
    } catch (createError) {
      reportError(createError.message || "Could not create the agreement.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptAgreement(agreement) {
    await performChainAction(async (signer) => {
      const contract = new Contract(ESCROW_ADDRESS, escrowAbi, signer);
      const transaction = await contract.acceptAgreement(agreement.chain_agreement_id);
      await transaction.wait();
      await verifyTx(`/api/agreements/${agreement.id}/accept/verify`, transaction);
      setNotice("Agreement accepted on Fuji.");
    });
  }

  async function payInstalment(agreement) {
    await performChainAction(async (signer) => {
      if (!TOKEN_ADDRESS) throw new Error("Set VITE_TOKEN_CONTRACT_ADDRESS in .env and restart the app.");
      const escrow = new Contract(ESCROW_ADDRESS, escrowAbi, signer);
      const token = new Contract(TOKEN_ADDRESS, testUsdcAbi, signer);
      const amount = await escrow.nextPaymentAmount(agreement.chain_agreement_id);
      const approved = await token.approve(ESCROW_ADDRESS, amount);
      await approved.wait();
      const transaction = await escrow.payInstalment(agreement.chain_agreement_id);
      await transaction.wait();
      await verifyTx(`/api/agreements/${agreement.id}/payments/verify`, transaction);
      setNotice(`Instalment paid: ${formatUnits(amount, 6)} tUSDC.`);
    });
  }

  async function cancellationAction(agreement, method, verifyPath, message) {
    await performChainAction(async (signer) => {
      const contract = new Contract(ESCROW_ADDRESS, escrowAbi, signer);
      const transaction = await contract[method](agreement.chain_agreement_id);
      await transaction.wait();
      await verifyTx(`/api/agreements/${agreement.id}/${verifyPath}`, transaction);
      setNotice(message);
    });
  }

  async function performChainAction(action) {
    setBusy(true);
    setError("");
    try {
      if (!ESCROW_ADDRESS) throw new Error("Set VITE_ESCROW_CONTRACT_ADDRESS in .env and restart the app.");
      const signer = await fujiSigner();
      if ((await signer.getAddress()).toLowerCase() !== user.wallet_address?.toLowerCase()) {
        throw new Error("Connect the wallet linked to your account.");
      }
      await action(signer);
    } catch (actionError) {
      reportError(actionError.message || "The blockchain action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <div className="loading-screen">Loading Lay-by…</div>;
  if (!user) return <AuthScreen onAuthenticated={(authenticated) => { setUser(authenticated); setError(""); }} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Package size={18} /></div><span>Lay-by</span></div>
        <div className="environment-badge"><span /> Fuji testnet</div>
        <nav className="nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button className={tab === id ? "nav-item active" : "nav-item"} key={id} onClick={() => setTab(id)}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="role-label">{user.role} account</div>
          <button className="nav-item" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{new Intl.DateTimeFormat("en-ZA", { dateStyle: "full" }).format(new Date())}</p>
            <h1>{tab === "overview" ? `Welcome, ${user.full_name.split(" ")[0]}` : tab === "architecture" ? "Reference architecture" : tab === "subscriptions" ? "Retailer subscriptions" : "Lay-by agreements"}</h1>
          </div>
          <div className="topbar-actions">
            {user.wallet_address && <button className="secondary-button compact" onClick={getTestTokens} disabled={busy}><CircleDollarSign size={15} /> Get tUSDC</button>}
            <a className="text-button faucet-link" href="https://faucet.avax.network/" target="_blank" rel="noreferrer">Get test AVAX <ExternalLink size={13} /></a>
            <button className={user.wallet_address ? "wallet-button linked" : "wallet-button"} onClick={connectWallet} disabled={busy}>
              <Wallet size={16} /> {user.wallet_address ? shortAddress(user.wallet_address) : "Link wallet"}
            </button>
            <button className="profile" onClick={signOut} title="Sign out">
              <div className="avatar">{user.full_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>
              <div className="profile-copy"><strong>{user.full_name}</strong><span>{user.role}</span></div><ChevronDown size={16} />
            </button>
          </div>
        </header>

        <div className="testnet-alert"><ShieldCheck size={16} /><span>Fuji testnet only. tUSDC is a faucet token with no monetary value. Do not send real funds.</span></div>
        {error && <div className="notice error" role="alert"><X size={17} />{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
        {notice && <div className="notice success" role="status"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={15} /></button></div>}

        {tab === "subscriptions" ? (
          <RetailerSubscriptions role={user.role} onOpenArchitecture={() => setTab("architecture")} />
        ) : tab === "architecture" ? (
          <ArchitectureOverview agreement={selected} onOpenAgreements={() => setTab("agreements")} />
        ) : tab === "overview" ? (
          <Overview
            agreements={agreements}
            totalOutstanding={totalOutstanding}
            activeCount={activeCount}
            collected={collected}
            onOpen={(id) => { setSelectedId(id); setTab("agreements"); }}
            onRefresh={() => loadAgreements().catch((e) => reportError(e.message))}
          />
        ) : (
          <section className="agreements-layout">
            <div className="agreements-panel">
              <div className="section-header">
                <div><p className="eyebrow">{agreements.length} total</p><h2>Agreements</h2></div>
                <div className="header-buttons">
                  <button className="icon-button" onClick={() => loadAgreements().catch((e) => reportError(e.message))} aria-label="Refresh"><RefreshCw size={16} /></button>
                  {user.role === "merchant" && <button className="primary-button small" onClick={() => setCreating(true)}><Plus size={16} /> New</button>}
                </div>
              </div>
              <AgreementList agreements={agreements} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            <div className="agreement-detail">
              {selected ? <AgreementDetails
                agreement={selected}
                user={user}
                busy={busy}
                auditEvents={auditEvents}
                onOpenArchitecture={() => setTab("architecture")}
                onAccept={() => acceptAgreement(selected)}
                onPay={() => payInstalment(selected)}
                onRequestCancel={() => cancellationAction(selected, "requestCancellation", "cancellation/request/verify", "Cancellation request submitted. The merchant has 7 days to respond; otherwise the escrow auto-refunds.")}
                onApproveCancel={() => cancellationAction(selected, "approveCancellation", "cancellation/verify", "Cancellation settled according to the agreed terms.")}
                onFinalizeCancel={() => cancellationAction(selected, "finalizeCancellation", "cancellation/verify", "Cancellation timed out and escrow was refunded.")}
              /> : <div className="empty-state"><ClipboardList size={28} /><h3>Select an agreement</h3><p>Choose an agreement to view its schedule and on-chain actions.</p></div>}
            </div>
          </section>
        )}
      </main>
      {creating && <CreateAgreementModal busy={busy} onClose={() => setCreating(false)} onSubmit={createAgreement} />}
    </div>
  );
}

function Overview({ agreements, totalOutstanding, activeCount, collected, onOpen, onRefresh }) {
  const activeAgreements = agreements.filter((agreement) => ["active", "offered", "cancellation_requested"].includes(agreement.status));
  return (
    <>
      <section className="stats">
        <Stat icon={CircleDollarSign} label="Outstanding balance" value={zar(totalOutstanding)} color="blue" />
        <Stat icon={Package} label="Active lay-bys" value={activeCount} color="green" />
        <Stat icon={ArrowDownLeft} label="Collected to date" value={zar(collected)} color="amber" />
      </section>
      <section className="recent">
        <div className="section-header">
          <div><p className="eyebrow">Payment activity</p><h2>Recent agreements</h2></div>
          <button className="text-button" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>
        </div>
        {agreements.length ? (
          <div className="table">
            <div className="table-head"><span>Item / customer</span><span>Status</span><span>Total (ZAR)</span><span>Paid</span></div>
            {agreements.slice(0, 8).map((agreement) => {
              const paid = (agreement.instalments || []).filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.amount_zar_cents), 0);
              return <button className="table-row agreement-row" key={agreement.id} onClick={() => onOpen(agreement.id)}>
                <span className="row-primary"><strong>{agreement.item}</strong><small>{agreement.customer_email}</small></span>
                <Status status={agreement.status} />
                <strong>{zar(agreement.total_zar_cents)}</strong>
                <span>{zar(paid)} <ArrowRight size={15} /></span>
              </button>;
            })}
          </div>
        ) : <div className="empty-state"><ClipboardList size={28} /><h3>No agreements yet</h3><p>Once a merchant creates a lay-by, it will appear here.</p></div>}
      </section>
      <div className="feature-note"><BadgeCheck size={18} /><div><strong>Payments settle through smart-contract escrow</strong><p>Instalment confirmations are checked against Fuji contract events before the dashboard updates.</p></div></div>
    </>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return <article className="stat-card"><div className={`stat-icon ${color}`}><Icon size={20} /></div><div><p>{label}</p><strong>{value}</strong><span className="trend">Live from your agreements</span></div></article>;
}

function Status({ status }) {
  const labels = {
    draft: "Draft",
    offered: "Awaiting acceptance",
    active: "Active",
    cancellation_requested: "Cancellation requested",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return <span className={`status status-${status}`}>{labels[status] || status}</span>;
}

function AgreementList({ agreements, selectedId, onSelect }) {
  if (!agreements.length) return <div className="empty-small">No agreements match this account.</div>;
  return <div className="agreement-list">
    {agreements.map((agreement) => <button key={agreement.id} className={selectedId === agreement.id ? "agreement-list-item selected" : "agreement-list-item"} onClick={() => onSelect(agreement.id)}>
      <span className="list-item-icon"><CreditCard size={17} /></span>
      <span className="list-item-copy"><strong>{agreement.item}</strong><small>{agreement.customer_email}</small><Status status={agreement.status} /></span>
      <ChevronDown size={15} className="list-chevron" />
    </button>)}
  </div>;
}

function AgreementDetails({ agreement, user, busy, auditEvents, onOpenArchitecture, onAccept, onPay, onRequestCancel, onApproveCancel, onFinalizeCancel }) {
  const paidCents = (agreement.instalments || []).filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.amount_zar_cents), 0);
  const paidPercent = agreement.total_zar_cents ? Math.min(100, (paidCents / Number(agreement.total_zar_cents)) * 100) : 0;
  const cancellationTimedOut = agreement.cancellation_deadline && Date.now() >= new Date(agreement.cancellation_deadline).getTime();
  const canAccept = user.role === "customer" && agreement.status === "offered";
  const canPay = user.role === "customer" && agreement.status === "active";
  const canRequestCancel = user.role === "customer" && agreement.status === "active";
  const canApproveCancel = user.role === "merchant" && agreement.status === "cancellation_requested";
  return (
    <div className="detail-card">
      <div className="detail-heading"><div><p className="eyebrow">Lay-by agreement</p><h2>{agreement.item}</h2></div><Status status={agreement.status} /></div>
      <p className="detail-customer">{user.role === "merchant" ? `Customer: ${agreement.customer_email}` : `Merchant: ${agreement.merchant_name}`}</p>
      <div className="amount-panel"><div><span>Total price</span><strong>{zar(agreement.total_zar_cents)}</strong></div><div><span>Paid</span><strong>{zar(paidCents)}</strong></div><div><span>Remaining</span><strong>{zar(Number(agreement.total_zar_cents) - paidCents)}</strong></div></div>
      <div className="progress-label"><span>Payment progress</span><strong>{Math.round(paidPercent)}%</strong></div>
      <div className="progress"><div style={{ width: `${paidPercent}%` }} /></div>
      <div className="terms-box"><strong>Cancellation terms</strong><p>{agreement.cancellation_terms}</p><small>FX quote: {Number(agreement.fx_rate_zar_per_usd).toFixed(4)} ZAR/USD · {agreement.fx_provider}</small></div>
      {agreement.status === "cancelled" && <div className="settlement-box"><strong>Escrow settlement</strong><span>Customer refund: {formatUnits(agreement.refund_token_units || "0", 6)} tUSDC</span><span>Merchant payout: {formatUnits(agreement.merchant_settlement_token_units || "0", 6)} tUSDC</span></div>}
      <div className="detail-actions">
        {canAccept && <button className="primary-button" disabled={busy} onClick={onAccept}><Check size={16} /> Accept agreement on Fuji</button>}
        {canPay && <button className="primary-button" disabled={busy} onClick={onPay}><Wallet size={16} /> Pay next instalment</button>}
        {agreement.status === "active" && <button className="secondary-button" onClick={onOpenArchitecture}><BadgeCheck size={15} /> Preview hardship proposal</button>}
        {canRequestCancel && <button className="secondary-button" disabled={busy} onClick={onRequestCancel}><X size={16} /> Request cancellation</button>}
        {canApproveCancel && <button className="primary-button" disabled={busy} onClick={onApproveCancel}><Check size={16} /> Approve cancellation</button>}
        {agreement.status === "cancellation_requested" && cancellationTimedOut && <button className="secondary-button" disabled={busy} onClick={onFinalizeCancel}><ShieldCheck size={16} /> Finalize expired request</button>}
        {agreement.contract_address && <a className="text-button contract-link" href={`${FUJI_EXPLORER}/address/${agreement.contract_address}`} target="_blank" rel="noreferrer" title={agreement.contract_address}>Escrow {agreement.contract_address} <ExternalLink size={14} /></a>}
      </div>
      <h3 className="subheading">Instalment schedule</h3>
      <div className="installment-list">
        {(agreement.instalments || []).map((row) => <div className="installment-row" key={row.id}>
          <span className="installment-number">{row.sequence === 0 ? "Deposit" : `#${row.sequence}`}</span>
          <span>{new Date(row.due_at).toLocaleDateString("en-ZA", { dateStyle: "medium" })}</span>
          <strong>{zar(row.amount_zar_cents)}</strong>
          <span className={row.status === "paid" ? "paid-label" : row.status === "cancelled" ? "cancelled-label" : "due-label"}>{row.status === "paid" ? "Paid" : row.status === "cancelled" ? "Cancelled" : "Due"}</span>
          {row.tx_hash && <a href={`${FUJI_EXPLORER}/tx/${row.tx_hash}`} target="_blank" rel="noreferrer" aria-label="View transaction"><ExternalLink size={13} /></a>}
        </div>)}
      </div>
      <h3 className="subheading">Append-only audit trail</h3>
      {auditEvents.length ? (
        <div className="agreement-audit">
          {auditEvents.map((event, index) => (
            <div className="audit-event" key={`${event.tx_hash || event.event_type}-${index}`}>
              <span className="audit-event-marker"><Check size={12} /></span>
              <span className="audit-event-copy"><strong>{event.event_type.replaceAll("_", " ")}</strong><small>{new Date(event.created_at).toLocaleString("en-ZA")}</small></span>
              {event.block_number ? <a href={`${FUJI_EXPLORER}/tx/${event.tx_hash}`} target="_blank" rel="noreferrer">Block {event.block_number}<ExternalLink size={12} /></a> : <small className="audit-pending">Application event</small>}
            </div>
          ))}
        </div>
      ) : <p className="audit-empty">Verified contract and application events will appear here.</p>}
      {agreement.status === "cancellation_requested" && !cancellationTimedOut && <p className="fine-print">The merchant has until {new Date(agreement.cancellation_deadline).toLocaleString()} to respond. If there is no response, anyone can trigger a full escrow refund.</p>}
      <p className="fine-print">Payment entries are finalized from confirmed Fuji events; this view is not a bank statement.</p>
    </div>
  );
}

function CreateAgreementModal({ busy, onClose, onSubmit }) {
  const [form, setForm] = useState({
    customer_email: "",
    customer_wallet: "",
    item: "",
    total: "",
    deposit: "",
    term_months: "6",
    cancellation_refund_percent: "100",
  });
  const [error, setError] = useState("");
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      try {
        const cents = centsFromInput(form.total);
        api(`/api/fx/quote?zar_cents=${cents}`).then((result) => { if (active) setQuote(result); }).catch(() => { if (active) setQuote(null); });
      } catch {
        setQuote(null);
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [form.total]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({
        customer_email: form.customer_email,
        customer_wallet: form.customer_wallet,
        item: form.item,
        total_zar_cents: centsFromInput(form.total),
        deposit_zar_cents: centsFromInput(form.deposit),
        term_months: Number(form.term_months),
        cancellation_refund_bps: Math.round(Number(form.cancellation_refund_percent) * 100),
      });
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div className="modal-heading"><div><p className="eyebrow">Merchant workflow</p><h2 id="create-title">New lay-by agreement</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button></div>
      <form className="form-stack" onSubmit={submit}>
        <label>Customer email<input type="email" required maxLength={254} value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} /></label>
        <label>Customer Fuji wallet<input required placeholder="0x…" value={form.customer_wallet} onChange={(e) => setForm({ ...form, customer_wallet: e.target.value })} /></label>
        <label>Item or service<input required maxLength={180} value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} /></label>
        <div className="form-grid">
          <label>Total price (ZAR)<input required inputMode="decimal" placeholder="1200.00" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></label>
          <label>Deposit (ZAR)<input required inputMode="decimal" placeholder="200.00" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></label>
        </div>
        <div className="form-grid">
          <label>Monthly instalments<select value={form.term_months} onChange={(e) => setForm({ ...form, term_months: e.target.value })}>{[3, 6, 9, 10, 12, 18, 24, 36].map((months) => <option value={months} key={months}>{months} months</option>)}</select></label>
          <label>Refund on merchant approval (%)<input type="number" min="0" max="100" step="1" required value={form.cancellation_refund_percent} onChange={(e) => setForm({ ...form, cancellation_refund_percent: e.target.value })} /></label>
        </div>
        <div className="fx-quote">{quote ? <>Indicative quote: {zar(centsFromInput(form.total))} ≈ {formatUnits(quote.token_units, 6)} tUSDC at {Number(quote.zar_per_usd).toFixed(4)} ZAR/USD. Rate from {quote.provider}.</> : "Enter total price to load the latest available USD/ZAR quote."}</div>
        <p className="fine-print">The customer must accept on-chain before paying. Merchant-approved cancellation uses the percentage shown; no response within 7 days automatically refunds escrow in full. Fuji tUSDC is a test token, not real USDC.</p>
        {error && <div className="notice error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Waiting for wallet…" : "Create on Fuji"}</button></div>
      </form>
    </section>
  </div>;
}