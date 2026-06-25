"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  AlertCircle,
  Check,
  CirclePlus,
  FolderKanban,
  GripVertical,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cardsTable, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { BoardCard, CardDraft, Status } from "@/types/board";

const columns: Array<{ id: Status; title: string; accent: string }> = [
  { id: "backlog", title: "Backlog", accent: "bg-slate-500" },
  { id: "todo", title: "To do", accent: "bg-sky-500" },
  { id: "in_progress", title: "In progress", accent: "bg-amber-500" },
  { id: "review", title: "Review", accent: "bg-teal-600" },
  { id: "done", title: "Done", accent: "bg-emerald-500" }
];

const emptyDraft: CardDraft = {
  title: "",
  description: "",
  labels: ""
};

const emptyAuthForm = {
  email: "",
  password: "",
  newPassword: "",
  confirmPassword: ""
};

type AuthMode = "signup" | "login" | "forgot-password" | "update-password";
type AuthMessageTone = "success" | "warning" | "error";
type ActiveView = "board" | "settings";
type AuthRedirectState = {
  message?: string;
  mode: Extract<AuthMode, "forgot-password" | "update-password">;
  tone?: AuthMessageTone;
};
type PasswordStrength = {
  checks: Array<{ label: string; met: boolean }>;
  isStrong: boolean;
  label: string;
  score: number;
};

export default function ProjectBoard() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [draft, setDraft] = useState<CardDraft>(emptyDraft);
  const [draftStatus, setDraftStatus] = useState<Status>("todo");
  const [isNewCardOpen, setIsNewCardOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("board");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pointerDraggedId, setPointerDraggedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [authRedirectMessage, setAuthRedirectMessage] = useState<string | null>(null);
  const [authRedirectTone, setAuthRedirectTone] = useState<AuthMessageTone>("warning");

  useEffect(() => {
    const redirectState = getAuthRedirectState();

    if (!redirectState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAuthMode(redirectState.mode);
      setAuthRedirectMessage(redirectState.message ?? null);
      setAuthRedirectTone(redirectState.tone ?? "warning");

      if (redirectState.mode === "forgot-password") {
        clearAuthRedirectUrl();
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const supabaseClient = supabase;
    const redirectState = getAuthRedirectState();
    let ignore = false;

    async function loadSession() {
      if (redirectState?.mode === "update-password") {
        const code = getAuthCallbackCode();

        if (code) {
          const { error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);

          if (exchangeError && !ignore) {
            setAuthMode("forgot-password");
            setAuthRedirectMessage("That password reset link is no longer valid. Send yourself a fresh link to continue.");
            setAuthRedirectTone("error");
            clearAuthRedirectUrl();
            setAuthLoading(false);
            return;
          }
        }
      }

      if (ignore) {
        return;
      }

      const { data, error } = await supabaseClient.auth.getSession();

      if (ignore) {
        return;
      }

      if (error) {
        setNotice(`Session could not be loaded: ${error.message}`);
      } else {
        setSession(data.session);
        if (redirectState?.mode === "update-password") {
          setAuthMode(data.session ? "update-password" : "forgot-password");
          if (!data.session) {
            setAuthRedirectMessage("That password reset link is no longer valid. Send yourself a fresh link to continue.");
            setAuthRedirectTone("error");
          }
          clearAuthRedirectUrl();
        } else if (redirectState?.mode === "forgot-password") {
          setAuthMode("forgot-password");
          setAuthRedirectMessage(redirectState.message ?? null);
          setAuthRedirectTone(redirectState.tone ?? "warning");
          clearAuthRedirectUrl();
        }
      }

      setAuthLoading(false);
    }

    loadSession();

    const {
      data: { subscription }
    } = supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("update-password");
        setAuthRedirectMessage("Choose a new password to finish resetting your account.");
        setAuthRedirectTone("warning");
        clearAuthRedirectUrl();
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadCards() {
      if (!supabase || !session?.user || authMode === "update-password") {
        setCards([]);
        setLoading(false);
        return;
      }

      const supabaseClient = supabase;
      setLoading(true);
      const { data, error } = await supabaseClient
        .from(cardsTable)
        .select("*")
        .eq("user_id", session.user.id)
        .order("status", { ascending: true })
        .order("position", { ascending: true });

      if (ignore) {
        return;
      }

      if (error) {
        setNotice(`Cards could not be loaded: ${error.message}`);
      } else {
        setCards((data ?? []) as BoardCard[]);
      }

      setLoading(false);
    }

    loadCards();

    return () => {
      ignore = true;
    };
  }, [authMode, session]);

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
    if (!supabase || !session?.user) {
      return;
    }

    const rows = nextCards.map((card) => ({
      id: card.id,
      user_id: session.user.id,
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

    if (!title || !session?.user) {
      return;
    }

    setSaving(true);

    const nextCard: BoardCard = {
      id: crypto.randomUUID(),
      user_id: session.user.id,
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

    if (supabase && session?.user) {
      const { error } = await supabase
        .from(cardsTable)
        .delete()
        .eq("id", cardId)
        .eq("user_id", session.user.id);
      if (error) {
        setNotice(`The card was removed locally, but Supabase could not delete it: ${error.message}`);
      }
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    setAuthLoading(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setNotice(`Sign out failed: ${error.message}`);
    } else {
      setCards([]);
      setNotice(null);
      setAuthMode("login");
    }

    setAuthLoading(false);
  }

  const totalDone = cards.filter((card) => card.status === "done").length;

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-950">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
          Loading workspace
        </div>
      </main>
    );
  }

  if (!session || authMode === "forgot-password" || authMode === "update-password") {
    return (
      <AuthPanel
        key={`${authMode}-${authRedirectMessage ?? ""}`}
        initialMessage={authRedirectMessage}
        initialMessageTone={authRedirectTone}
        initialMode={authMode}
        onAuthModeChange={setAuthMode}
      />
    );
  }

  return (
    <main
      className="min-h-screen bg-slate-50 text-slate-950"
      onPointerUp={() => setPointerDraggedId(null)}
    >
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "hidden shrink-0 overflow-hidden border-r border-slate-200 bg-white py-5 transition-[width,padding] duration-300 ease-in-out motion-reduce:transition-none lg:flex lg:flex-col",
            isSidebarCollapsed ? "w-20 px-3" : "w-64 px-4"
          )}
        >
          <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center" : "gap-2 px-2")}>
            {isSidebarCollapsed ? (
              <Button
                aria-label="Expand sidebar"
                className="h-9 w-9 text-slate-500 hover:text-slate-950"
                onClick={() => setIsSidebarCollapsed(false)}
                size="icon"
                title="Expand sidebar"
                type="button"
                variant="ghost"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-in-out motion-reduce:transition-none">
                  <p className="truncate text-sm font-semibold text-slate-950">Project Board</p>
                  <p className="truncate text-xs text-slate-500">{getUserDisplayName(session.user)}</p>
                </div>
                <Button
                  aria-label="Collapse sidebar"
                  className="h-9 w-9 shrink-0 text-slate-500 hover:text-slate-950"
                  onClick={() => setIsSidebarCollapsed(true)}
                  size="icon"
                  title="Collapse sidebar"
                  type="button"
                  variant="ghost"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          <nav className="mt-8 space-y-1">
            <SidebarItem
              active={activeView === "board"}
              collapsed={isSidebarCollapsed}
              icon={<FolderKanban className="h-4 w-4" />}
              label="Projects"
              onClick={() => setActiveView("board")}
            />
          </nav>

          <div className="mt-auto space-y-3 border-t border-slate-200 pt-4">
            <SidebarItem
              active={activeView === "settings"}
              collapsed={isSidebarCollapsed}
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
              onClick={() => setActiveView("settings")}
            />
            <div
              className={cn(
                "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-[max-height,opacity,transform] duration-200 ease-in-out motion-reduce:transition-none",
                isSidebarCollapsed
                  ? "max-h-0 -translate-y-1 overflow-hidden border-transparent px-0 py-0 opacity-0"
                  : "max-h-24 translate-y-0 opacity-100"
              )}
              aria-hidden={isSidebarCollapsed}
            >
              <p className="truncate text-sm font-medium text-slate-900">{getUserDisplayName(session.user)}</p>
              <p className="truncate text-xs text-slate-500">{session.user.email}</p>
            </div>
            <Button
              aria-label="Log out"
              className={cn(
                "w-full text-slate-600",
                isSidebarCollapsed ? "justify-center px-0" : "justify-start"
              )}
              disabled={authLoading}
              onClick={handleSignOut}
              title={isSidebarCollapsed ? "Log out" : undefined}
              type="button"
              variant="ghost"
            >
              {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span className={sidebarLabelClassName(isSidebarCollapsed)}>Log out</span>
            </Button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            <Button
              onClick={() => setActiveView("board")}
              type="button"
              variant={activeView === "board" ? "secondary" : "outline"}
            >
              <FolderKanban className="h-4 w-4" />
              Board
            </Button>
            <Button
              onClick={() => setActiveView("settings")}
              type="button"
              variant={activeView === "settings" ? "secondary" : "outline"}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>

          {activeView === "settings" ? (
            <SettingsView
              cardsCount={cards.length}
              doneCount={totalDone}
              email={session.user.email ?? ""}
              onSignOut={handleSignOut}
              signOutLoading={authLoading}
              userName={getUserDisplayName(session.user)}
            />
          ) : (
            <>
              <header className="mx-auto grid w-full max-w-[1200px] gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[minmax(220px,0.85fr)_minmax(360px,1fr)_minmax(300px,0.7fr)] lg:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
                    Project management
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                    Project Board
                  </h1>
                  <p className="mt-2 truncate text-sm text-slate-500">
                    {getUserDisplayName(session.user)} · {session.user.email}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex min-h-[70px] flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-teal-500">
                        <Search className="h-4 w-4 text-slate-500" />
                        <input
                          id="search"
                          className="w-full border-0 bg-transparent text-sm outline-none"
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Title, label, or description"
                          value={query}
                        />
                      </div>
                    </div>

                    <Dialog open={isNewCardOpen} onOpenChange={setIsNewCardOpen}>
                      <DialogTrigger asChild>
                        <Button className="min-h-11 sm:min-w-36" type="button">
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

                        <form className="flex flex-col gap-3" onSubmit={handleCreateCard}>
                          <Label htmlFor="card-title">Title</Label>
                          <Input
                            id="card-title"
                            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                            placeholder="Design pricing page"
                            value={draft.title}
                          />

                          <Label htmlFor="card-description">Description</Label>
                          <Textarea
                            id="card-description"
                            className="resize-y"
                            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                            placeholder="Add context, acceptance criteria, or next steps"
                            value={draft.description}
                          />

                          <Label htmlFor="card-labels">Labels</Label>
                          <Input
                            id="card-labels"
                            onChange={(event) => setDraft({ ...draft, labels: event.target.value })}
                            placeholder="Design, Launch"
                            value={draft.labels}
                          />

                          <StatusPicker value={draftStatus} onChange={setDraftStatus} />

                          <Button className="mt-1 min-h-11" disabled={saving} type="submit">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Add card
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Button
                      aria-label="Sign out"
                      className="min-h-11 sm:w-11 lg:hidden"
                      disabled={authLoading}
                      onClick={handleSignOut}
                      size="icon"
                      type="button"
                      variant="secondary"
                    >
                      {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Cards" value={cards.length.toString()} />
                  <Metric label="Done" value={totalDone.toString()} />
                </div>
              </header>

              <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
                {notice && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {notice}
                  </p>
                )}

                <section className="pb-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    {columns.map((column) => (
                      <div
                        key={column.id}
                        className={`min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition ${
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
                          <Badge variant="secondary">{groupedCards[column.id].length}</Badge>
                        </div>

                        <div className="flex min-h-[520px] flex-col gap-3 rounded-md bg-slate-50 p-2">
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
                                className={`rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
                                  pointerDraggedId === card.id || draggedId === card.id
                                    ? "cursor-grabbing opacity-75"
                                    : "cursor-grab"
                                }`}
                                onDragEnd={() => {
                                  setDraggedId(null);
                                  setPointerDraggedId(null);
                                }}
                                onDragStart={() => {
                                  setDraggedId(card.id);
                                  setPointerDraggedId(card.id);
                                }}
                                onPointerDown={(event) => {
                                  if ((event.target as HTMLElement).closest("button")) {
                                    return;
                                  }

                                  setPointerDraggedId(card.id);
                                }}
                              >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                    <h3 className="text-sm font-semibold leading-5 text-slate-950">{card.title}</h3>
                                  </div>
                                  <Button
                                    aria-label={`Delete ${card.title}`}
                                    className="text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
                                  <p className="mb-3 text-sm leading-5 text-slate-600">{card.description}</p>
                                )}

                                <div className="flex flex-wrap gap-1.5">
                                  {card.labels.map((label) => (
                                    <Badge key={label} className="font-medium" variant="teal">
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
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function SidebarItem({
  active = false,
  collapsed = false,
  icon,
  label,
  onClick
}: {
  active?: boolean;
  collapsed?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
        collapsed && "justify-center px-0",
        active ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      )}
      onClick={onClick}
      title={collapsed ? label : undefined}
      type="button"
    >
      {icon}
      <span className={sidebarLabelClassName(collapsed)}>{label}</span>
    </button>
  );
}

function sidebarLabelClassName(isCollapsed: boolean) {
  return cn(
    "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-in-out motion-reduce:transition-none",
    isCollapsed ? "max-w-0 -translate-x-1 opacity-0" : "max-w-32 translate-x-0 opacity-100"
  );
}

function SettingsView({
  cardsCount,
  doneCount,
  email,
  onSignOut,
  signOutLoading,
  userName
}: {
  cardsCount: number;
  doneCount: number;
  email: string;
  onSignOut: () => void;
  signOutLoading: boolean;
  userName: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Workspace preferences
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Manage your account and workspace overview.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-950">Account</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Signed in as {userName}.
                </p>
                {email && <p className="mt-1 truncate text-sm text-slate-600">{email}</p>}
              </div>
              <Button
                className="sm:min-w-32"
                disabled={signOutLoading}
                onClick={onSignOut}
                type="button"
                variant="outline"
              >
                {signOutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Log out
              </Button>
            </div>
          </Card>

          <Card className="p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Workspace</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Your board data is scoped to this signed-in user.
            </p>
          </Card>
        </div>

        <Card className="p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Board summary</h2>
          <div className="mt-4 grid gap-3">
            <Metric label="Cards" value={cardsCount.toString()} />
            <Metric label="Done" value={doneCount.toString()} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function AuthPanel({
  initialMessage,
  initialMessageTone,
  initialMode,
  onAuthModeChange
}: {
  initialMessage: string | null;
  initialMessageTone: AuthMessageTone;
  initialMode: AuthMode;
  onAuthModeChange: (mode: AuthMode) => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [form, setForm] = useState(emptyAuthForm);
  const [pendingEmail, setPendingEmail] = useState("");
  const [accountExistsEmail, setAccountExistsEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    initialMessage ??
      (initialMode === "update-password" ? "Choose a new password to finish resetting your account." : null)
  );
  const [messageTone, setMessageTone] = useState<AuthMessageTone>(initialMessageTone);
  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const newPasswordStrength = useMemo(() => getPasswordStrength(form.newPassword), [form.newPassword]);
  const isAwaitingConfirmation = pendingEmail.length > 0;
  const isExistingAccount = accountExistsEmail.length > 0;
  const isRequestingReset = mode === "forgot-password";
  const isUpdatingPassword = mode === "update-password";

  function switchAuthMode(nextMode: AuthMode) {
    setMode(nextMode);
    onAuthModeChange(nextMode);
    setPendingEmail("");
    setAccountExistsEmail("");
    setMessage(null);
  }

  function showAuthMessage(nextMessage: string, tone: AuthMessageTone = "warning") {
    setMessageTone(tone);
    setMessage(nextMessage);
  }

  function updateAuthForm(nextForm: typeof emptyAuthForm) {
    setForm(nextForm);
    setAccountExistsEmail("");
    setMessage(null);
  }

  function showExistingAccount(email: string) {
    setPendingEmail("");
    setAccountExistsEmail(email);
    setMessage(null);
  }

  async function handlePasswordAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      showAuthMessage("Add Supabase environment variables before signing in.");
      return;
    }

    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!isValidEmail(email) || password.length < 6) {
      showAuthMessage("Enter a valid email address and a password of at least 6 characters.");
      return;
    }

    if (mode === "signup" && !passwordStrength.isStrong) {
      showAuthMessage("Choose a stronger password before creating your account.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin
            }
          })
        : await supabase.auth.signInWithPassword({
            email,
            password
          });

    setLoading(false);

    if (result.error) {
      if (mode === "signup" && isAlreadyRegisteredError(result.error.message)) {
        showExistingAccount(email);
        return;
      }

      showAuthMessage(result.error.message, "error");
      return;
    }

    if (mode === "signup") {
      if (isDuplicateSignupResponse(result.data.user, result.data.session)) {
        showExistingAccount(email);
        return;
      }

      setPendingEmail(email);
      showAuthMessage(
        result.data.session
          ? "Account created. Email confirmations appear to be disabled in Supabase, so you are already signed in."
          : "We sent a confirmation email. Open the link in that email to finish creating your account.",
        "success"
      );
    }
  }

  async function handlePasswordResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      showAuthMessage("Add Supabase environment variables before resetting your password.");
      return;
    }

    const email = form.email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      showAuthMessage("Enter the email address for your account.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl("update-password")
    });

    setLoading(false);

    if (error) {
      showAuthMessage(error.message, "error");
      return;
    }

    showAuthMessage("Check your email for a password reset link. It will bring you back here.", "success");
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      showAuthMessage("Add Supabase environment variables before updating your password.");
      return;
    }

    if (!newPasswordStrength.isStrong) {
      showAuthMessage("Choose a stronger password before updating your account.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      showAuthMessage("The new passwords do not match.", "error");
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({ password: form.newPassword });

    setLoading(false);

    if (error) {
      showAuthMessage(error.message, "error");
      return;
    }

    setForm(emptyAuthForm);
    showAuthMessage("Password updated. You can keep working on the board.", "success");
    switchAuthMode("login");
  }

  async function handleResendConfirmationEmail() {
    if (!supabase) {
      showAuthMessage("Add Supabase environment variables before resending confirmation email.");
      return;
    }

    const email = pendingEmail || form.email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      showAuthMessage("Enter a valid email address before resending confirmation.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resend({
      email,
      type: "signup",
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    setLoading(false);

    if (error) {
      showAuthMessage(error.message, "error");
      return;
    }

    showAuthMessage("Confirmation email sent again. Check your inbox and spam folder.", "success");
  }

  async function handleGoogleSignIn() {
    if (!supabase) {
      showAuthMessage("Add Supabase environment variables before signing in.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      showAuthMessage(error.message, "error");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <Card className="w-full max-w-md p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
            {isRequestingReset ? (
              <Mail className="h-5 w-5" />
            ) : isUpdatingPassword ? (
              <KeyRound className="h-5 w-5" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-normal text-slate-950">Project Board</h1>
            <p className="text-sm text-slate-500">{getAuthSubtitle(mode)}</p>
          </div>
        </div>

        {isExistingAccount && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="min-w-0">
                <p className="font-semibold text-amber-950">Account already exists</p>
                <p className="mt-1 text-amber-900">
                  An account with <span className="font-medium text-amber-950">{accountExistsEmail}</span>{" "}
                  already exists. Sign in with this email instead.
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                onClick={() => {
                  setMode("login");
                  onAuthModeChange("login");
                  setAccountExistsEmail("");
                  setMessage(null);
                }}
                type="button"
                variant="outline"
              >
                Sign in instead
              </Button>
              <Button
                className="text-amber-950 hover:bg-amber-100"
                onClick={() => {
                  updateAuthForm({ ...form, email: "" });
                  switchAuthMode("signup");
                }}
                type="button"
                variant="ghost"
              >
                Use a different email
              </Button>
            </div>
          </div>
        )}

        {isAwaitingConfirmation ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Confirmation email sent to{" "}
              <span className="font-medium text-slate-900">{pendingEmail || form.email}</span>
            </div>

            <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-3 text-sm text-teal-900">
              Open the confirmation link from Supabase to activate your account. Once confirmed,
              you can return here and sign in with your email and password.
            </div>

            <Button
              className="w-full"
              disabled={loading || !isSupabaseConfigured}
              onClick={handleResendConfirmationEmail}
              type="button"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Resend confirmation email
            </Button>

            <Button
              className="w-full"
              disabled={loading}
              onClick={() => {
                setPendingEmail("");
                setMessage(null);
              }}
              type="button"
              variant="ghost"
            >
              Edit email or password
            </Button>
          </div>
        ) : isUpdatingPassword ? (
          <form className="space-y-3" onSubmit={handlePasswordUpdate}>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                autoComplete="new-password"
                disabled={!isSupabaseConfigured}
                id="new-password"
                minLength={8}
                onChange={(event) => updateAuthForm({ ...form, newPassword: event.target.value })}
                placeholder="New password"
                type="password"
                value={form.newPassword}
              />
            </div>

            <PasswordStrengthMeter strength={newPasswordStrength} />

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                autoComplete="new-password"
                disabled={!isSupabaseConfigured}
                id="confirm-password"
                minLength={8}
                onChange={(event) => updateAuthForm({ ...form, confirmPassword: event.target.value })}
                placeholder="Confirm password"
                type="password"
                value={form.confirmPassword}
              />
            </div>

            <Button className="w-full" disabled={loading || !isSupabaseConfigured} type="submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Update password
            </Button>
          </form>
        ) : isRequestingReset ? (
          <form className="space-y-3" onSubmit={handlePasswordResetRequest}>
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                autoCapitalize="none"
                autoComplete="email"
                disabled={!isSupabaseConfigured}
                id="reset-email"
                onChange={(event) => updateAuthForm({ ...form, email: event.target.value })}
                placeholder="you@company.com"
                type="email"
                value={form.email}
              />
            </div>

            <Button className="w-full" disabled={loading || !isSupabaseConfigured} type="submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send reset link
            </Button>

            <Button
              className="w-full"
              disabled={loading}
              onClick={() => switchAuthMode("login")}
              type="button"
              variant="ghost"
            >
              Back to sign in
            </Button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={handlePasswordAuth}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                autoCapitalize="none"
                autoComplete="email"
                disabled={!isSupabaseConfigured}
                id="email"
                onChange={(event) => updateAuthForm({ ...form, email: event.target.value })}
                placeholder="you@company.com"
                type="email"
                value={form.email}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && (
                  <button
                    className="text-sm font-medium text-teal-700 hover:text-teal-900"
                    onClick={() => switchAuthMode("forgot-password")}
                    type="button"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                disabled={!isSupabaseConfigured}
                id="password"
                onChange={(event) => updateAuthForm({ ...form, password: event.target.value })}
                placeholder="Password"
                type="password"
                value={form.password}
              />
            </div>

            {mode === "signup" && <PasswordStrengthMeter strength={passwordStrength} />}

            <Button className="w-full" disabled={loading || !isSupabaseConfigured} type="submit">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
        )}

        {!isAwaitingConfirmation && !isUpdatingPassword && !isRequestingReset && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <Button
              className="w-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              disabled={!isSupabaseConfigured}
              onClick={handleGoogleSignIn}
              type="button"
              variant="secondary"
            >
              <GoogleLogo className="h-4 w-4" />
              Continue with Google
            </Button>

            <p className="mt-5 border-t border-slate-200 pt-4 text-center text-sm text-slate-600">
              {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                className="font-medium text-slate-950 underline-offset-4 hover:underline"
                onClick={() => switchAuthMode(mode === "signup" ? "login" : "signup")}
                type="button"
              >
                {mode === "signup" ? "Sign in" : "Create an account"}
              </button>
            </p>
          </>
        )}

        {message && (
          <p
            className={cn(
              "mt-4 rounded-md border px-3 py-2 text-sm",
              messageTone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : messageTone === "success"
                  ? "border-teal-200 bg-teal-50 text-teal-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
            )}
          >
            {message}
          </p>
        )}

        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable auth.
          </p>
        )}
      </Card>
    </main>
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
        className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted p-1.5"
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

function PasswordStrengthMeter({ strength }: { strength: PasswordStrength }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">Password strength</p>
        <p className="text-sm text-slate-500">{strength.label}</p>
      </div>
      <div className="mb-3 grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            className={cn(
              "h-1.5 rounded-full",
              index < strength.score ? "bg-teal-600" : "bg-slate-200"
            )}
            key={index}
          />
        ))}
      </div>
      <div className="grid gap-1.5">
        {strength.checks.map((check) => (
          <div className="flex items-center gap-2 text-xs text-slate-600" key={check.label}>
            <Check className={cn("h-3.5 w-3.5", check.met ? "text-teal-700" : "text-slate-300")} />
            {check.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.02h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.31 2.98-7.42z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.62-2.35l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A9.99 9.99 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.41 13.97a6.01 6.01 0 0 1 0-3.94V7.44H3.07a9.99 9.99 0 0 0 0 9.12l3.34-2.59z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.91c1.47 0 2.79.5 3.83 1.5l2.86-2.86C16.96 2.94 14.7 2 12 2a9.99 9.99 0 0 0-8.93 5.44l3.34 2.59C7.2 7.67 9.4 5.91 12 5.91z"
        fill="#EA4335"
      />
    </svg>
  );
}

function normalizePositions(cards: BoardCard[]) {
  return columns.flatMap((column) =>
    cards
      .filter((card) => card.status === column.id)
      .map((card, position) => ({ ...card, position }))
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAuthRedirectUrl(mode: "update-password") {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  url.searchParams.set("auth", mode);
  url.hash = "";
  return url.toString();
}

function getAuthRedirectState(): AuthRedirectState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const errorCode = url.searchParams.get("error_code") ?? hashParams.get("error_code");
  const errorDescription =
    url.searchParams.get("error_description") ?? hashParams.get("error_description");

  if (errorCode || errorDescription) {
    const isExpiredOtp = errorCode === "otp_expired";

    return {
      mode: "forgot-password",
      message: isExpiredOtp
        ? "That password reset link has expired or was already used. Send yourself a fresh link to continue."
        : errorDescription ?? "That auth link is no longer valid. Send yourself a fresh password reset link.",
      tone: "error"
    };
  }

  if (url.searchParams.get("auth") === "update-password") {
    return {
      mode: "update-password"
    };
  }

  if (hashParams.get("type") === "recovery") {
    return {
      mode: "update-password"
    };
  }

  return null;
}

function getAuthCallbackCode() {
  if (typeof window === "undefined") {
    return null;
  }

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

  return url.searchParams.get("code") ?? hashParams.get("code");
}

function clearAuthRedirectUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("auth");
  url.hash = "";
  window.history.replaceState({}, document.title, url.toString());
}

function isAlreadyRegisteredError(message: string) {
  return /user already registered|already.*account|already.*registered/i.test(message);
}

function isDuplicateSignupResponse(user: User | null, session: Session | null) {
  return Boolean(user && !session && Array.isArray(user.identities) && user.identities.length === 0);
}

function getPasswordStrength(password: string): PasswordStrength {
  const checks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Upper and lowercase letters", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "At least one number", met: /\d/.test(password) },
    { label: "At least one symbol", met: /[^A-Za-z0-9]/.test(password) }
  ];
  const score = checks.filter((check) => check.met).length + (password.length >= 12 ? 1 : 0);
  const normalizedScore = Math.min(score, 5);

  return {
    checks,
    isStrong: checks.every((check) => check.met),
    label: ["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent"][normalizedScore],
    score: normalizedScore
  };
}

function getAuthSubtitle(mode: AuthMode) {
  if (mode === "forgot-password") {
    return "Enter your email and we will send a reset link.";
  }

  if (mode === "update-password") {
    return "Set a new password for your account.";
  }

  return mode === "signup"
    ? "Create an account to manage your own cards."
    : "Sign in to manage your own cards.";
}

function getUserDisplayName(user: User) {
  return (
    (typeof user.user_metadata.username === "string" && user.user_metadata.username) ||
    (typeof user.user_metadata.name === "string" && user.user_metadata.name) ||
    user.email?.split("@")[0] ||
    "Workspace"
  );
}
