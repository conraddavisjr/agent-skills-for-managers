---
description: Onboard a new direct report into a Feedback OS Notion workspace — creates their profile card with avatar, their year page, and the filtered views that surface their observations. Use when the manager says "add <name> to my team", "I have a new report starting", or "set up a page for our new hire".
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

## Step 3b — Lay out the employee page body

Every employee page follows the same structure, in this order:

1. Intro line: `Working years, most recent first. Open a year to see every observation logged for that period.`
2. The year subpages from step 3
3. A divider
4. A **toggle heading 4** titled `✏️ Personal Notes` with bulleted children — the manager's own context (interests, travel, values, anything worth remembering before a 1:1)
5. A divider
6. `## All observations`, a one-line description, then the view from step 4b

In Notion-flavored Markdown the notes section is:

```
---
#### ✏️ Personal Notes {toggle="true"}
	- 
---
```

The children must be indented with a tab or they won't nest inside the toggle.

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

## Step 4b — Add the "All observations" view to the employee page

Create a view with `parent_page_id` = the **employee page**, `data_source_id` = Observations.

- Type: `table`
- Name: `<Full name> — all observations`
- Configure:

```
FILTER "Employee Name" = "<Full name>"
SORT BY "Date" DESC
SHOW "Observation", "Date", "Type", "Status", "KPI"
```

This is what a manager lands on when they click the person's card on the home page, so it matters more than the year views.

> [!NOTE]
> **Do not create a per-employee tab on the Observations database.** This was tried and rejected: Notion truncates the view tab bar to "2 more…" at only three views, so it does not scale past a few reports. Per-employee browsing happens through the card grid on the home page, not through tabs.

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
- On the Team page, the gallery/card view stays **first**.
- Do not create a "Needs follow-up" view, and do not create per-employee tabs.

## Display settings these templates expect

These are deliberate choices. If you create a new gallery or a new employee, match them.

| Setting | Value | Why |
| --- | --- | --- |
| Gallery card size | **Small** | Minimises awkward sizing across differently-proportioned profile images |
| Gallery card preview | **Page cover** | The `Photo` property does **not** render — see below |
| Fit image | **Off** | So the cover fills the card instead of letterboxing |
| Open pages in | **Full page** | Not centre peek |
| Hidden on employee pages | `Observations`, `Photo`, `Start Date` | The Observations relation is very long and dominates the top of the page |

## Images

> [!WARNING]
> **A `Files & media` property populated from an external URL via the API does not render as a gallery card cover.** Notion ingests it into a file object that shows as an inert "png" chip and leaves the card blank. Page **icons** and page **covers** set from the same URL render fine.

So: set the page `icon` **and** the page `cover`, and let the gallery preview read the page cover. The `Photo` property is effectively vestigial — populate it if you like, but never rely on it for display.

> [!WARNING]
> **Page covers accept external HTTPS URLs only.** A `file-upload://` source from `create-attachment` is rejected with "Invalid page cover URL", so an image uploaded to Notion cannot become a cover. Covers must point at a publicly reachable URL.

Circular avatars (`radius=50`) leave transparent corners that look wrong on a filled card. Omit `radius` so the avatar is a solid-background square.

## Settings the API cannot set

Report these to the user rather than silently skipping them — they must be done in the Notion UI:

- **Open pages in** (full page vs. peek) — no directive exists in the view DSL
- **Property visibility** on database row pages — not exposed by any tool
- **Card preview / card size / fit image** — `COVER` only accepts real property names; it rejects `"Page cover"`
- **Database templates**, including default property values — cannot be created via API

Property visibility is **database-wide**, and card settings are **per-view**, so once a human sets them they apply automatically to every employee added later. Only the page body structure needs a database template to be inherited.
