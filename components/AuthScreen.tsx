"use client";

import { useMemo, useRef, useState } from "react";
import type { Store } from "@/lib/store";
import { classify, fromYaml } from "@/lib/yaml";
import { Button, Icons } from "./ui";

type Mode = "signin" | "create";

export function AuthScreen({
  store,
  initialUsername,
}: {
  store: Store;
  initialUsername?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(store.database.accounts.length > 0 ? "signin" : "create");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [withSample, setWithSample] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreText, setRestoreText] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const accounts = store.database.accounts;
  const hasAccounts = accounts.length > 0;
  const isSecure = useMemo(
    () =>
      typeof window === "undefined" ||
      window.isSecureContext ||
      !window.crypto?.subtle,
    [],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === "signin") {
      if (!username.trim() || !password) {
        setError("Enter your username and password.");
        return;
      }
      setBusy(true);
      const failure = await store.signIn(username, password);
      setBusy(false);
      if (failure) setError(failure);
      else store.notify(`Welcome back, ${username.trim()}.`, "success");
      return;
    }

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    const failure = await store.createAccount({ displayName, username, password, withSample });
    setBusy(false);
    if (failure) setError(failure);
    else store.notify("Account created. Everything stays in this browser.", "success");
  };

  const restore = (text: string) => {
    setError(null);
    setRestoreStatus(null);
    if (!text.trim()) {
      setError("Paste a backup or choose a file first.");
      return;
    }
    try {
      const data = classify(fromYaml(text));
      if (data.kind === "clients") {
        setError("That file holds client boards but no account. Create an account, then import it.");
        return;
      }
      const message = store.appliedImport(data, data.kind === "database" ? "replace" : "merge");
      setRestoreStatus(message);
      setMode("signin");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that file.");
    }
  };

  return (
    <div className="desk relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* A couple of decorative notes so the front door looks like the product. */}
      <div
        aria-hidden="true"
        className="note paper-yellow absolute -top-6 -left-10 hidden h-40 w-40 rotate-[-11deg] p-4 opacity-70 lg:block"
      >
        <p className="font-semibold text-base">Ship on Friday</p>
        <p className="mt-2 text-xs">
          [] draft the copy
          <br />
          [x] book the domain
        </p>
      </div>
      <div
        aria-hidden="true"
        className="note paper-sky absolute -right-8 -bottom-8 hidden h-36 w-44 rotate-[8deg] p-4 opacity-70 lg:block"
      >
        <p className="font-semibold text-base">Client call</p>
        <p className="mt-2 text-xs">
          1. scope
          <br />
          2. budget
        </p>
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-5 text-center">
          <h1 className="font-semibold tracking-tight text-4xl text-ink">Sticky</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Notes with checkboxes, titles and numbered lists. No database, no server - your boards
            are plain YAML in this browser.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-5 shadow-xl">
          <div
            role="tablist"
            aria-label="Account mode"
            className="mb-4 flex gap-1 rounded-xl border border-line bg-panel-soft p-1"
          >
            {(["signin", "create"] as Mode[]).map((entry) => (
              <button
                key={entry}
                role="tab"
                type="button"
                aria-selected={mode === entry}
                disabled={entry === "signin" && !hasAccounts}
                onClick={() => {
                  setMode(entry);
                  setError(null);
                }}
                className={`flex-1 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors disabled:opacity-40 ${
                  mode === entry ? "bg-panel text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                {entry === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "create" ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Your name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Ansh"
                  autoComplete="name"
                  className="field"
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="ansh"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="field"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "create" ? "At least 6 characters" : "Your password"}
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                className="field"
              />
            </label>

            {mode === "create" ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">
                    Confirm password
                  </span>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    className="field"
                  />
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-panel-soft px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={withSample}
                    onChange={(event) => setWithSample(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="text-xs text-ink-soft">
                    <strong className="block font-medium text-ink">Start with a sample board</strong>
                    Two clients and a handful of notes that show off the syntax.
                  </span>
                </label>
              </>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5"
              disabled={busy}
              icon={busy ? undefined : <Icons.Check className="h-4 w-4" />}
            >
              {busy ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {hasAccounts && mode === "signin" ? (
            <div className="mt-4 border-t border-line pt-3.5">
              <p className="text-[0.6875rem] font-semibold tracking-wide text-ink-faint uppercase">
                Accounts in this browser
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      setUsername(account.username);
                      setPassword("");
                      setError(null);
                    }}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      username === account.username
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-line text-ink-soft hover:text-ink"
                    }`}
                  >
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-accent text-[0.5rem] font-semibold text-white">
                      {account.displayName.slice(0, 2).toUpperCase()}
                    </span>
                    {account.username}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 border-t border-line pt-3.5">
            {restoring ? (
              <div className="space-y-2">
                <textarea
                  value={restoreText}
                  onChange={(event) => setRestoreText(event.target.value)}
                  rows={5}
                  spellCheck={false}
                  placeholder="Paste the contents of a sticky .yml backup"
                  className="thin-scroll field resize-y font-mono text-xs"
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".yml,.yaml,text/yaml,application/x-yaml"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        setRestoreText(await file.text());
                        setError(null);
                      }
                    }}
                  />
                  <Button onClick={() => fileRef.current?.click()}>Choose file</Button>
                  <Button variant="primary" onClick={() => restore(restoreText)}>
                    Restore
                  </Button>
                  <Button variant="ghost" onClick={() => setRestoring(false)}>
                    Cancel
                  </Button>
                </div>
                {restoreStatus ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">{restoreStatus}</p>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRestoring(true)}
                className="flex w-full items-center justify-center gap-1.5 text-xs text-ink-soft transition-colors hover:text-ink"
              >
                <Icons.Upload className="h-3.5 w-3.5" />
                Restore from a .yml backup
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[0.6875rem] leading-relaxed text-ink-faint">
          {isSecure
            ? "Passwords are salted and hashed with PBKDF2 before they are stored. Everything stays on this device."
            : "This page is not running in a secure context, so a slower fallback hash is used. Everything stays on this device."}
        </p>
      </div>
    </div>
  );
}
