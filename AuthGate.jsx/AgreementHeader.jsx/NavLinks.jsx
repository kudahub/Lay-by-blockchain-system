import { Link, useRouterState } from "@tanstack/react-router";
import { Boxes, CreditCard, LayoutGrid, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/architecture", label: "Architecture", icon: Boxes },
  { to: "/pricing", label: "Subscriptions", icon: CreditCard },
  { to: "/demo", label: "Live demo", icon: PlayCircle },
];

export default function NavLinks({ orientation = "vertical" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (orientation === "horizontal") {
    return (
      <nav className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active ? "text-avalanche" : "text-muted-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-1 p-3">
      {ITEMS.map((item) => {
        const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-6 rounded-md border border-dashed border-border p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Settlement rail
        </p>
        <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
          Agreements settle on Avalanche Fuji. Subscriptions bill through Binance Pay.
        </p>
      </div>
    </nav>
  );
}