"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { formatLindaValue } from "@/lib/linda";
import type { LindaListBlock, LindaReply, LindaStatsBlock } from "@/types/linda";

interface LindaReplyViewProps {
  reply: LindaReply;
  /** Called when a link is followed, so the full-screen mobile panel can close. */
  onNavigate: () => void;
}

/** Paragraphs split on blank lines; single newlines kept. Plain text only. */
function AnswerText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p.trim()}
        </p>
      ))}
    </div>
  );
}

function StatsBlock({ block }: { block: LindaStatsBlock }) {
  return (
    <section className="space-y-1.5">
      {block.title && <h4 className="text-xs font-semibold text-foreground">{block.title}</h4>}
      <dl className="grid grid-cols-2 gap-2">
        {block.items.map((item, i) => (
          <div key={i} className="rounded-lg border border-border bg-background px-2.5 py-2">
            <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums break-words">
              {formatLindaValue(item)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ListBlock({ block, onNavigate }: { block: LindaListBlock; onNavigate: () => void }) {
  const List = block.ordered ? "ol" : "ul";
  return (
    <section className="space-y-1.5">
      {block.title && <h4 className="text-xs font-semibold text-foreground">{block.title}</h4>}
      <List className="divide-y divide-border rounded-lg border border-border bg-background">
        {block.items.map((item, i) => (
          <li key={i} className="px-2.5 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium break-words">
                  {block.ordered && <span className="text-muted-foreground">{i + 1}. </span>}
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground break-words">{item.subtitle}</p>
                )}
              </div>
              {item.url && (
                <Link
                  href={item.url}
                  onClick={onNavigate}
                  className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-brand-orange hover:underline"
                >
                  View
                  <ArrowUpRight className="size-3" />
                </Link>
              )}
            </div>
            {item.fields.length > 0 && (
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                {item.fields.map((f, j) => (
                  <div key={j} className="contents">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="text-right tabular-nums">{formatLindaValue(f)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </List>
    </section>
  );
}

/** One Linda answer: the written explanation, then Lendy's figures, then links. */
export function LindaReplyView({ reply, onNavigate }: LindaReplyViewProps) {
  return (
    <div className="space-y-3">
      <AnswerText text={reply.answer} />
      {reply.blocks.map((block, i) =>
        block.type === "stats" ? (
          <StatsBlock key={i} block={block} />
        ) : (
          <ListBlock key={i} block={block} onNavigate={onNavigate} />
        ),
      )}
      {reply.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {reply.links.map((link, i) => (
            <Link
              key={i}
              href={link.url}
              onClick={onNavigate}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium hover:border-brand-orange/50 hover:text-brand-orange"
            >
              {link.label}
              <ArrowUpRight className="size-3" />
            </Link>
          ))}
        </div>
      )}
      {reply.as_of && (
        <p className="text-[11px] text-muted-foreground">As of {formatDateTime(reply.as_of)}</p>
      )}
    </div>
  );
}
