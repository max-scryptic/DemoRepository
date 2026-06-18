"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, CirclePlus, GripVertical, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { cardsTable, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { BoardCard, CardDraft, Status } from "@/types/board";

const columns: Array<{ id: Status; title: string; accent: string }> = [
  { id: "backlog", title: "Backlog", accent: "bg-slate-500" },
  { id: "todo", title: "To do", accent: "bg-sky-500" },
  { id: "in_progress", title: "In progress", accent: "bg-amber-500" },
  { id: "review", title: "Review", accent: "bg-violet-500" },
  { id: "done", title: "Done", accent: "bg-emerald-500" }
];

const starterCards: BoardCard[] = [
  {
    id: "starter-1",
    title: "Draft onboarding flow",
    description: "Map the first-use path and define what a new teammate should see first.",
    status: "backlog",
    position: 0,
    labels: ["Product", "Research"]
  },
  {
    id: "starter-2",
    title: "Create launch checklist",
    description: "Collect the final QA, copy, analytics, and handoff tasks in one place.",
    status: "todo",
    position: 0,
    labels: ["Ops"]
  },
  {
    id: "starter-3",
    title: "Build project board",
    description: "Support cards, statuses, drag-and-drop movement, and persistence.",
    status: "in_progress",
    position: 0,
    labels: ["Engineering"]
  },
  {
    id: "starter-4",
    title: "Review Supabase schema",
    description: "Confirm table policies, indexes, and environment variables before deploy.",
    status: "review",
    position: 0,
    labels: ["Data"]
  }
];

const emptyDraft: CardDraft = {
  title: "",
  description: "",
  labels: ""
};

export default function ProjectBoard() {
  const [cards, setCards] = useState<BoardCard[]>(starterCards);
  const [draft, setDraft] = useState<CardDraft>(emptyDraft);
  const [draftStatus, setDraftStatus] = useState<Status>("todo");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pointerDraggedId, setPointerDraggedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadCards() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from(cardsTable)
        .select("*")
        .order("status", { ascending: true })
        .order("position", { ascending: true });

      if (ignore) {
        return;
      }

      if (error) {
        setNotice(`Supabase is configured, but cards could not be loaded: ${error.message}`);
      } else if (data && data.length > 0) {
        setCards(data as BoardCard[]);
      }

      setLoading(false);
    }

    loadCards();

    return () => {
      ignore = true;
    };
  }, []);

  const filteredCards = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return cards;
    }

    return cards.filter((card) =>
      [card.title, card.description, ...card.labels].some((value) =>
        value.toLowerCase().includes(needle)
      )
    );
  }, [cards, query]);

  const groupedCards = useMemo(() => {
    return columns.reduce(
      (acc, column) => {
        acc[column.id] = filteredCards
          .filter((card) => card.status === column.id)
          .sort((a, b) => a.position - b.position);
        return acc;
      },
      {} as Record<Status, BoardCard[]>
    );
  }, [filteredCards]);

  async function persistCards(nextCards: BoardCard[]) {
    if (!supabase) {
      return;
    }

    const rows = nextCards.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      status: card.status,
      position: card.position,
      labels: card.labels
    }));

    const { error } = await supabase.from(cardsTable).upsert(rows, { onConflict: "id" });

    if (error) {
      setNotice(`Changes are visible locally, but Supabase could not save them: ${error.message}`);
    }
  }

  async function handleCreateCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = draft.title.trim();

    if (!title) {
      return;
    }

    setSaving(true);

    const nextCard: BoardCard = {
      id: crypto.randomUUID(),
      title,
      description: draft.description.trim(),
      status: draftStatus,
      position: cards.filter((card) => card.status === draftStatus).length,
      labels: draft.labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
    };

    const nextCards = normalizePositions([...cards, nextCard]);
    setCards(nextCards);
    setDraft(emptyDraft);
    await persistCards(nextCards);
    setSaving(false);
  }

  async function moveCard(cardId: string, nextStatus: Status) {
    const nextCards = normalizePositions(
      cards.map((card) => (card.id === cardId ? { ...card, status: nextStatus } : card))
    );

    setCards(nextCards);
    await persistCards(nextCards);
  }

  function moveActiveCard(nextStatus: Status) {
    const activeCardId = draggedId ?? pointerDraggedId;

    if (!activeCardId) {
      return;
    }

    setDraggedId(null);
    setPointerDraggedId(null);
    moveCard(activeCardId, nextStatus);
  }

  async function deleteCard(cardId: string) {
    const nextCards = normalizePositions(cards.filter((card) => card.id !== cardId));
    setCards(nextCards);

    if (supabase) {
      const { error } = await supabase.from(cardsTable).delete().eq("id", cardId);
      if (error) {
        setNotice(`The card was removed locally, but Supabase could not delete it: ${error.message}`);
      }
    }
  }

  const totalDone = cards.filter((card) => card.status === "done").length;

  return (
    <main
      className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8"
      onPointerUp={() => setPointerDraggedId(null)}
    >
      <section className="mx-auto flex max-w-[1520px] flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Project management
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              Project Board
            </h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <Metric label="Cards" value={cards.length.toString()} />
            <Metric label="Done" value={totalDone.toString()} />
            <Metric label="Storage" value={isSupabaseConfigured ? "Supabase" : "Local"} />
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
            <div className="mb-4 flex items-center gap-2">
              <CirclePlus className="h-5 w-5 text-teal-700" />
              <h2 className="text-base font-semibold text-slate-950">New card</h2>
            </div>

            <form className="flex flex-col gap-3" onSubmit={handleCreateCard}>
              <label className="text-sm font-medium text-slate-700" htmlFor="card-title">
                Title
              </label>
              <input
                id="card-title"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Design pricing page"
              />

              <label className="text-sm font-medium text-slate-700" htmlFor="card-description">
                Description
              </label>
              <textarea
                id="card-description"
                className="min-h-24 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="Add context, acceptance criteria, or next steps"
              />

              <label className="text-sm font-medium text-slate-700" htmlFor="card-labels">
                Labels
              </label>
              <input
                id="card-labels"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={draft.labels}
                onChange={(event) => setDraft({ ...draft, labels: event.target.value })}
                placeholder="Design, Launch"
              />

              <label className="text-sm font-medium text-slate-700" htmlFor="card-status">
                Status
              </label>
              <select
                id="card-status"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={draftStatus}
                onChange={(event) => setDraftStatus(event.target.value as Status)}
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>

              <button
                className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add card
              </button>
            </form>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="search">
                Search board
              </label>
              <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  id="search"
                  className="w-full border-0 bg-transparent text-sm outline-none"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Title, label, or description"
                />
              </div>
            </div>

            {notice && (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {notice}
              </p>
            )}
          </aside>

          <section className="overflow-x-auto pb-3">
            <div className="grid min-w-[1120px] grid-cols-5 gap-3">
              {columns.map((column) => (
                <div
                  key={column.id}
                  className={`rounded-lg border border-slate-200 bg-white/88 p-3 shadow-panel transition ${
                    pointerDraggedId || draggedId ? "ring-2 ring-teal-100" : ""
                  }`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    moveActiveCard(column.id);
                  }}
                  onPointerUpCapture={(event) => {
                    if (pointerDraggedId) {
                      event.stopPropagation();
                      moveActiveCard(column.id);
                    }
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
                      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                        {column.title}
                      </h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {groupedCards[column.id].length}
                    </span>
                  </div>

                  <div className="flex min-h-[560px] flex-col gap-3 rounded-md bg-slate-50 p-2">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 py-6 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading
                      </div>
                    ) : groupedCards[column.id].length === 0 ? (
                      <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                        Drop cards here
                      </div>
                    ) : (
                      groupedCards[column.id].map((card) => (
                        <article
                          key={card.id}
                          draggable
                          onDragStart={() => {
                            setDraggedId(card.id);
                            setPointerDraggedId(card.id);
                          }}
                          onDragEnd={() => {
                            setDraggedId(null);
                            setPointerDraggedId(null);
                          }}
                          onPointerDown={(event) => {
                            if ((event.target as HTMLElement).closest("button")) {
                              return;
                            }

                            setPointerDraggedId(card.id);
                          }}
                          className={`rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
                            pointerDraggedId === card.id || draggedId === card.id
                              ? "cursor-grabbing opacity-75"
                              : "cursor-grab"
                          }`}
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                              <h3 className="text-sm font-semibold leading-5 text-slate-950">
                                {card.title}
                              </h3>
                            </div>
                            <button
                              aria-label={`Delete ${card.title}`}
                              className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              onClick={() => deleteCard(card.id)}
                              onPointerDown={(event) => event.stopPropagation()}
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {card.description && (
                            <p className="mb-3 text-sm leading-5 text-slate-600">{card.description}</p>
                          )}

                          <div className="flex flex-wrap gap-1.5">
                            {card.labels.map((label) => (
                              <span
                                key={label}
                                className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800"
                              >
                                {label}
                              </span>
                            ))}
                          </div>

                          {card.status === "done" && (
                            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                              <Check className="h-3.5 w-3.5" />
                              Complete
                            </div>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function normalizePositions(cards: BoardCard[]) {
  return columns.flatMap((column) =>
    cards
      .filter((card) => card.status === column.id)
      .map((card, position) => ({ ...card, position }))
  );
}
