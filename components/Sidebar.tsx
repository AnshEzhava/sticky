"use client";

import { useState } from "react";
import type { Store } from "@/lib/store";
import type { ThemeMode } from "@/lib/types";
import { Button, Dropdown, Icons, IconButton, MenuItem, MenuLabel, Modal, downloadText, slugify } from "./ui";

const THEMES: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { id: "light", label: "Light", icon: <Icons.Sun className="h-3.5 w-3.5" /> },
  { id: "system", label: "System", icon: <Icons.Monitor className="h-3.5 w-3.5" /> },
  { id: "dark", label: "Dark", icon: <Icons.Moon className="h-3.5 w-3.5" /> },
];

export function Sidebar({
  store,
  onOpenHelp,
  onSwitchAccount,
  onClose,
}: {
  store: Store;
  onOpenHelp: () => void;
  onSwitchAccount: (username: string) => void;
  onClose?: () => void;
}) {
  const [newClient, setNewClient] = useState(false);
  const [clientName, setClientName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const account = store.account;
  if (!account) return null;

  const others = store.database.accounts.filter((a) => a.id !== account.id);
  const initials = account.displayName.slice(0, 2).toUpperCase();

  const createClient = () => {
    store.addClient(clientName);
    setClientName("");
    setNewClient(false);
    onClose?.();
  };

  const changePassword = async () => {
    setPasswordBusy(true);
    const error = await store.changePassword(current, next);
    setPasswordBusy(false);
    setPasswordError(error);
    if (!error) {
      setPasswordOpen(false);
      setCurrent("");
      setNext("");
      store.notify("Password updated.", "success");
    }
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <span className="font-hand text-[1.7rem] leading-none text-ink">Sticky</span>
        <span className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-faint">
          .yml
        </span>
        <span className="flex-1" />
        <IconButton className="lg:hidden" label="Close menu" icon={<Icons.X />} onClick={onClose} />
      </div>

      <div className="px-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-panel-soft px-2.5 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-[0.75rem] font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-medium text-ink">{account.displayName}</p>
            <p className="truncate text-[0.6875rem] text-ink-faint">@{account.username}</p>
          </div>
          <Dropdown label="Account options" icon={<Icons.Dots />}>
            <MenuLabel>Account</MenuLabel>
            <MenuItem
              icon={<Icons.Pencil className="h-3.5 w-3.5" />}
              onClick={() => {
                setDisplayName(account.displayName);
                setRenameOpen(true);
              }}
            >
              Rename
            </MenuItem>
            <MenuItem
              icon={<Icons.Lock className="h-3.5 w-3.5" />}
              onClick={() => {
                setCurrent("");
                setNext("");
                setPasswordError(null);
                setPasswordOpen(true);
              }}
            >
              Change password
            </MenuItem>
            <MenuItem
              icon={<Icons.Download className="h-3.5 w-3.5" />}
              onClick={() =>
                downloadText(`sticky-${slugify(account.username)}.yml`, store.exportAccountYaml())
              }
            >
              Download account .yml
            </MenuItem>

            {others.length > 0 ? (
              <>
                <MenuLabel>Switch account</MenuLabel>
                {others.map((other) => (
                  <MenuItem
                    key={other.id}
                    icon={<Icons.User className="h-3.5 w-3.5" />}
                    onClick={() => onSwitchAccount(other.username)}
                  >
                    <span className="block truncate">
                      {other.displayName}
                      <span className="text-ink-faint"> · {other.clients.length} boards</span>
                    </span>
                  </MenuItem>
                ))}
              </>
            ) : null}

            <MenuLabel>Session</MenuLabel>
            <MenuItem icon={<Icons.Logout className="h-3.5 w-3.5" />} onClick={store.signOut}>
              Sign out
            </MenuItem>
            <MenuItem danger icon={<Icons.Trash className="h-3.5 w-3.5" />} onClick={() => setDeleteOpen(true)}>
              Delete account
            </MenuItem>
          </Dropdown>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between px-4 pb-1">
        <h2 className="text-[0.6875rem] font-semibold tracking-wide text-ink-faint uppercase">
          Client lists
        </h2>
        <IconButton
          label="New client list"
          icon={<Icons.Plus className="h-4 w-4" />}
          onClick={() => setNewClient(true)}
        />
      </div>

      <nav className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Client lists">
        {account.clients.length === 0 ? (
          <p className="px-2.5 py-3 text-xs text-ink-faint">
            No clients yet. Add one to start a board.
          </p>
        ) : (
          account.clients.map((client) => {
            const active = store.client?.id === client.id;
            return (
              <button
                key={client.id}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => {
                  store.selectClient(client.id);
                  onClose?.();
                }}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] transition-colors ${
                  active
                    ? "bg-accent-soft font-medium text-ink"
                    : "text-ink-soft hover:bg-panel-soft hover:text-ink"
                }`}
              >
                <span
                  className={`paper-${client.color} h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5`}
                  style={{ background: "var(--paper-edge)" }}
                />
                <span className="flex-1 truncate">{client.name}</span>
                <span className="text-[0.6875rem] tabular-nums text-ink-faint">
                  {client.stickies.length}
                </span>
              </button>
            );
          })
        )}
      </nav>

      <footer className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5">
        <div
          role="radiogroup"
          aria-label="Colour theme"
          className="flex items-center gap-0.5 rounded-lg border border-line bg-panel-soft p-0.5"
        >
          {THEMES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={store.theme === entry.id}
              aria-label={entry.label}
              title={entry.label}
              onClick={() => store.setTheme(entry.id)}
              className={`grid h-6 w-7 place-items-center rounded-md transition-colors ${
                store.theme === entry.id ? "bg-panel text-ink shadow-sm" : "text-ink-faint hover:text-ink"
              }`}
            >
              {entry.icon}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1.5 text-[0.6875rem] text-ink-faint">
          {store.saveState === "saving" ? "Saving" : store.saveState === "error" ? "Not saved" : "Saved"}
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              store.saveState === "error" ? "bg-red-500" : "bg-emerald-500"
            }`}
          />
        </span>
        <IconButton label="How the syntax works" icon={<Icons.Help />} onClick={onOpenHelp} />
      </footer>

      <Modal
        open={newClient}
        onClose={() => setNewClient(false)}
        title="New client list"
        description="Each client gets its own board of stickies."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewClient(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={createClient}>
              Create client
            </Button>
          </>
        }
      >
        <input
          autoFocus
          value={clientName}
          onChange={(event) => setClientName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") createClient();
          }}
          placeholder="Client name"
          aria-label="Client name"
          className="field"
        />
      </Modal>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename account"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                store.renameAccount(displayName);
                setRenameOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <input
          autoFocus
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-label="Display name"
          className="field"
        />
      </Modal>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Change password"
        description="Accounts are stored in this browser only."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPasswordOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={passwordBusy} onClick={() => void changePassword()}>
              {passwordBusy ? "Working..." : "Update password"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <input
            autoFocus
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            placeholder="Current password"
            aria-label="Current password"
            className="field"
          />
          <input
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            placeholder="New password"
            aria-label="New password"
            className="field"
          />
          {passwordError ? <p className="text-xs text-red-600 dark:text-red-400">{passwordError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${account.displayName}?`}
        description="This erases the account and every client board inside it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<Icons.Trash className="h-4 w-4" />}
              onClick={() => {
                downloadText(`sticky-${slugify(account.username)}.yml`, store.exportAccountYaml());
                store.deleteAccount(account.id);
                setDeleteOpen(false);
              }}
            >
              Download a copy first, then delete
            </Button>
          </>
        }
      />
    </aside>
  );
}
