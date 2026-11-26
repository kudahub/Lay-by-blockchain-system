import { Outlet } from "@tanstack/react-router";
import TopBar from "@/components/layout/TopBar";
import NavLinks from "@/components/layout/NavLinks";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-border bg-card lg:block">
          <NavLinks orientation="vertical" />
        </aside>
        <main className="min-w-0 flex-1 pb-24 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <NavLinks orientation="horizontal" />
      </div>
    </div>
  );
}