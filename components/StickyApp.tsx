"use client";

import { useState } from "react";
import { useStickyStore } from "@/lib/store";
import { AuthScreen } from "./AuthScreen";
import { Board, SyntaxCheatsheet } from "./Board";
import { Sidebar } from "./Sidebar";
import { Button, Icons, IconButton, Modal, Toasts } from "./ui";

export function StickyApp() {
  const store = useStickyStore();
  const [drawer, setDrawer] = useState(false);
  const [help, setHelp] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  if (!store.ready) {
    return (
      <div className="desk grid min-h-dvh place-items-center">
        <div className="text-center">
          <p className="font-hand text-4xl text-ink">Sticky</p>
          <p className="mt-2 text-xs text-ink-soft">Opening your boards...</p>
        </div>
      </div>
    );
  }

  if (!store.account) {
    return (
      <>
        <AuthScreen store={store} initialUsername={switching} />
        <Toasts items={store.toasts} onDismiss={store.dismissToast} />
      </>
    );
  }

  const handleSwitch = (username: string) => {
    store.signOut();
    setSwitching(username);
    setDrawer(false);
  };

  const openHelp = () => {
    setHelp(true);
    setDrawer(false);
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden lg:flex">
        <Sidebar store={store} onOpenHelp={openHelp} onSwitchAccount={handleSwitch} />
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/45" onClick={() => setDrawer(false)} />
          <div className="note-in absolute inset-y-0 left-0 shadow-2xl">
            <Sidebar
              store={store}
              onOpenHelp={openHelp}
              onSwitchAccount={handleSwitch}
              onClose={() => setDrawer(false)}
            />
          </div>
        </div>
      ) : null}

      <main className="desk flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 lg:hidden">
          <IconButton label="Open menu" icon={<Icons.Menu />} onClick={() => setDrawer(true)} />
          <span className="font-hand text-2xl leading-none text-ink">Sticky</span>
          <span className="flex-1" />
          <span className="text-[0.6875rem] text-ink-faint">@{store.account.username}</span>
        </div>

        {store.client ? (
          <Board client={store.client} store={store} />
        ) : (
          <div className="grid flex-1 place-items-center p-6">
            <div className="w-full max-w-md rounded-2xl border border-dashed border-line bg-panel/70 p-6 text-center">
              <h2 className="font-hand text-2xl text-ink">No clients yet</h2>
              <p className="mt-1.5 text-sm text-ink-soft">
                A client is a board. Add one and start pinning stickies to it.
              </p>
              <Button
                className="mt-5"
                variant="primary"
                icon={<Icons.Plus className="h-4 w-4" />}
                onClick={() => store.addClient("My first client")}
              >
                Create a client list
              </Button>
            </div>
          </div>
        )}
      </main>

      <Toasts items={store.toasts} onDismiss={store.dismissToast} />

      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="How Sticky works"
        description="Markers turn into real elements while you type."
        width="max-w-xl"
      >
        <SyntaxCheatsheet />
        <div className="mt-5 space-y-3 border-t border-line pt-4 text-xs leading-relaxed text-ink-soft">
          <p>
            <strong className="font-medium text-ink">Editing.</strong> Press{" "}
            <kbd className="rounded border border-line bg-panel-soft px-1 font-mono">Enter</kbd> to
            add the next line - checkboxes stay checkboxes and numbered lists keep counting.{" "}
            <kbd className="rounded border border-line bg-panel-soft px-1 font-mono">Tab</kbd>{" "}
            indents a line, and an empty checkbox followed by Enter ends the list.
          </p>
          <p>
            <strong className="font-medium text-ink">Completing.</strong> Click a box and a dash is
            drawn through the task. The counter in the corner of each sticky tracks how many are
            left.
          </p>
          <p>
            <strong className="font-medium text-ink">Layout.</strong> Notes are stacked in balanced
            columns, so a note that grows taller simply pushes its neighbours down.
          </p>
          <p>
            <strong className="font-medium text-ink">Storage.</strong> There is no database and no
            server. Each account, client list and sticky is serialised to YAML and kept in this
            browser&apos;s local storage. Use the{" "}
            <Icons.Code className="inline h-3.5 w-3.5 align-[-2px]" /> button on any board to read,
            edit, download or import that YAML.
          </p>
          <p>
            <strong className="font-medium text-ink">Accounts.</strong> Any number of accounts can
            live side by side in one browser. Switch between them from the account menu.
          </p>
        </div>
      </Modal>
    </div>
  );
}
