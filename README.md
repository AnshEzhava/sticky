# Sticky

A sticky note board for keeping client work straight. Write a note in plain
text and the markers turn into real elements as you type: checkboxes you can
tick, numbered lists that renumber themselves, headings, bullets and rules.

Sticky notes stack into balanced columns, so a note that grows taller simply
pushes its neighbours down.

There is **no database and no server**. Every account, client list and sticky is
serialised to YAML, kept in the browser, and exportable as a plain `.yml` file.

```
# Launch checklist          <- a title, in the sticky's own handwriting
[] Draft the announcement   <- a checkbox
[x] Book the domain         <- ticked, so a dash is drawn through it
1. Write the landing copy   <- numbered, and renumbered automatically
2. Design the hero shot
  1. Crop the screenshots   <- two leading spaces indent a line
```

## The syntax

| Type this | You get |
| --- | --- |
| `[] buy milk` | a checkbox. Click it and a completion dash sweeps through the text |
| `[x] done` | the same thing, already ticked |
| `1. first` | a numbered row. Numbers come from position, so inserting one renumbers the rest |
| `# Heading` | a heading (up to `###`) |
| `- bullet` | a bullet point |
| `> quote` | an indented quote |
| `---` | a horizontal rule |
| two leading spaces | indent a row, including nested checklists |

Press **Enter** to continue a list, **Tab** to indent, and Enter on an empty
checkbox to end the checklist. Markers are recognised the moment you finish
typing them, on any line.

## Accounts and clients

- **Accounts** are created in the browser: a username, a display name and a
  password. Any number of accounts can sit side by side, and you switch between
  them from the account menu (which asks for that account's password).
- **Client lists** belong to an account. Each one is a board of stickies, so a
  freelancer can keep Acme's work separate from Northwind's.
- Passwords are salted and hashed with PBKDF2-SHA256 via WebCrypto before they
  are written to storage. This keeps a shared browser profile from showing your
  password in plain sight. It is **not** a security boundary: anyone who can
  open the browser profile can read the boards.

## Where the data lives

`localStorage` holds one YAML document under `sticky.database.v1`. The previous
good copy is kept alongside it as `sticky.database.v1.backup`, so a bad write
cannot lose a board.

The **`</>` button** on any board opens the same document:

- **This board** - edit the YAML and press *Apply changes*; the board updates
  immediately, numbers included.
- **Whole account** - read-only, for taking a full backup.
- **Import** - drop in a `.yml` file, or paste one. Whole accounts, a single
  client board, or a bare list of stickies all work.

`examples/sample-board.yml` is a ready-made board in that format.

```yaml
version: 1
accounts:
  - id: acc_1o56631m1039
    username: ansh
    displayName: Ansh
    password:
      algo: PBKDF2-SHA256
      iterations: 150000
      salt: 0MZ8mQ0m2Q==
      hash: 4rQ1c9m2sV0=
    clients:
      - id: cli_1o56631m1039
        name: Acme Studio
        color: yellow
        stickies:
          - title: Launch checklist
            body: |-
              [] Draft the announcement
              [x] Book the domain
              1. Write the landing copy
            color: yellow
            pinned: true
```

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export into out/
npm test        # unit tests for the syntax and YAML layers
npm run lint
```

`next.config.ts` sets `output: "export"`, so `npm run build` writes a folder of
plain HTML, CSS and JS. Serve `out/` from any static host - Netlify, Cloudflare
Pages, S3, GitHub Pages, nginx. The app expects to be served from a web root; if
you deploy it under a sub-path, set `basePath` in `next.config.ts` to match.

### Deploying to the i2icore server

`.github/workflows/deploy.yml` ships a push to `main` to `/opt/sticky` on
`49.143.252.45` over SSH/SFTP, promoting it with an atomic symlink so the live
site is never blank mid-deploy. See [DEPLOY.md](DEPLOY.md) for the secrets,
the nginx server block and the rollback command.

## How it fits together

```
app/
  layout.tsx        fonts, metadata, theme colours
  page.tsx          renders the app
  globals.css       the paper palette, the completion dash, the column grid
components/
  StickyApp.tsx     boot -> sign in -> board
  AuthScreen.tsx    create an account, sign in, restore a backup
  Sidebar.tsx       account, client lists, theme, save indicator
  Board.tsx         search, filters, the auto-aligning grid, empty states
  StickyNote.tsx    one note: title, paper colour, pin, progress
  BlockEditor.tsx   the line editor and the marker engine
  YamlPanel.tsx     read, edit, download and import the YAML
  ui.tsx            buttons, menus, modals, toasts, icons
lib/
  types.ts          the document model
  blocks.ts         parse and serialise the note syntax (pure, unit tested)
  yaml.ts           YAML in and out, plus tolerant validation
  storage.ts        localStorage, with a rolling backup
  crypto.ts         PBKDF2 password hashing
  store.ts          all application state and mutations
  seed.ts           the sample boards
```

`lib/blocks.ts` and `lib/yaml.ts` hold no framework code. `npm test` runs the
tests in `tests/` straight against those TypeScript sources using Node's own
type stripping - there is no test framework to install.

## Known limits

- Boards live in one browser profile. There is no sync between devices - use
  *Download .yml* to move them.
- Clearing site data deletes the boards, which is why exports exist.
- Multi-column balance is the browser's CSS column algorithm, so a board with
  very few notes can leave the last column short.
