import { ExternalLink, FileText } from "lucide-react";
import PanelHeading from "@/components/common/PanelHeading";
import { shortHash } from "@/lib/format";

export default function AuditTrailPanel({ events }) {
  return (
    <div>
      <PanelHeading label="Contract audit trail" hint="Append-only events on Fuji C-Chain" />
      <ol className="mt-3 space-y-3">
        {events.map((e) => (
          <li key={e.id} className="border-l-2 border-border pl-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] font-medium">{e.event_type}</p>
              <span className="font-mono text-[10px] text-muted-foreground">#{e.block_number}</span>
            </div>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{e.summary}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {shortHash(e.tx_hash)}
                <ExternalLink className="h-2.5 w-2.5" />
              </span>
              <span aria-hidden>·</span>
              <span>{e.actor}</span>
            </div>
            {e.document_hash ? (
              <p className="mt-1 inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                <FileText className="h-2.5 w-2.5" />
                ipfs://{shortHash(e.document_hash, 8, 6)}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {events.length === 0 ? (
        <p className="mt-3 text-[12px] text-muted-foreground">No events recorded yet.</p>
      ) : null}
      <p className="mt-4 rounded-md border border-dashed border-border p-2.5 text-[11px] leading-4 text-muted-foreground">
        Only the document hash and amount are on-chain. Customer identity and the signed agreement
        stay encrypted off-chain.
      </p>
    </div>
  );
}