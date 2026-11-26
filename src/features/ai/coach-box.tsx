"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  ChevronLeft,
  LoaderCircle,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { askCoach } from "@/server/actions";
import { SafetyBanner } from "@/components/states";
import { ProposedChangesPanel } from "@/features/plan/proposed-changes";
import { coachReplyAction, frameCoachQuestion } from "@/features/ai/starters";
import type {
  CoachContextItem,
  CoachProposedChange,
  CoachReplyAction,
  CoachStarter,
} from "@/features/ai/types";
import { cn } from "@/lib/utils";

type CoachAnswer = {
  id?: string;
  title: string;
  answer: string;
  factors: Array<{ label: string; detail: string }>;
  requiresAcceptance: boolean;
  safety: boolean;
  proposedChanges: CoachProposedChange[];
};

type ThreadMessage =
  | {
      id: string;
      role: "user";
      text: string;
      status: "sent" | "failed";
      contextLabel?: string | null;
    }
  | {
      id: string;
      role: "coach";
      title: string;
      text: string;
      safety: boolean;
      recommendationId?: string;
      proposedChanges: CoachProposedChange[];
      action: CoachReplyAction | null;
      pending?: boolean;
    };

export function CoachBox({
  returnTo,
  starters,
  contextOptions,
  initialContext = null,
  weekHref,
  racePrepHref = null,
}: {
  returnTo: string | null;
  starters: CoachStarter[];
  contextOptions: CoachContextItem[];
  initialContext?: CoachContextItem | null;
  weekHref: string;
  racePrepHref?: string | null;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [context, setContext] = useState<CoachContextItem | null>(initialContext);
  const [pending, setPending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerId = useId();
  const empty = messages.length === 0;

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "0px";
    const next = Math.min(Math.max(node.scrollHeight, 44), 120);
    node.style.height = `${next}px`;
  }, [draft, empty]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      const root = document.getElementById(pickerId);
      if (root && !root.contains(target)) setPickerOpen(false);
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen, pickerId]);

  function fillStarter(label: string) {
    setDraft(label);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const len = label.length;
      inputRef.current?.setSelectionRange(len, len);
    });
  }

  function selectContext(item: CoachContextItem) {
    setContext(item);
    setPickerOpen(false);
    inputRef.current?.focus();
  }

  async function send(questionOverride?: string, retryId?: string) {
    const question = (questionOverride ?? draft).trim();
    if (!question || pending) return;

    const attached = context;
    const userId = retryId ?? `u-${Date.now()}`;
    const coachId = `c-${Date.now()}`;
    setError(null);
    setPending(true);
    setDraft("");
    setPickerOpen(false);
    setMessages((prev) => {
      const withoutRetry = retryId
        ? prev.filter((item) => item.id !== retryId)
        : prev;
      return [
        ...withoutRetry,
        {
          id: userId,
          role: "user",
          text: question,
          status: "sent",
          contextLabel: attached?.label ?? null,
        },
        {
          id: coachId,
          role: "coach",
          title: "",
          text: "",
          safety: false,
          proposedChanges: [],
          action: null,
          pending: true,
        },
      ];
    });

    try {
      const framed = frameCoachQuestion(question, attached);
      const next = (await askCoach(framed, attached)) as CoachAnswer;
      const action = resolveAction(next, attached, weekHref, racePrepHref, returnTo);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === coachId && message.role === "coach"
            ? {
                ...message,
                title: next.title,
                text: next.answer,
                safety: next.safety,
                recommendationId: next.id,
                proposedChanges: Array.isArray(next.proposedChanges) ? next.proposedChanges : [],
                action,
                pending: false,
              }
            : message,
        ),
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The coach did not answer.";
      setError(message);
      setDraft(question);
      setMessages((prev) =>
        prev
          .filter((item) => item.id !== coachId)
          .map((item) =>
            item.id === userId && item.role === "user"
              ? { ...item, status: "failed" as const }
              : item,
          ),
      );
    } finally {
      setPending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  const composer = (
    <CoachComposer
      draft={draft}
      onDraftChange={setDraft}
      context={context}
      onClearContext={() => setContext(null)}
      contextOptions={contextOptions}
      pickerOpen={pickerOpen}
      onTogglePicker={() => setPickerOpen((open) => !open)}
      onSelectContext={selectContext}
      pickerId={pickerId}
      pending={pending}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      inputRef={inputRef}
      canSend={Boolean(draft.trim()) && !pending}
    />
  );

  return (
    <div
      className={cn(
        "mx-auto flex w-full min-w-0 max-w-2xl flex-col",
        empty
          ? "min-h-[calc(100dvh-7.5rem)] md:min-h-[calc(100dvh-2rem)]"
          : "min-h-[calc(100dvh-7.5rem)] md:min-h-[calc(100dvh-2rem)]",
      )}
    >
      <header className="flex shrink-0 items-center gap-1 border-b border-line px-1 py-2">
        <Link
          href={returnTo || "/home"}
          className="btn btn-ghost btn-sm min-h-11 min-w-11 border-transparent px-2"
          aria-label="Back"
        >
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold tracking-tight">AI Coach</h1>
        <span className="inline-block min-w-11" aria-hidden />
      </header>

      {empty ? (
        <div className="flex flex-1 flex-col justify-center gap-5 px-4 py-8">
          <div className="mx-auto w-full max-w-lg">
            <h2 className="mb-3 text-center text-lg font-bold tracking-tight text-ink">
              Ask your coach
            </h2>
            {composer}
            {starters.length ? (
              <ul className="mt-4 grid gap-2">
                {starters.map((starter) => (
                  <li key={starter.id}>
                    <button
                      type="button"
                      className="w-full rounded-[var(--radius-md)] border border-line bg-card px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
                      onClick={() => fillStarter(starter.label)}
                    >
                      {starter.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-elevated px-3.5 py-2.5 text-sm text-ink">
                    {message.contextLabel ? (
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {message.contextLabel}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                    {message.status === "failed" ? (
                      <button
                        type="button"
                        className="mt-2 text-xs font-bold text-maroon"
                        onClick={() => void send(message.text, message.id)}
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <article key={message.id} className="max-w-[95%] space-y-2">
                  {message.pending ? (
                    <p className="flex items-center gap-2 text-sm text-muted">
                      <LoaderCircle size={14} className="animate-spin" aria-hidden />
                      Coach is responding…
                    </p>
                  ) : (
                    <>
                      {message.safety ? <SafetyBanner /> : null}
                      {message.title ? (
                        <h2 className="text-sm font-bold text-ink">{message.title}</h2>
                      ) : null}
                      <CoachBody text={message.text} />
                      {message.action ? (
                        <Link
                          href={message.action.href}
                          className="inline-flex text-sm font-semibold text-ink underline decoration-line underline-offset-4 hover:text-maroon"
                        >
                          {message.action.label}
                        </Link>
                      ) : null}
                      {message.proposedChanges.length && message.recommendationId ? (
                        <div className="pt-1">
                          <ProposedChangesPanel
                            proposalId={message.recommendationId}
                            explanation={message.text}
                            changes={message.proposedChanges.map((change, index) => ({
                              id: `${message.recommendationId}-${index}`,
                              title: change.title,
                              fromDate: change.date,
                              toDate: change.date,
                              fromDurationMin: change.durationMin,
                              toDurationMin: change.durationMin,
                              fromIntensity: change.intensity,
                              toIntensity: change.intensity,
                              reason: change.why,
                              detail: `${change.sport} · ${change.durationMin} min · ${change.intensity}`,
                            }))}
                            onAcceptAll={async (id) => {
                              const { respondToRecommendation } = await import("@/server/actions");
                              await respondToRecommendation(id, true);
                            }}
                            onRejectAll={async (id) => {
                              const { respondToRecommendation } = await import("@/server/actions");
                              await respondToRecommendation(id, false);
                            }}
                          />
                        </div>
                      ) : null}
                    </>
                  )}
                </article>
              ),
            )}
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="sticky bottom-0 shrink-0 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
            {composer}
          </div>
        </>
      )}
    </div>
  );
}

function CoachComposer({
  draft,
  onDraftChange,
  context,
  onClearContext,
  contextOptions,
  pickerOpen,
  onTogglePicker,
  onSelectContext,
  pickerId,
  pending,
  onSubmit,
  onKeyDown,
  inputRef,
  canSend,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  context: CoachContextItem | null;
  onClearContext: () => void;
  contextOptions: CoachContextItem[];
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onSelectContext: (item: CoachContextItem) => void;
  pickerId: string;
  pending: boolean;
  onSubmit: (event: FormEvent) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  canSend: boolean;
}) {
  return (
    <form
      id={pickerId}
      onSubmit={onSubmit}
      className="coach-composer relative grid gap-2 rounded-2xl border border-white/18 bg-[#1a1c1f] p-2.5 text-[#f5f5f5] shadow-none"
    >
      {context ? (
        <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-xs font-semibold text-[#f5f5f5]">
            <span className="truncate">{context.label}</span>
            <button
              type="button"
              className="grid h-5 w-5 place-items-center rounded-full text-[#f5f5f5]/80 hover:bg-white/10"
              aria-label={`Remove ${context.label}`}
              onClick={onClearContext}
            >
              <X size={12} strokeWidth={2} aria-hidden />
            </button>
          </span>
        </div>
      ) : null}

      <label className="sr-only" htmlFor={`${pickerId}-input`}>
        Ask about your training
      </label>
      <textarea
        id={`${pickerId}-input`}
        ref={inputRef}
        name="question"
        rows={1}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about your training…"
        className="coach-composer-input max-h-[7.5rem] min-h-11 w-full resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-sm leading-relaxed text-[#f5f5f5] shadow-none placeholder:text-white/45 focus-visible:outline-none focus-visible:ring-0"
        disabled={pending}
      />

      <div className="relative flex items-center justify-between gap-2 px-0.5">
        <div className="relative">
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#f5f5f5]/90 hover:bg-white/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--maroon)]"
            aria-expanded={pickerOpen}
            aria-controls={`${pickerId}-menu`}
            onClick={onTogglePicker}
          >
            <Paperclip size={14} strokeWidth={1.75} aria-hidden />
            Add context
          </button>
          {pickerOpen ? (
            <div
              id={`${pickerId}-menu`}
              role="menu"
              className="absolute bottom-[calc(100%+0.4rem)] left-0 z-20 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-[var(--radius-md)] border border-line bg-card text-ink shadow-[var(--shadow)]"
            >
              {contextOptions.length ? (
                <ul className="max-h-64 overflow-y-auto py-1">
                  {contextOptions.map((item) => (
                    <li key={`${item.kind}-${item.id ?? item.label}`}>
                      <button
                        type="button"
                        role="menuitem"
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-elevated",
                          context?.kind === item.kind && context?.id === item.id && "bg-maroon-soft",
                        )}
                        onClick={() => onSelectContext(item)}
                      >
                        <span className="font-semibold">{item.label}</span>
                        {item.detail ? <span className="text-xs text-muted">{item.detail}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-3 text-sm text-muted">No context items available yet.</p>
              )}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          className="grid h-9 w-9 place-items-center rounded-full bg-[var(--maroon-deep)] text-white disabled:opacity-40"
          disabled={!canSend}
          aria-label={pending ? "Sending" : "Send"}
          aria-busy={pending}
        >
          {pending ? (
            <LoaderCircle size={16} className="animate-spin" aria-hidden />
          ) : (
            <Send size={15} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
    </form>
  );
}

function CoachBody({ text }: { text: string }) {
  const blocks = text
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length <= 1) {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{text}</p>;
  }

  const bullets = blocks.every((block) => /^[-•*]/.test(block));
  if (bullets) {
    return (
      <ul className="grid list-disc gap-1.5 pl-5 text-sm leading-relaxed text-ink">
        {blocks.map((block) => (
          <li key={block}>{block.replace(/^[-•*]\s*/, "")}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-2 text-sm leading-relaxed text-ink">
      {blocks.map((block) => (
        <p key={block} className="whitespace-pre-wrap">
          {block}
        </p>
      ))}
    </div>
  );
}

function resolveAction(
  answer: CoachAnswer,
  attached: CoachContextItem | null,
  weekHref: string,
  racePrepHref: string | null,
  returnTo: string | null,
): CoachReplyAction | null {
  if (attached?.kind === "event" && (attached.id || racePrepHref)) {
    return {
      label: "Open race prep",
      href: attached.id
        ? `/events/${attached.id}/prep?from=${encodeURIComponent(returnTo || "/ai")}`
        : (racePrepHref as string),
    };
  }

  const mentionsEvent = /race|event|prep|taper/i.test(`${answer.title} ${answer.answer}`);
  if (mentionsEvent && racePrepHref) {
    return { label: "Open race prep", href: racePrepHref };
  }

  if (attached?.kind === "week" || attached?.kind === "workout" || attached?.kind === "change") {
    return coachReplyAction({
      kind: attached.kind,
      eventId: attached.id,
      weekHref,
      from: returnTo || "/ai",
    });
  }

  if (/plan|workout|schedule|week|session/i.test(`${answer.title} ${answer.answer}`)) {
    return coachReplyAction({
      kind: "week",
      weekHref,
      from: returnTo || "/ai",
    });
  }

  return null;
}

export { CoachBox as CoachChat };
