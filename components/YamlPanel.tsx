"use client";

import { useRef, useState } from "react";
import type { ClientList } from "@/lib/types";
import type { Store } from "@/lib/store";
import { classify, DataError, fromYaml } from "@/lib/yaml";
import { Button, Icons, Modal, downloadText, slugify, useCopy } from "./ui";

type Tab = "board" | "account" | "import";

const TABS: { id: Tab; label: string }[] = [
  { id: "board", label: "This board" },
  { id: "account", label: "Whole account" },
  { id: "import", label: "Import" },
];

/** Mounted only while it is open, so its drafts always start from live data. */
export function YamlPanel({
  onClose,
  client,
  store,
}: {
  onClose: () => void;
  client: ClientList;
  store: Store;
}) {
  const [tab, setTab] = useState<Tab>("board");
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { copied, copy } = useCopy();

  const boardYaml = draft ?? store.exportClientYaml(client.id);
  const accountYaml = store.exportAccountYaml();

  const applyBoard = () => {
    setError(null);
    setStatus(null);
    try {
      const parsed = classify(fromYaml(boardYaml));
      if (parsed.kind !== "clients" || parsed.clients.length !== 1) {
        throw new DataError(
          "This tab expects exactly one client board. Use the Import tab for accounts or lists.",
        );
      }
      const next = parsed.clients[0];
      store.replaceClient(client.id, { ...next, id: client.id });
      setDraft(null);
      setStatus("Applied. The board now matches the YAML.");
      store.notify("Board updated from YAML.", "success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that YAML.");
    }
  };

  const runImport = (text: string) => {
    setError(null);
    setStatus(null);
    if (!text.trim()) {
      setError("Paste some YAML or choose a file first.");
      return;
    }
    try {
      const parsed = classify(fromYaml(text));
      const message = store.appliedImport(parsed, "merge");
      setStatus(message);
      store.notify(message, "success");
      setImportText("");
      setFileLabel(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that YAML.");
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setFileLabel(`${file.name} (${Math.max(1, Math.round(file.size / 1024))} kB)`);
    const text = await file.text();
    setImportText(text);
    setError(null);
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      title="Your data, as YAML"
      description="No database and no server. Everything lives in this document - download it, edit it, paste it back."
      footer={
        tab === "import" ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              icon={<Icons.Upload className="h-4 w-4" />}
              onClick={() => runImport(importText)}
            >
              Import
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              icon={<Icons.Copy className="h-4 w-4" />}
              onClick={() => copy(tab === "board" ? boardYaml : accountYaml)}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              icon={<Icons.Download className="h-4 w-4" />}
              onClick={() =>
                downloadText(
                  tab === "board"
                    ? `${slugify(client.name)}.yml`
                    : `sticky-${slugify(store.account?.username ?? "account")}.yml`,
                  tab === "board" ? boardYaml : accountYaml,
                )
              }
            >
              Download .yml
            </Button>
            {tab === "board" ? (
              <Button variant="primary" icon={<Icons.Check className="h-4 w-4" />} onClick={applyBoard}>
                Apply changes
              </Button>
            ) : null}
          </>
        )
      }
    >
      <div role="tablist" aria-label="YAML scope" className="mb-3 flex gap-1 border-b border-line">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            type="button"
            aria-selected={tab === entry.id}
            onClick={() => {
              setTab(entry.id);
              setError(null);
              setStatus(null);
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-[0.8125rem] font-medium transition-colors ${
              tab === entry.id
                ? "border-accent text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "import" ? (
        <div className="space-y-3">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void pickFile(event.dataTransfer.files?.[0]);
            }}
            className="rounded-xl border border-dashed border-line bg-panel-soft px-4 py-6 text-center"
          >
            <Icons.File className="mx-auto h-6 w-6 text-ink-faint" />
            <p className="mt-2 text-sm font-medium text-ink">Drop a .yml file here</p>
            <p className="mt-1 text-xs text-ink-soft">
              Whole accounts, a single client board, or a bare list of stickies.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".yml,.yaml,text/yaml,application/x-yaml"
              className="hidden"
              onChange={(event) => void pickFile(event.target.files?.[0] ?? undefined)}
            />
            <Button className="mt-3" onClick={() => fileRef.current?.click()}>
              Choose a file
            </Button>
            {fileLabel ? <p className="mt-2 text-xs text-ink-soft">{fileLabel}</p> : null}
          </div>
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            spellCheck={false}
            rows={8}
            placeholder={"# ...or paste YAML straight in\nname: New client\nstickies:\n  - title: First\n    body: |\n      [] a checkbox"}
            className="thin-scroll field resize-y font-mono text-xs leading-relaxed"
          />
          <p className="text-xs text-ink-soft">
            Imported boards are added to{" "}
            <strong className="font-medium text-ink">{store.account?.displayName}</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={tab === "board" ? boardYaml : accountYaml}
            readOnly={tab === "account"}
            spellCheck={false}
            onChange={(event) => setDraft(event.target.value)}
            rows={16}
            className="thin-scroll field resize-y font-mono text-xs leading-relaxed"
            aria-label="YAML editor"
          />
          {tab === "account" ? (
            <p className="text-xs text-ink-soft">
              The account view is read only because it contains the password hash. Use this tab to
              take a full backup.
            </p>
          ) : (
            <p className="text-xs text-ink-soft">
              Edit the text and press <strong className="font-medium text-ink">Apply changes</strong>{" "}
              - the board updates immediately, numbers included.
            </p>
          )}
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
          {status}
        </p>
      ) : null}
    </Modal>
  );
}
