import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/format";
import { createAgreement } from "@/lib/server-fns";

const EMPTY = {
  customer_name: "",
  customer_email: "",
  item: "",
  total_amount: "",
  deposit_amount: "",
  term_months: "10",
};

export default function CreateAgreementDialog({ onCreated }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const trigger = (
    <Button size="sm">
      <Plus className="mr-1.5 h-4 w-4" />
      New agreement
    </Button>
  );
  const body = <AgreementForm onDone={(a) => { setOpen(false); onCreated?.(a); }} />;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="border-b border-border text-left">
            <DrawerTitle className="text-[17px]">New lay-by agreement</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto p-4">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[17px]">New lay-by agreement</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function AgreementForm({ onDone }) {
  const run = useServerFn(createAgreement);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const total = Number(form.total_amount) || 0;
  const deposit = Number(form.deposit_amount) || 0;
  const term = Number(form.term_months) || 0;
  const instalment = term > 0 ? Math.floor(Math.max(0, total - deposit) / term) : 0;

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const agreement = await run({
        data: {
          customer_name: form.customer_name,
          customer_email: form.customer_email,
          item: form.item,
          total_amount: total,
          deposit_amount: deposit,
          term_months: term,
        },
      });
      toast.success("Agreement created on Fuji");
      onDone?.(agreement);
    } catch (err) {
      setError(err?.message || "Could not create the agreement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Customer name">
          <Input name="customer_name" value={form.customer_name} onChange={set("customer_name")} required minLength={2} maxLength={120} />
        </Field>
        <Field label="Customer email">
          <Input name="customer_email" type="email" value={form.customer_email} onChange={set("customer_email")} maxLength={160} />
        </Field>
      </div>
      <Field label="Item">
        <Input name="item" value={form.item} onChange={set("item")} required minLength={2} maxLength={160} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Total (R)">
          <Input name="total_amount" type="number" min="1" value={form.total_amount} onChange={set("total_amount")} required />
        </Field>
        <Field label="Deposit (R)">
          <Input name="deposit_amount" type="number" min="0" value={form.deposit_amount} onChange={set("deposit_amount")} />
        </Field>
        <Field label="Term (months)">
          <Input name="term_months" type="number" min="2" max="36" value={form.term_months} onChange={set("term_months")} required />
        </Field>
      </div>

      <div className="rounded-md border border-border bg-secondary/50 p-3 text-[12px] text-muted-foreground">
        {money(total - deposit)} financed · {term || 0} instalments of{" "}
        <span className="font-semibold text-foreground">{money(instalment)}</span>
      </div>

      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        Create agreement
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Contract and document hash are generated in simulation mode.
      </p>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
