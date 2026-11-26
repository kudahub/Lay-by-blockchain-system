import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { avaxFor, FUJI_CHAIN_HEX, FUJI_EXPLORER, FUJI_RPC, TREASURY_ADDRESS, weiFor } from "@/lib/wallet";
import { paySubscription } from "@/lib/server-fns";

function detectWallet() {
  const eth = window.ethereum;
  if (!eth) return "";
  if (eth.isMetaMask) return "MetaMask";
  if (eth.isAvalanche || eth.isCore) return "Core Wallet";
  return "Browser wallet";
}

const short = (value) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "");

export default function WalletPay({ plan, onPaid }) {
  const activate = useServerFn(paySubscription);
  const [wallet, setWallet] = useState("");
  const [account, setAccount] = useState("");
  const [stage, setStage] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setWallet(detectWallet());
  }, []);

  async function ensureFuji(eth) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: FUJI_CHAIN_HEX }] });
    } catch (err) {
      if (err.code === 4902 || /unrecognized|not added/i.test(err.message || "")) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: FUJI_CHAIN_HEX,
              chainName: "Avalanche Fuji Testnet",
              nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
              rpcUrls: [FUJI_RPC],
              blockExplorerUrls: [FUJI_EXPLORER],
            },
          ],
        });
        return;
      }
      if (err.code === 4001) throw new Error("Approve the switch to Avalanche Fuji to continue.");
      throw err;
    }
  }

  async function connect() {
    setError("");
    if (!window.ethereum) {
      setError("No browser wallet found. Install Core Wallet or MetaMask, then reload this page.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      await ensureFuji(window.ethereum);
    } catch (err) {
      setError(err.message || "The wallet connection was cancelled.");
    }
  }

  async function payNow() {
    setError("");
    setBusy(true);
    setStage("sending");
    try {
      const hash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: TREASURY_ADDRESS, value: `0x${weiFor(plan.price).toString(16)}` }],
      });
      setTxHash(hash);
      setStage("confirming");
      // Fuji confirms in a few seconds; the plan only activates once the server sees the receipt.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const result = await activate({ data: { plan: plan.id, tx_hash: hash } });
        if (result.state === "confirmed") {
          setStage("done");
          toast.success(`${plan.name} activated · ${short(hash)}`);
          await onPaid?.();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      setStage("idle");
      setError("The transaction is still confirming. Check it on Snowtrace — the plan activates once it lands.");
    } catch (err) {
      setStage("idle");
      if (err.code === 4001) setError("You rejected the payment in your wallet.");
      else setError(err.message || "The payment could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "done") {
    return (
      <div className="rounded-md border border-success/40 bg-success/5 p-3 text-center">
        <Check className="mx-auto h-5 w-5 text-success" />
        <p className="mt-1 text-[13px] font-medium">Plan activated on Fuji</p>
        <a
          href={`${FUJI_EXPLORER}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:underline"
        >
          {short(txHash)} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <div role="alert" className="rounded-md bg-destructive/10 p-2.5 text-[12px] leading-4 text-destructive">
          {error}
        </div>
      ) : null}

      {!account ? (
        <Button className="w-full" onClick={connect}>
          <Wallet className="mr-1.5 h-4 w-4" />
          {wallet ? `Connect ${wallet}` : "Connect Core Wallet or MetaMask"}
        </Button>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-md border border-border px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
            <span>
              {wallet} · {short(account)}
            </span>
            <span>Avalanche Fuji</span>
          </div>
          <Button className="w-full" onClick={payNow} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {stage === "sending"
              ? "Confirm in your wallet..."
              : stage === "confirming"
                ? "Confirming on-chain..."
                : `Pay ${avaxFor(plan.price)} AVAX`}
          </Button>
        </>
      )}

      <p className="text-center text-[11px] leading-4 text-muted-foreground">
        Paid to the LaybyFlex treasury <span className="font-mono">{short(TREASURY_ADDRESS)}</span> — testnet AVAX only.
      </p>
    </div>
  );
}