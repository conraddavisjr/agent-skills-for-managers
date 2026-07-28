---
description: Onboard a new direct report into a Feedback OS Notion workspace — creates their profile card, year page, filtered year view, and their tab on the Observations database. Use when the manager says "add <name> to my team", "I have a new report starting", or "set up a page for our new hire".
allowed-tools:
  - mcp__claude_ai_Notion__notion-search
  - mcp__claude_ai_Notion__notion-fetch
  - mcp__claude_ai_Notion__notion-create-pages
  - mcp__claude_ai_Notion__notion-create-view
  - mcp__claude_ai_Notion__notion-query-data-sources
---

# /feedback-os-add-team-member

Add a team member to Feedback OS — a Notion template for managers who log observations about their reports over time.

Onboarding someone requires four linked objects created in the right order. Notion cannot auto-create a view when a row is added, so this is otherwise a repetitive manual chore. Follow every step in order.

---

## Step 0 — Resolve the workspace IDs

**Never hardcode IDs.** Every installation of this template has different ones.

1. Call `notion-search` with query `Feedback OS Team Observation Tracker`.
2. `notion-fetch` the top-level page. Its content contains the `Observations` database and a `Team` subpage.
3. `notion-fetch` the `Team` page to get the **Employees** database, and `notion-fetch` that database to read its `<data-source url="collection://...">` tag.
4. `notion-fetch` the `Observations` database for its data source ID.

You now need four values:

```
Employees    database id  +  data source id
Observations database id  +  data source id
```

If the search returns nothing, the user either hasn't duplicated the template or renamed it. Ask for a link to their Feedback OS page rather than guessing.

**Before writing anything**, confirm the Observations schema by reading its properties. If it has an `Employee Name` text property, you are on the text-filter variant — see *Filtering* below. If it does not, the views filter on the `Employee` relation and must be configured through the Notion UI, not the API.

---

## Step 1 — Gather inputs

Ask only for what's missing. Don't interrogate the user for fields with sensible defaults.

| Input | Required | Default |
| --- | --- | --- |
| Full name | Yes | — |
| Role / title | No | leave blank |
| Team | No | `Engineering` |
| Start date | No | leave blank |
| Photo | No | generate an avatar |
| Years to create | No | current year only |

---

## Step 2 — Create the employee row

Create a page whose parent is the **Employees data source**.

Properties: `Name`, `Role`, `Team`, `Status` = `Active`, `date:Start Date:start` (ISO `YYYY-MM-DD`), and `Photo` as a **single-element array containing an image URL**.

Set the page `icon` to the same URL so the avatar appears wherever the page is referenced.

If no photo was supplied, generate one:

```
https://api.dicebear.com/9.x/notionists/png?seed=<firstname>&radius=50&backgroundColor=<hex>&size=256
```

Rotate `backgroundColor` across `b6e3f4`, `c0aede`, `ffd5dc`, `ffdfbf`, `d1d4f9` so cards don't all look alike. `radius=50` is what makes the avatar circular — keep it.

---

## Step 3 — Create the year subpage

Create a page whose parent is the **employee page from step 2**, titled with the four-digit year (`2026`), icon `🗓️`.

If creating several years, **create them newest-first** — child pages render in creation order and the roster reads in reverse chronological order.

---

## Step 4 — Add the filtered view to that year page

Create a view with `parent_page_id` = the year page and `data_source_id` = the Observations data source. This produces an inline linked view.

- Type: `table`
- Name: `<Full name> — <year>`
- Configure:

```
FILTER "Employee Name" = "<Full name>"
FILTER "Date" >= "<year>-01-01"
FILTER "Date" <= "<year>-12-31"
SORT BY "Date" DESC
SHOW "Observation", "Type", "KPI", "Date", "Status"
```

---

## Step 5 — Add their tab to the Observations database

Create a view with `database_id` = the Observations database — **not** `parent_page_id`, which would create a linked view on a page instead of a database tab.

- Type: `table`
- Name: the person's full name, exactly
- Configure:

```
FILTER "Employee Name" = "<Full name>"
SORT BY "Date" DESC
SHOW "Observation", "Date", "Type", "Status", "KPI"
```

---

## Step 6 — Verify, then report

Query the new year view in `view` mode and confirm what comes back.

- Zero rows for a brand-new hire is a **pass** — they have no observations yet.
- Rows belonging to **other people** is a **failure**: the filter was silently dropped. Re-read *Filtering* below.

Report what was created with a link to the new employee page. Never invent sample observations for a real person.

---

## Filtering — read this before debugging a broken view

> [!WARNING]
> **The Notion view API cannot filter on relation properties.** `FILTER "Employee" = "Nia Patel"` is accepted and then **silently discarded** — no error is raised, you just get an empty filter group and a view showing everyone. Matching on the page ID instead does not help. Formula properties fail the same way, wrapped in a list `every` operator that matches nothing.

This is why the template carries an `Employee Name` **text** property alongside the `Employee` relation: it is the only employee filter the API can actually write. The Notion UI has no such limitation — a human can filter on the relation directly.

Consequences to respect:

- Set **both** `Employee` (relation) and `Employee Name` (text) on every observation. The relation drives rollups; the text drives every view filter. If they disagree, views silently show wrong rows.
- `Employee Name` must match the employee page title **character for character**. Renaming a person breaks their views until the text is updated on every one of their observations.
- Formula values are never readable through the API — they return opaque `formulaResult://` references. You cannot verify a formula by reading it back.

---

## House style

- Observations column order is `Observation, Date, Employee, Type, Status, KPI`. Preserve it.
- **Never pass `SHOW` when updating a view the user already has**, including the default view — it overwrites their column order and widths.
- Per-person tabs omit the `Employee` column, since it's identical on every row there.
- On the Team page, the gallery/card view stays **first**.
- Do not create a "Needs follow-up" view.
