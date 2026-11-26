import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  active: "bg-success/10 text-[#0b7a58] ring-success/25",
  pending: "bg-binance/10 text-[#8a6a00] ring-binance/35",
  danger: "bg-avalanche/10 text-[#b3272a] ring-avalanche/25",
  chain: "bg-foreground text-background ring-foreground",
  outline: "bg-transparent text-muted-foreground ring-border",
};

export default function StatusPill({ tone = "neutral", mono = false, className, children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        mono && "font-mono",
        TONES[tone] || TONES.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}