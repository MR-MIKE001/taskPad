# Taskpad

**A private task manager and job-search tracker that runs entirely in your browser.** No account, no server, no tracking: tasks, lists and job applications are stored in `localStorage` and never leave your device.

![React 19](https://img.shields.io/badge/React-19-61dafb) ![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6) ![Vite 8](https://img.shields.io/badge/Vite-8-646cff) ![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8) ![Tests: 64 passing](https://img.shields.io/badge/tests-64_passing-22c55e)

- **Plan your work:** natural-language quick add, smart views, lists, tags, subtasks, recurring tasks and drag-to-reorder.
- **Run your job search:** follow each application from wishlist to offer, with a status timeline, follow-up reminders and pipeline stats.
- **Never lose anything:** undo and redo for every change, live sync between tabs, JSON backup and import, and clear warnings whenever saving could fail.

## Contents

- [Quick start](#quick-start)
- [Features](#features)
- [Using the app](#using-the-app)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Testing and quality](#testing-and-quality)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Limitations and roadmap](#limitations-and-roadmap)

## Quick start

**Requirements:** Node.js **24 LTS** (or 22.13 or newer). Vite 8 uses a native binary that npm skips on older Node versions, and the dev server then fails with `Cannot find native binding`.

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload. |
| `npm run build` | Type-check, then build a static site into `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the unit and integration tests once. |
| `npm run test:watch` | Run the tests in watch mode. |
| `npm run typecheck` | Type-check without building. |
| `npm run lint` | Run ESLint. |

> **Seeing `Cannot find native binding`?** Check `node -v`. Upgrade Node (for example `nvm install 24` then `nvm use 24`), delete `node_modules` and `package-lock.json`, and run `npm install` again.

## Features

### Tasks

- **Natural-language quick add.** `Pay rent every month !high #bills`, `Call mum friday`, `Book flights in 2 weeks @travel`. Each detected date, repeat, priority, tag or list appears as a chip you can dismiss before saving.
- **Smart views:** Today (with an Overdue section), Upcoming (grouped by day), Inbox, All tasks, Completed, plus coloured lists and tags.
- **Recurring tasks:** daily, weekdays, weekly or monthly. Completing one schedules the next and skips dates already past; monthly repeats clamp to the end of short months.
- **Details:** subtasks with progress, notes, four priority levels, due dates and up to 12 tags.
- **Drag to reorder** with mouse, touch or keyboard.
- **Search** across titles, notes, tags and subtasks (`Ctrl+K`), and five sort orders.

### Job applications

- **Track each application:** company, role, location, salary, contact, posting link, notes, applied date and follow-up date.
- **Pipeline:** Wishlist → Applied → Interviewing → Offer, or Rejected / Withdrawn at any point. Change the stage straight from the row; every change is recorded on a **timeline**.
- **Follow-up reminders:** when the date arrives, the row shows *Follow up now*, rises to the top, and the sidebar count turns red.
- **Stats:** applied, interviewing, offers, and **interview rate** (the share of applications that ever reached an interview or offer).
- **Filters** (Active, All, or one stage), **search**, and a separate **CSV export**.

### Everywhere

- **Undo / redo** for every change, including deletes, imports and clearing completed tasks (last 100 changes).
- **Cross-tab sync:** edits appear immediately in other open tabs.
- **Backup:** export JSON (everything) or CSV (spreadsheets); import by merging or replacing.
- **Dark mode** (system, light or dark) with no flash on load.
- **Keyboard shortcuts** for everything common; press `?` in the app.
- **Responsive and accessible:** works on phones, fully usable from the keyboard, and labelled for screen readers.

## Using the app

| Shortcut | Action |
| --- | --- |
| `N` or `/` | Focus the add box |
| `Ctrl+K` | Search |
| `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`) | Undo / redo |
| `G` then `T` / `U` / `I` / `A` / `J` | Go to Today, Upcoming, Inbox, All tasks, Job applications |
| `Ctrl+Enter` | Save in an editor |
| `?` | Show all shortcuts |

Quick-add syntax:

| Detail | Examples |
| --- | --- |
| Date | `today`, `tomorrow`, `fri`, `next monday`, `next week`, `in 3 days`, `in 2 weeks`, `nov 5`, `5 nov 2027`, `2026-11-05` |
| Repeat | `every day`, `every weekday`, `every week`, `every month`, `every monday`, `daily`, `weekly`, `monthly` |
| Priority | `!1`–`!3`, `!low`, `!med`, `!high`, `!urgent` |
| Tag | `#groceries` |
| List | `@work` (an existing list; dashes for spaces) |

The full guide is in the [user manual](docs/Taskpad-User-Manual.pdf).

## How it works

```
 UI components ──action──▶ StoreProvider ──▶ withHistory (undo/redo) ──▶ reducer (pure)
       ▲                                                                     │
       └────────────────────────── new state ◀───────────────────────────────┘
                                       │
                         debounced save (250 ms)
                                       ▼
                                 localStorage ──storage event──▶ other tabs ──▶ sanitize() ──▶ adopt state
```

| Concern | Decision |
| --- | --- |
| **State** | A pure reducer wrapped by a generic undo/redo layer. Ids, timestamps and "today" are created outside the reducer and passed in with the action, so it is deterministic and easy to test. |
| **Dates** | Due, applied and follow-up dates are `YYYY-MM-DD` calendar strings, not timestamps, and date maths uses UTC fields. A date stays on the same day across time zones and daylight saving. |
| **Persistence** | Versioned JSON, debounced writes, flushed on `pagehide` and when the tab is hidden. Data saved before job tracking existed loads with an empty job list. |
| **Trust boundary** | Everything loaded from storage, an import file or another tab passes through `sanitize()`, which repairs or drops malformed records, so the rest of the app can trust its types. |
| **Failure modes** | Unreadable data is backed up under `taskpad:data:corrupt:<time>` instead of being overwritten. Data written by a newer app version opens read-only. Full or blocked storage shows a banner with a backup button. |
| **Security** | No `dangerouslySetInnerHTML`. Job posting links are reduced to `http(s)` URLs on input and on load, so a `javascript:` link is never rendered. CSV exports neutralise spreadsheet formula injection. |
| **Cross-tab sync** | The `storage` event adopts other tabs' changes without recording history or writing back, so tabs never ping-pong. |
| **Routing** | Hash routes (`#/today`, `#/jobs`, `#/list/<id>`) need no server configuration. |
| **Accessibility** | Native `<dialog>` for focus trapping and Escape, labelled controls, `role="checkbox"` completion, `aria-pressed` filters, live-region toasts, keyboard drag and drop, and reduced-motion support. |

## Project structure

```
src/
  lib/            pure logic, no React
    dates.ts          calendar-date arithmetic and formatting
    recurrence.ts     next-occurrence rules
    parseQuickAdd.ts  natural-language parser for the add box
    selectors.ts      filtering, sorting, grouping and counts for tasks
    jobs.ts           job rules: create, patch + timeline, URL safety, sanitising, stats
    exportData.ts     JSON/CSV export, import parsing and merging
  store/          state
    types.ts          data model
    reducer.ts        every state change, as a pure function
    history.ts        generic undo/redo wrapper
    persistence.ts    load, save, sanitise
    StoreContext.tsx  React provider exposing the actions
  hooks/          hash routing, hotkeys, preferences, toasts, midnight rollover
  components/     UI (App shell, Sidebar, task list and editor, JobsView, JobDialog, dialogs)
docs/             project guide and user manual (PDF)
```

## Testing and quality

64 tests across 8 files run with Vitest and Testing Library in jsdom:

- **Unit:** date maths, recurrence, the quick-add parser, selectors, job rules (URL safety, timeline, stats, follow-ups, sanitising, merging, CSV), the reducer and undo history, and persistence (round trips, corrupt data, newer versions).
- **Integration:** full user flows through the real app, such as adding and editing tasks, undoing deletes, creating lists, and tracking a job from creation through a status change, a follow-up, saving, deletion and undo.

```bash
npm test && npm run typecheck && npm run lint
```

## Deployment

`npm run build` produces a static site in `dist/` with a relative base path, so it works from any URL or subfolder. Deploy the folder as-is to GitHub Pages, Netlify, Vercel or Cloudflare Pages; no server or rewrites are needed.

## Documentation

- [User manual (PDF)](docs/Taskpad-User-Manual.pdf): how to use every feature, shortcuts and troubleshooting.
- [Project guide (PDF)](docs/Taskpad-Project-Guide.pdf): architecture, implementation of the job tracker, design decisions and roadmap.

## Limitations and roadmap

**Limitations**

- Data lives in one browser profile. Clearing site data deletes it; use **Export JSON** for backups and to move between devices.
- The stored format is still version 1. An older build of the app does not know about job applications and would drop them the next time it saves.
- `localStorage` holds about 5 MB and is synchronous: plenty for thousands of records, but not for attachments.

**Roadmap**

1. Kanban board for the application pipeline (drag between stages).
2. Funnel analytics from the status timeline: stage conversion, time in each stage, response times.
3. Versioned schema migrations, each step tested.
4. Tasks linked to applications (interview prep, follow-ups).
5. Installable PWA with offline support and follow-up notifications.
6. CI: GitHub Actions running tests, lint, Playwright end-to-end tests, accessibility checks and a bundle-size budget.
7. IndexedDB storage with CV and cover-letter attachments.
8. Optional, end-to-end encrypted sync between devices.
