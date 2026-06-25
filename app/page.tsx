"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Check,
  CirclePlus,
  GripVertical,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Plus,
  Search,
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

type AuthMode = "sign-in" | "forgot-password" | "update-password";

export default function ProjectBoard() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [draft, setDraft] = useState<CardDraft>(emptyDraft);
  const [draftStatus, setDraftStatus] = useState<Status>("todo");
  const [isNewCardOpen, setIsNewCardOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pointerDraggedId, setPointerDraggedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const supabaseClient = supabase;
    let ignore = false;

    async function loadSession() {
      const { data, error } = await supabaseClient.auth.getSession();

      if (ignore) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      } else {
        setSession(data.session);
      }

      setAuthLoading(false);
    }

    loadSession();

    const {
      data: { subscription }
    } = supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("update-password");
        setAuthMessage("Choose a new password to finish resetting your account.");
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setAuthLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadCards() {
      if (!supabase || !session?.user) {
        setCards([]);
        setLoading(false);
        return;
      }

      if (!session) {
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
  }, [session]);

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

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setAuthError("Supabase is not configured for authentication.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthPassword("");
    }

    setAuthLoading(false);
  }

  async function handlePasswordResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setAuthError("Supabase is not configured for authentication.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    const redirectTo =
      typeof window === "undefined" ? undefined : `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
      redirectTo
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthMessage("Check your email for a reset link. It will bring you back here.");
    }

    setAuthLoading(false);
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setAuthError("Supabase is not configured for authentication.");
      return;
    }

    if (newPassword.length < 8) {
      setAuthError("Use at least 8 characters for the new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setAuthError("The new passwords do not match.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setAuthError(error.message);
    } else {
      setNewPassword("");
      setConfirmPassword("");
      setAuthMessage("Password updated. You can keep working on the board.");
      setAuthMode("sign-in");
    }

    setAuthLoading(false);
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    setAuthLoading(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthPassword("");
      setAuthMode("sign-in");
    }

    setAuthLoading(false);
  }

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

    if (supabase) {
      const { error } = await supabase.from(cardsTable).delete().eq("id", cardId);
      if (error) {
        setNotice(`The card was removed locally, but Supabase could not delete it: ${error.message}`);
      }
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setCards([]);
    setNotice(null);
  }

  const totalDone = cards.filter((card) => card.status === "done").length;
  const shouldShowAuth = Boolean(supabase && (!session || authMode === "update-password"));

  if (shouldShowAuth) {
    return (
      <AuthPanel
        authEmail={authEmail}
        authError={authError}
        authLoading={authLoading}
        authMessage={authMessage}
        authMode={authMode}
        authPassword={authPassword}
        confirmPassword={confirmPassword}
        newPassword={newPassword}
        onEmailChange={setAuthEmail}
        onForgotPassword={handlePasswordResetRequest}
        onModeChange={(mode) => {
          setAuthError(null);
          setAuthMessage(null);
          setAuthMode(mode);
        }}
        onNewPasswordChange={setNewPassword}
        onPasswordChange={setAuthPassword}
        onPasswordConfirmChange={setConfirmPassword}
        onPasswordUpdate={handlePasswordUpdate}
        onSignIn={handleSignIn}
      />
    );
  }

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

  if (!session) {
    return <AuthPanel />;
  }

  return (
    <main
      className="min-h-screen bg-slate-50 text-slate-950"
      onPointerUp={() => setPointerDraggedId(null)}
    >
      <section className="mx-auto flex max-w-[1520px] flex-col gap-5">
        <header className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[minmax(220px,0.85fr)_minmax(360px,1fr)_minmax(300px,0.7fr)] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Project management
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              Project Board
            </h1>
            {session?.user.email && (
              <p className="mt-2 truncate text-sm text-slate-500">{session.user.email}</p>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <header className="mx-auto grid w-full max-w-[1200px] gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[minmax(220px,0.85fr)_minmax(360px,1fr)_minmax(300px,0.7fr)] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
                Project management
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                Project Board
              </h1>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex min-h-[70px] flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-teal-500">
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
                        value={draft.title}
                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                        placeholder="Design pricing page"
                      />

                      <Label htmlFor="card-description">Description</Label>
                      <Textarea
                        id="card-description"
                        className="resize-y"
                        value={draft.description}
                        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                        placeholder="Add context, acceptance criteria, or next steps"
                      />

                      <Label htmlFor="card-labels">Labels</Label>
                      <Input
                        id="card-labels"
                        value={draft.labels}
                        onChange={(event) => setDraft({ ...draft, labels: event.target.value })}
                        placeholder="Design, Launch"
                      />

                    <Button className="mt-1 min-h-11" disabled={saving} type="submit">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Add card
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              {supabase && session && (
                <Button
                  aria-label="Sign out"
                  className="min-h-11 sm:w-11"
                  disabled={authLoading}
                  onClick={handleSignOut}
                  size="icon"
                  type="button"
                  variant="secondary"
                >
                  {authLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Cards" value={cards.length.toString()} />
              <Metric label="Done" value={totalDone.toString()} />
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm lg:hidden">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{getUserDisplayName(session.user)}</p>
                <p className="truncate text-xs text-slate-500">{session.user.email}</p>
              </div>
              <Button onClick={handleSignOut} size="sm" type="button" variant="ghost">
                <LogOut className="h-4 w-4" />
                Log out
              </Button>
            </div>

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
                      <Badge variant="secondary">
                        {groupedCards[column.id].length}
                      </Badge>
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
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [form, setForm] = useState(emptyAuthForm);
  const [pendingEmail, setPendingEmail] = useState("");
  const [accountExistsEmail, setAccountExistsEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<AuthMessageTone>("warning");
  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const isAwaitingConfirmation = pendingEmail.length > 0;
  const isExistingAccount = accountExistsEmail.length > 0;

  function switchAuthMode(nextMode: AuthMode) {
    setMode(nextMode);
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

      applyLightThemePreference();
      setPendingEmail(email);
      showAuthMessage(
        result.data.session
          ? "Account created. Email confirmations appear to be disabled in Supabase, so you are already signed in."
          : "We sent a confirmation email. Open the link in that email to finish creating your account."
      );
    }
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

    showAuthMessage("Confirmation email sent again. Check your inbox and spam folder.");
  }

  async function handleGoogleSignIn() {
    if (!supabase) {
      showAuthMessage("Add Supabase environment variables before signing in.");
      return;
    }

    applyLightThemePreference();

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
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-normal text-slate-950">Project Board</h1>
            <p className="text-sm text-slate-500">
              {mode === "signup" ? "Create an account to manage your own cards." : "Sign in to manage your own cards."}
            </p>
          </div>
        </div>

        {isExistingAccount && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="min-w-0">
                <p className="font-semibold text-amber-950">Account already exists</p>
                <p className="mt-1 text-amber-900">
                  An account with{" "}
                  <span className="font-medium text-amber-950">{accountExistsEmail}</span>{" "}
                  already exists. Sign in with this email instead.
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                onClick={() => {
                  setMode("login");
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
                  setMode("signup");
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
              <Label htmlFor="password">Password</Label>
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

        {!isAwaitingConfirmation && (
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

function AuthPanel({
  authEmail,
  authError,
  authLoading,
  authMessage,
  authMode,
  authPassword,
  confirmPassword,
  newPassword,
  onEmailChange,
  onForgotPassword,
  onModeChange,
  onNewPasswordChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onPasswordUpdate,
  onSignIn
}: {
  authEmail: string;
  authError: string | null;
  authLoading: boolean;
  authMessage: string | null;
  authMode: AuthMode;
  authPassword: string;
  confirmPassword: string;
  newPassword: string;
  onEmailChange: (value: string) => void;
  onForgotPassword: (event: FormEvent<HTMLFormElement>) => void;
  onModeChange: (mode: AuthMode) => void;
  onNewPasswordChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onPasswordUpdate: (event: FormEvent<HTMLFormElement>) => void;
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isUpdatingPassword = authMode === "update-password";
  const isRequestingReset = authMode === "forgot-password";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
            {isUpdatingPassword ? <ShieldCheck className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
              Project Board
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
              {isUpdatingPassword
                ? "Set a new password"
                : isRequestingReset
                  ? "Reset your password"
                  : "Sign in"}
            </h1>
            <p className="mt-2 text-sm leading-5 text-slate-600">
              {isUpdatingPassword
                ? "Enter a new password for your account."
                : isRequestingReset
                  ? "We will email you a secure link to continue."
                  : "Use your workspace account to open the board."}
            </p>
          </div>
        </div>

        {authError && (
          <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {authError}
          </p>
        )}

        {authMessage && (
          <p className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
            {authMessage}
          </p>
        )}

        {isUpdatingPassword ? (
          <form className="grid gap-3" onSubmit={onPasswordUpdate}>
            <Label htmlFor="new-password">New password</Label>
            <Input
              autoComplete="new-password"
              id="new-password"
              minLength={8}
              onChange={(event) => onNewPasswordChange(event.target.value)}
              required
              type="password"
              value={newPassword}
            />

            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              autoComplete="new-password"
              id="confirm-password"
              minLength={8}
              onChange={(event) => onPasswordConfirmChange(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />

            <Button className="mt-2 min-h-11" disabled={authLoading} type="submit">
              {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Update password
            </Button>
          </form>
        ) : (
          <form className="grid gap-3" onSubmit={isRequestingReset ? onForgotPassword : onSignIn}>
            <Label htmlFor="auth-email">Email</Label>
            <Input
              autoComplete="email"
              id="auth-email"
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={authEmail}
            />

            {!isRequestingReset && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="auth-password">Password</Label>
                  <button
                    className="text-sm font-medium text-teal-700 hover:text-teal-900"
                    onClick={() => onModeChange("forgot-password")}
                    type="button"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  autoComplete="current-password"
                  id="auth-password"
                  onChange={(event) => onPasswordChange(event.target.value)}
                  required
                  type="password"
                  value={authPassword}
                />
              </>
            )}

            <Button className="mt-2 min-h-11" disabled={authLoading} type="submit">
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRequestingReset ? (
                <Mail className="h-4 w-4" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {isRequestingReset ? "Send reset link" : "Sign in"}
            </Button>

            {isRequestingReset && (
              <Button
                className="min-h-11"
                onClick={() => onModeChange("sign-in")}
                type="button"
                variant="secondary"
              >
                Back to sign in
              </Button>
            )}
          </form>
        )}
      </section>
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function getUserDisplayName(user: User) {
  return (
    (typeof user.user_metadata.username === "string" && user.user_metadata.username) ||
    (typeof user.user_metadata.name === "string" && user.user_metadata.name) ||
    user.email?.split("@")[0] ||
    "Workspace"
  );
}
