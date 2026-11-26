import { Link } from "@tanstack/react-router";
import { LogOut, Wallet } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/common/StatusPill";

export default function TopBar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-baseline gap-1.5">
          <span className="font-display text-[17px] font-bold tracking-tight">LaybyFlex</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
            console
          </span>
        </Link>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <StatusPill tone="chain" mono>
          <span className="sm:hidden">Fuji · 43113</span>
          <span className="hidden sm:inline">Fuji testnet · 43113</span>
        </StatusPill>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground md:flex">
            <Wallet className="h-3.5 w-3.5" />
            0x7f3a…9c21
          </span>
          <span className="hidden max-w-[160px] truncate text-[12px] text-muted-foreground sm:block">
            {user?.full_name || user?.email || ""}
          </span>
          <Button variant="ghost" size="icon" onClick={() => logout()} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
