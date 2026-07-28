---
command: add
description: Onboard a new direct report into your Notion team-observation tracker — creates their profile card with avatar, their year page, and the filtered views that surface their observations. Use when the manager says "/add <name>", "add <name> to my team", "I have a new report starting", or "set up a page for our new hire".
argument-hint: <full name> [role] [team] [start date] [notion page url]
allowed-tools:
  - mcp__claude_ai_Notion__notion-search
  - mcp__claude_ai_Notion__notion-fetch
  - mcp__claude_ai_Notion__notion-create-pages
  - mcp__claude_ai_Notion__notion-create-view
  - mcp__claude_ai_Notion__notion-query-data-sources
  - Edit
---

# /add

Add a team member to Feedback OS — a Notion template for managers who log observations about their reports over time.

Onboarding someone requires four linked objects created in the right order. Notion cannot auto-create a view when a row is added, so this is otherwise a repetitive manual chore. Follow every step in order.

Everything after `/add` is `$ARGUMENTS`: a name, optionally a role, team, start date, and a Notion URL. Parse what's there, ask only for what's missing and required.

---

## Configuration — the target page

<!-- TRACKER_TARGET: https://www.notion.so/3abf8853595081a4b59cf9ddbadfa4f9 -->

The HTML comment above is the **pinned target**: the tracker home page this command writes into. It is a hint, not a guarantee — pages get renamed, moved, and re-duplicated. Treat it as the first thing to try and the last thing to update, never as something to trust blindly.

To repoint this command permanently, replace the URL in that comment. To repoint it for a single run, pass a Notion URL in `$ARGUMENTS`.

The pinned URL points at the author's tracker. If you installed this from the repo, the first run won't be able to fetch it and will fall through to searching your own workspace — that is expected, not an error. `Edit` is in `allowed-tools` **only** so this one line can be rewritten once you confirm the right page; do not use it to edit anything else.

---

## Step 0 — Resolve the target page

**Never hardcode database or data source IDs.** They differ in every workspace and change when a template is re-duplicated. Resolve them fresh on every run, in this order, stopping at the first candidate that passes validation:

1. **A Notion URL or bare page ID in `$ARGUMENTS`.** An explicit link always wins.
2. **The pinned `TRACKER_TARGET` URL above**, if one is set. If fetching it fails — deleted, moved, or a workspace you have no access to — say so in one line and continue to step 3. A stale pin is not a reason to stop.
3. **Search by name.** Call `notion-search` for `Feedback OS Team Observation Tracker`, then — if that returns nothing useful — `Feedback OS`, then `team observation tracker`, then `observations manager feedback`. The page name is expected to drift; do not require an exact match.
4. **Search by structure.** Query for the contents rather than the title: `notion-search` for `Employee Name observation KPI` or fetch any `Observations` database that surfaces and walk up its `<ancestor-path>` to the home page. A renamed home page still contains databases whose property names are distinctive.
5. **Ask.** If nothing validates, or two or more candidates do, stop and ask the user for a link to their Feedback OS page. Show what you found and why it was rejected or ambiguous. **Never guess, and never create a new tracker** — a wrong target silently scatters pages across the wrong workspace.

### Validate the candidate before writing

A candidate is the right target only if `notion-fetch` on it reveals **both**:

- an **Observations** database whose schema has an `Observation` title, a `Date` date, an `Employee` relation, and an `Employee Name` **text** property
- an **Employees** database — the one the `Employee` relation points at — with a `Name` title and `Status`, `Role`, `Team` properties

Match on this shape, not on names. Any of these may have been renamed; the reference template ships them as `Observations` and `Employees`, and the Employees database may sit inline on the home page or on a `Team` subpage. Resolve Employees by following the `dataSourceUrl` on the Observations `Employee` relation — that link survives every rename.

If the shape matches but a property is missing, say which one and stop. In particular: **if there is no `Employee Name` text property**, the views must filter on the `Employee` relation, which the API cannot write — see *Filtering* below. Report that rather than creating views that silently show everyone.

Carry four values out of this step:

```
Employees    database id  +  data source id
Observations database id  +  data source id
```

### After resolving

If the target came from anywhere other than the pinned URL (steps 1, 3, 4, or 5), tell the user at the end which page you used and offer to update the `TRACKER_TARGET` comment in this file so the next run resolves in one call. Do not edit the file without being asked.

---

## Step 1 — Gather inputs

Take whatever `$ARGUMENTS` already supplied — `/add Priya Raman, senior designer, Design, starting Monday` should need no follow-up question. Ask only for what's missing. Don't interrogate the user for fields with sensible defaults.

Full name is the only hard requirement; if `$ARGUMENTS` is empty, ask for it. Resolve relative dates ("Monday", "next week") against today before writing.

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

Properties: `Name`, `Role`, `Team`, `Status` = `Active`, `date:Start Date:start` (ISO `YYYY-MM-DD`).

Set **two** image fields on the page itself — both matter, and they are not the same picture:

| Field | Value | Why |
| --- | --- | --- |
| `icon` | circular avatar (`radius=50`) | The small round avatar beside the page title and in every mention |
| `cover` | square avatar (**no** `radius`) | The **only** thing that renders on the gallery card |

```
icon    https://api.dicebear.com/9.x/notionists/png?seed=<firstname>&radius=50&backgroundColor=<hex>&size=256
cover   https://api.dicebear.com/9.x/notionists/png?seed=<firstname>&backgroundColor=<hex>&size=512
```

Use the **same `seed` and `backgroundColor`** for both so the icon and card match. Rotate `backgroundColor` across `b6e3f4`, `c0aede`, `ffd5dc`, `ffdfbf`, `d1d4f9` so cards don't all look alike.

Omit `radius` on the cover deliberately: a circular avatar has transparent corners, which render as dark wedges once the card is set to fill. A solid-background square fills the card cleanly.

The `Photo` property is **vestigial** — populating it is harmless but it does not display anywhere. See *Images* below for why.

---

## Step 3 — Create the year subpage

Create a page whose parent is the **employee page from step 2**, titled with the four-digit year, icon `🗓️`.

> [!IMPORTANT]
> **The year is today's year, resolved when the command runs — never a literal copied from these instructions.** Someone onboarded in 2027 gets a page titled `2027` and nothing else. Creating a `2026` page in 2027 is a bug, and it is the single easiest mistake to make here, because every example in this file was written in 2026.

Create exactly **one** year page — the current one. A new hire has no history, so back-years would be empty pages that make the roster look untidy. Only create earlier years if the user explicitly asks for them, and if so create them **newest-first**: child pages render in creation order and the roster reads in reverse chronological order.

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

### The page may already have some of this

The Employees database ships with a **database template** carrying the static half of this layout — the intro line, both dividers, the `✏️ Personal Notes` toggle, and the `## All observations` heading. Anyone who adds a person with Notion's **New** button gets those blocks already in place.

So `/add` may be handed a page that is partly built. **Fetch the page before writing to it** and add only what is missing. Appending blindly produces two intro lines, two Personal Notes toggles, and two "All observations" headings.

What a template can never supply, and what this command therefore always owns:

- **The year subpage** — a template duplicates its contents verbatim, so a year page inside it would be frozen at whatever year the template was authored in
- **Both filtered views** — their filters must name the person, which a template cannot know

If the scaffold is present, create the year page, insert it after the intro line, and attach the view from step 4b under the existing heading.

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

Report what was created with a link to the new employee page, and name the target page you wrote into so a wrong-workspace mistake is caught immediately. If the target came from anywhere but the pinned URL, offer to pin it (see *After resolving* in step 0). Never invent sample observations for a real person.

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
