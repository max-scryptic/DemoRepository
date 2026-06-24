"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  CirclePlus,
  GripVertical,
  LayoutDashboard,
  Loader2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cardsTable, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { BoardCard, CardDraft, Status } from "@/types/board";

const columns: Array<{ id: Status; title: string; accent: string }> = [
  { id: "backlog", title: "Backlog", accent: "bg-slate-400" },
  { id: "todo", title: "To do", accent: "bg-stone-500" },
  { id: "in_progress", title: "In progress", accent: "bg-amber-600" },
  { id: "review", title: "Review", accent: "bg-teal-700" },
  { id: "done", title: "Done", accent: "bg-emerald-700" }
];

const starterCards: BoardCard[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Draft onboarding flow",
    description: "Map the first-use path and define what a new teammate should see first.",
    status: "backlog",
    position: 0,
    labels: ["Product", "Research"]
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Create launch checklist",
    description: "Collect the final QA, copy, analytics, and handoff tasks in one place.",
    status: "todo",
    position: 0,
    labels: ["Ops"]
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Build project board",
    description: "Support cards, statuses, drag-and-drop movement, and persistence.",
    status: "in_progress",
    position: 0,
    labels: ["Engineering"]
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
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

type Theme = "light" | "dark";
type ActiveView = "board" | "settings";

export default function ProjectBoard() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") {
      return "dark";
    }

    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });
  const [cards, setCards] = useState<BoardCard[]>(starterCards);
  const [draft, setDraft] = useState<CardDraft>(emptyDraft);
  const [draftStatus, setDraftStatus] = useState<Status>("todo");
  const [isNewCardOpen, setIsNewCardOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("board");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pointerDraggedId, setPointerDraggedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("project-board-theme", theme);
  }, [theme]);

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
    setIsNewCardOpen(false);
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
      className="min-h-screen bg-background text-foreground"
      onPointerUp={() => setPointerDraggedId(null)}
    >
      <div
        className={cn(
          "grid min-h-screen w-full transition-[grid-template-columns] duration-300 ease-in-out motion-reduce:transition-none",
          isSidebarCollapsed ? "lg:grid-cols-[88px_minmax(0,1fr)]" : "lg:grid-cols-[248px_minmax(0,1fr)]"
        )}
      >
        <aside
          className={cn(
            "hidden min-h-screen overflow-hidden border-r border-border bg-card py-6 transition-[padding] duration-300 ease-in-out motion-reduce:transition-none lg:flex lg:flex-col",
            isSidebarCollapsed ? "px-3" : "px-4"
          )}
        >
          <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "gap-3")}>
            {isSidebarCollapsed ? (
              <Button
                aria-label="Expand sidebar"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => setIsSidebarCollapsed(false)}
                size="icon"
                title="Expand sidebar"
                type="button"
                variant="ghost"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex w-full items-center justify-between gap-3">
                <p className="min-w-0 truncate text-base font-semibold leading-6 text-foreground">
                  Scryptic
                </p>
                <Button
                  aria-label="Collapse sidebar"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsSidebarCollapsed(true)}
                  size="icon"
                  title="Collapse sidebar"
                  type="button"
                  variant="ghost"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <nav className="mt-8 space-y-1">
            <Button
              aria-label="Project Board"
              className={cn("w-full", isSidebarCollapsed ? "justify-center px-0" : "justify-start")}
              onClick={() => setActiveView("board")}
              title={isSidebarCollapsed ? "Project Board" : undefined}
              type="button"
              variant={activeView === "board" ? "secondary" : "ghost"}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className={sidebarLabelClassName(isSidebarCollapsed)}>Project Board</span>
            </Button>
          </nav>

          <nav className="mt-auto space-y-1 pt-8">
            <Button
              aria-label="Settings"
              className={cn("w-full", isSidebarCollapsed ? "justify-center px-0" : "justify-start")}
              onClick={() => setActiveView("settings")}
              title={isSidebarCollapsed ? "Settings" : undefined}
              type="button"
              variant={activeView === "settings" ? "secondary" : "ghost"}
            >
              <Settings className="h-4 w-4" />
              <span className={sidebarLabelClassName(isSidebarCollapsed)}>Settings</span>
            </Button>
          </nav>

        </aside>

        <section className="flex min-w-0 flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="flex gap-2 lg:hidden">
            <Button
              className="flex-1"
              onClick={() => setActiveView("board")}
              type="button"
              variant={activeView === "board" ? "secondary" : "outline"}
            >
              <LayoutDashboard className="h-4 w-4" />
              Board
            </Button>
            <Button
              className="flex-1"
              onClick={() => setActiveView("settings")}
              type="button"
              variant={activeView === "settings" ? "secondary" : "outline"}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>

          {activeView === "board" ? (
            <>
          <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-teal-700">Project management</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                Project Board
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Prioritize launch work, review dependencies, and keep delivery moving across the team.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:min-w-[620px]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    className="pl-9"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, label, or description"
                  />
                </div>

                <Dialog open={isNewCardOpen} onOpenChange={setIsNewCardOpen}>
                  <DialogTrigger asChild>
                    <Button className="min-h-10 sm:min-w-36" type="button">
                      <Plus className="h-4 w-4" />
                      New card
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CirclePlus className="h-5 w-5 text-teal-700" />
                        New card
                      </DialogTitle>
                    </DialogHeader>

                    <form className="flex flex-col gap-4" onSubmit={handleCreateCard}>
                      <div className="space-y-2">
                        <Label htmlFor="card-title">Title</Label>
                        <Input
                          id="card-title"
                          value={draft.title}
                          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                          placeholder="Design pricing page"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="card-description">Description</Label>
                        <Textarea
                          id="card-description"
                          className="resize-y"
                          value={draft.description}
                          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                          placeholder="Add context, acceptance criteria, or next steps"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="card-labels">Labels</Label>
                        <Input
                          id="card-labels"
                          value={draft.labels}
                          onChange={(event) => setDraft({ ...draft, labels: event.target.value })}
                          placeholder="Design, Launch"
                        />
                      </div>

                      <StatusPicker value={draftStatus} onChange={setDraftStatus} />

                      <Button className="mt-1 min-h-10" disabled={saving} type="submit">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Add card
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Cards" value={cards.length.toString()} />
                <Metric label="Done" value={totalDone.toString()} />
              </div>
            </div>
          </header>

          <div className="flex flex-col gap-4">
            {notice && (
              <Card className="border-amber-200 bg-amber-50 text-amber-950">
                <CardContent className="p-3 text-sm">{notice}</CardContent>
              </Card>
            )}

            <section className="min-w-0 pb-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5 2xl:gap-4">
              {columns.map((column) => (
                <Card
                  key={column.id}
                  className={cn(
                    "min-w-0 transition",
                    (pointerDraggedId || draggedId) && "ring-2 ring-teal-100"
                  )}
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
                  <CardHeader className="flex-row items-center justify-between space-y-0 p-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
                      <CardTitle className="text-sm">
                        {column.title}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary">
                      {groupedCards[column.id].length}
                    </Badge>
                  </CardHeader>

                  <CardContent className="p-3 pt-0">
                  <div className="flex min-h-[560px] flex-col gap-3 rounded-xl bg-muted p-2">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading
                      </div>
                    ) : groupedCards[column.id].length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
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
                          className={`rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-slate-300 ${
                            pointerDraggedId === card.id || draggedId === card.id
                              ? "cursor-grabbing opacity-75"
                              : "cursor-grab"
                          }`}
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              <h3 className="text-sm font-semibold leading-5 text-foreground">
                                {card.title}
                              </h3>
                            </div>
                            <Button
                              aria-label={`Delete ${card.title}`}
                              className="text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                              onClick={() => deleteCard(card.id)}
                              onPointerDown={(event) => event.stopPropagation()}
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {card.description && (
                            <p className="mb-3 text-sm leading-5 text-muted-foreground">{card.description}</p>
                          )}

                          <div className="flex flex-wrap gap-1.5">
                            {card.labels.map((label) => (
                              <Badge
                                key={label}
                                className="font-medium"
                                variant="teal"
                              >
                                {label}
                              </Badge>
                            ))}
                          </div>

                          {card.status === "done" && (
                            <Badge className="mt-3 gap-1.5" variant="success">
                              <Check className="h-3.5 w-3.5" />
                              Complete
                            </Badge>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            </section>
          </div>
            </>
          ) : (
            <SettingsView
              onThemeChange={setTheme}
              theme={theme}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function sidebarLabelClassName(isCollapsed: boolean) {
  return cn(
    "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-in-out motion-reduce:transition-none",
    isCollapsed ? "max-w-0 -translate-x-1 opacity-0" : "max-w-32 translate-x-0 opacity-100"
  );
}

function SettingsView({
  onThemeChange,
  theme
}: {
  onThemeChange: (theme: Theme) => void;
  theme: Theme;
}) {
  return (
    <>
      <header className="border-b border-border pb-5">
        <p className="text-sm font-medium text-teal-700">Workspace preferences</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage the workspace appearance and layout defaults for your project board.
        </p>
      </header>

      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Theme</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Choose how the board should look on this device.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1">
                <Button
                  className={cn(theme === "light" && "bg-card shadow-sm hover:bg-card")}
                  onClick={() => onThemeChange("light")}
                  type="button"
                  variant={theme === "light" ? "outline" : "ghost"}
                >
                  <Sun className="h-4 w-4" />
                  Light
                </Button>
                <Button
                  className={cn(theme === "dark" && "bg-card shadow-sm hover:bg-card")}
                  onClick={() => onThemeChange("dark")}
                  type="button"
                  variant={theme === "dark" ? "outline" : "ghost"}
                >
                  <Moon className="h-4 w-4" />
                  Dark
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-xl px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </Card>
  );
}

function StatusPicker({
  value,
  onChange
}: {
  value: Status;
  onChange: (status: Status) => void;
}) {
  return (
    <div className="space-y-2">
      <Label id="card-status-label">Status</Label>
      <div
        aria-labelledby="card-status-label"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted p-1.5"
        role="radiogroup"
      >
        {columns.map((column) => {
          const selected = value === column.id;

          return (
            <Button
              aria-checked={selected}
              className={cn(
                "min-h-10 justify-start px-3",
                selected
                  ? "border-border bg-card text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground"
              )}
              key={column.id}
              onClick={() => onChange(column.id)}
              role="radio"
              type="button"
              variant={selected ? "outline" : "ghost"}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", column.accent)} />
              <span className="truncate">{column.title}</span>
              {selected && <Check className="ml-auto h-4 w-4 text-teal-700" />}
            </Button>
          );
        })}
      </div>
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
