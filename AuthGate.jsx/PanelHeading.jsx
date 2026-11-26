export default function PanelHeading({ label, hint, action }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
      <div>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {hint ? <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
