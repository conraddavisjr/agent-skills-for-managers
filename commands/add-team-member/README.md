# `/add-team-member` — add a team member

Installs as `add-team-member.md`, so you type `/add-team-member`.

Onboards a new direct report into your Notion team-observation tracker: the place you log
what you noticed about someone, so that six months later the record exists and you aren't
reconstructing a review from whatever happened most recently.

```
/add-team-member Priya Raman, senior designer, Design, starting Monday
```

Or just `/add-team-member` and answer the questions. Everything after the command is parsed for a name,
role, team, start date, and optionally a Notion URL. Only the name is required.

The name is the only thing you type — role, team, start date and avatar arrive as a keyboard
picker you arrow through, with the options read off your existing roster so the roles and teams
you already use are one keystroke away. Anything not on the list you can still type, and any
field you skip falls back to its default.

## What it creates

Onboarding someone by hand means creating four linked things in the right order, and Notion
can't auto-create a view when you add a database row — so it's a repetitive chore every time
someone joins.

1. **A profile card** in the Employees database, with an avatar generated if you don't supply
   a photo
2. **A year page** underneath them, titled with the current year
3. **A filtered view on that year page**, showing only their observations for that year
4. **An all-observations view** on the profile itself — the page you land on when you click
   someone's card

Then it queries the new view and checks what comes back. Zero rows for a new hire is a pass.
Rows belonging to *other people* is a failure, and it says so.

## Finding your tracker

The command never hardcodes database IDs — it resolves them on every run, so it works in any
workspace and survives any rename.

The important part is the split: **a search only ever produces candidates. A marker is what
confirms one.** Your tracker carries `feedback-os/v1` in the description of the Observations
title property — invisible in normal use, but it survives duplication and the command reads
it on every run.

**Nothing is written to a page that isn't confirmed.** A structural check alone isn't enough:
plenty of workspaces contain some people-table-plus-notes-table that would pass one, and
scattering employee pages through an unrelated project isn't something you can easily undo.

Where it looks, in order:

1. A Notion URL you passed as an argument
2. The pinned `TRACKER_TARGET` near the top of `command.md`
3. A search by **structure** — an Observations-shaped database, walked up to its home page
4. A search by name, last and least, because those queries return a lot of noise

Then it verifies every candidate and discards the unmarked. One survivor and it proceeds.
Two or more — a sandbox copy alongside a live one, say — and it lists them and asks, because
both are real and only you know which you meant.

**If you have no tracker**, it won't invent one. It'll point you at `/init` or the published
template and stop.

**If you have one from before markers existed**, it says so and walks you through adding the
marker — a one-time UI step, because Notion exposes no API for writing a property
description. Mark it once and every later run, and every copy duplicated from it, resolves
without asking.

The pin ships **empty**. Your first run resolves your tracker and offers to write the URL in,
so every later run is a single fetch. Reinstalling keeps it — updating with `--force` won't
cost you the setting.

## What you need

- The [Notion MCP connector](https://www.notion.so/help/notion-mcp)
- A copy of the tracker template, with an Observations database (`Observation`, `Date`,
  `Employee` relation, `Employee Key` text) and an Employees database (`Name`, `Role`,
  `Team`, `Status`)

> **Get the template:** <!-- NOTION_TEMPLATE_URL --> https://woolly-navy-883.notion.site/team-obserations-ai-tool-by-conrad-davis-jr

## Why the `Employee Key` column exists

This is the non-obvious thing the command carries so an agent doesn't rediscover it the hard
way:

> **Notion's view API silently discards the value on a relation filter.** `FILTER "Employee" =
> "Nia Patel"` is accepted and then dropped. No error — you just get a view showing everyone.
> Rollups and formulas fail identically. Only plain text, select, date, number, and checkbox
> filters can carry a value.

There is a second, less obvious half. **Notion pre-fills a text filter's value into rows created
in that view, and does not do the same for a relation filter.** So a year page filtered by
`Employee Key` stamps each new observation with the right person automatically — something a
relation filter cannot do even when you set it by hand in the UI.

So `Employee Key` is not a workaround for the relation. It **routes** observations to the right
pages and is the only field Notion fills in for you. The `Employee` relation does the other
half: it **feeds the rollups**. The command's reconcile step keeps them in agreement.

The key holds the employee's **page ID**, never their display name — an earlier name-based
version of this column silently detached people's observations the first time anyone was
renamed.

`command.md` also records which display settings the API *cannot* set — card size, card
preview, property visibility, "open pages in" — so the command reports them for you to set by
hand instead of pretending they worked.
