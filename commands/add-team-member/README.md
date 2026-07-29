# `/add` — add a team member

Installs as `add.md`, so you type `/add`.

Onboards a new direct report into your Notion team-observation tracker: the place you log
what you noticed about someone, so that six months later the record exists and you aren't
reconstructing a review from whatever happened most recently.

```
/add Priya Raman, senior designer, Design, starting Monday
```

Or just `/add` and answer the questions. Everything after the command is parsed for a name,
role, team, start date, and optionally a Notion URL. Only the name is required.

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
workspace. It tries, in order:

1. A Notion URL you passed as an argument
2. The pinned `TRACKER_TARGET` URL near the top of `command.md`
3. A search by name, several phrasings, no exact match required
4. A search by **structure** — a tracker is identified by having an Observations database
   with an `Employee` relation to an Employees database. No rename touches that shape.
5. Asking you

If nothing validates, or more than one candidate does, it stops and asks for a link rather
than guessing or creating a second tracker. Renaming your page is therefore fine.

The pinned URL ships pointing at the author's tracker, which you can't read — your first run
quietly skips it and searches your own workspace.

## What you need

- The [Notion MCP connector](https://www.notion.so/help/notion-mcp)
- A copy of the tracker template, with an Observations database (`Observation`, `Date`,
  `Employee` relation, `Employee Key` text) and an Employees database (`Name`, `Role`,
  `Team`, `Status`)

> **Get the template:** <!-- NOTION_TEMPLATE_URL --> *(link coming — still being finalized)*

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
