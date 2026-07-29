---
command: add
description: Onboard a new direct report into your Notion team-observation tracker — creates their profile card with avatar, their year page, and the filtered views that surface their observations. Use when the manager says "/add <name>", "add <name> to my team", "I have a new report starting", or "set up a page for our new hire".
argument-hint: <full name> [role] [team] [start date] [notion page url]
example: "/add Priya Raman, senior designer, Design, starting Monday"
allowed-tools:
  - mcp__claude_ai_Notion__notion-search
  - mcp__claude_ai_Notion__notion-fetch
  - mcp__claude_ai_Notion__notion-create-pages
  - mcp__claude_ai_Notion__notion-create-view
  - mcp__claude_ai_Notion__notion-query-data-sources
  - mcp__claude_ai_Notion__notion-update-page
  - AskUserQuestion
  - Edit
---

# /add

Add a team member to Feedback OS — a Notion template for managers who log observations about their reports over time.

Onboarding someone requires four linked objects created in the right order. Notion cannot auto-create a view when a row is added, so this is otherwise a repetitive manual chore. Follow every step in order.

Everything after `/add` is `$ARGUMENTS`: a name, optionally a role, team, start date, and a Notion URL. Parse what's there, ask only for what's missing and required.

---

## Configuration — the target page

<!-- TRACKER_TARGET:  -->

The HTML comment above is the **pinned target**: the tracker home page this command writes into. **It ships empty.** The first successful run resolves the user's tracker and offers to write the URL here, so every later run is a single fetch instead of a search.

A pin is a shortcut, not a permission slip — it is verified exactly like any other candidate, because pages get renamed, moved, deleted, and re-duplicated.

To repoint permanently, replace the URL in that comment. To repoint for a single run, pass a Notion URL in `$ARGUMENTS`.

`Edit` is in `allowed-tools` **only** so this one line can be rewritten once you have confirmed the right page; do not use it to edit anything else. Reinstalling carries the pin forward, so updating with `--force` will not cost the user this setting.

---

## Step 0 — Resolve the target page

**Never hardcode database or data source IDs.** They differ in every workspace and change when a template is re-duplicated. Resolve them fresh on every run.

The rule that governs this entire step: **a search produces candidates; only the marker confirms one.** Titles drift, users rename things, and more than one page in a workspace can legitimately look like a tracker. Nothing is written until a candidate is confirmed.

### The marker

A Feedback OS tracker identifies itself by a token in the **description of the Observations title property**. Fetch the Observations data source and read the `description` on its title property:

```
One line. What did you notice?
feedback-os/v1
```

Match the `feedback-os/` prefix, then read the version after the slash. This command knows **v1**.

| Found | Meaning |
| --- | --- |
| `feedback-os/v1` | Confirmed. Safe to write |
| `feedback-os/` with a higher version | The template is newer than this command. Say so, quote your install stamp, and offer the update command before touching anything |
| No marker | **Not confirmed.** See *Adopting an unmarked tracker* |

> [!WARNING]
> **No marker, no writes.** Shape is not proof. Any HR-ish setup with a people table and a notes table can pass a structural check, and scattering employee pages and views through someone's unrelated project is not something they can easily undo. When in doubt, stop and ask.

### Where to look, in order

1. **A Notion URL or bare page ID in `$ARGUMENTS`.** An explicit link goes to the front of the queue. It is still verified.
2. **The pinned `TRACKER_TARGET`**, if set. If the fetch fails — deleted, moved, no access — say so in one line and keep going. If the fetch succeeds but the marker is absent, the pin is pointing somewhere wrong: say that too, and keep going.
3. **Search by structure.** This is what finds a tracker no matter what it has been renamed to. Look for an Observations-shaped database — a title, a `Date`, an `Employee` relation, an `Employee Key` text — then walk its `<ancestor-path>` up to the home page. Useful queries: `observation KPI exemplary employee`, `Employee Key observation`.
4. **Search by name**, last and least: `Feedback OS`, `team observation tracker`. Expect noise — these queries return unrelated pages that merely discuss feedback. A name match is a candidate and nothing more.

### Resolving to one

Verify every candidate, discard the unmarked, then:

| Confirmed | Do |
| --- | --- |
| Exactly one | Name the page and its URL, proceed, and offer to pin it |
| Two or more | **Ask.** List each title and URL and let the user choose. Never auto-pick — a sandbox copy and a live one are both genuine trackers, and only the user knows which they mean |
| None | Stop — see *When there is no tracker* |

### Then check it can be written to

Confirming identity is not the same as confirming capability. On the confirmed tracker, check:

- the **Observations** database has an `Observation` title, a `Date` date, an `Employee` relation, and an `Employee Key` **text** property
- the **Employees** database — the one the `Employee` relation points at — has a `Name` title and `Status`, `Role`, `Team` properties

Resolve Employees by following the `dataSourceUrl` on the Observations `Employee` relation; that link survives every rename. The reference template ships these as `Observations` and `Employees`, and Employees may sit inline on the home page or on a `Team` subpage.

If a property is missing, say which one and stop. In particular: **if there is no `Employee Key` text property**, there is nothing the API can filter on — see *Filtering* below. Offer to add it (`ADD COLUMN "Employee Key" RICH_TEXT`, then backfill from each observation's `Employee` relation) rather than creating views that silently show everyone.

Older copies carry an `Employee Name` text property instead, holding the person's **display name**. That design is retired: renaming anyone silently detaches their rows and can serve one person's observations on another person's page. If you find it, say so and offer to migrate — the replacement stores the employee's page ID, which never changes.

### Adopting an unmarked tracker

A page whose shape matches but which carries no marker is most likely a tracker built before markers existed. Do not assume, and do not write to it.

> [!NOTE]
> **You cannot add the marker yourself.** Property descriptions are readable through `notion-fetch` but there is no API to write one — the schema DDL only does `ADD`/`DROP`/`RENAME`/`ALTER COLUMN`, and a data source's own `description` is write-only (it never comes back on a fetch, so it can't be a marker). This is a UI-only step, like the card and visibility settings elsewhere in this template.

Say what you found, name the page and its URL, and give the user the one-time step:

1. Open the **Observations** database
2. Click the **`Observation`** column header → **Edit property** → **Description**
3. Add `feedback-os/v1` on its own line, keeping whatever text is already there

Then offer to re-run. Once marked, every future run — and every copy duplicated from it — resolves without asking.

If they would rather not, you may proceed **only** if they explicitly confirm the page is their tracker, and you must say plainly that you are proceeding on their word without verification. Prefer marking. Never proceed on your own judgement of the shape alone.

### When there is no tracker

Nothing confirmed and nothing to adopt means the user does not have Feedback OS yet.

**Do not create one.** That is `/init`'s job — building the structure in two places guarantees the two drift apart, and parts of the setup are UI-only anyway. Stop and offer the two ways to get a tracker:

1. **Run `/init`**, which builds it in their workspace
2. **Duplicate the published template**, then re-run `/add`

Then stop. Creating employee pages with nowhere coherent to put them is worse than doing nothing.

### Whenever you stop, say how to get unstuck

Any halt in this step — a property missing, a shape that doesn't match, a retired design found, a marker version you don't recognise — must end with **both** of these, or the user is left with a diagnosis and no remedy:

1. **What to fix in Notion**, naming the exact property.
2. **How to update this command**, because the likelier cause is that this file is older than the template it's describing.

Two halts are *not* staleness and must not suggest reinstalling: **no tracker found** (they need `/init` or the template) and **two or more confirmed trackers** (they need to pick one). Reinstalling fixes neither.

You are a snapshot. This file was rendered at install time and has not changed since; the repo has. Near the top, just under the frontmatter, is a comment reading `<!-- Installed <date> from <repo>@<ref> -->`. **Read it and quote the date**, then give the update command verbatim:

```
npx github:conraddavisjr/agent-skills-for-managers add --force
```

`--force` is required — without it the installer sees the existing file and skips it silently. After updating, the user must restart their agent before the new version is read.

If the stamp is absent, the copy predates stamping and is definitely stale — say so.

Phrase it as the likely fix, not a certainty. A schema mismatch can equally mean the template was customised, and telling someone to reinstall when they have deliberately renamed a property is unhelpful.

### What to say while resolving

Resolution is plumbing. Everything in this step — the four lookup routes, the marker, the property
audit — is *how you decided*, not what a manager onboarding a hire needs to read.

**Say nothing while working.** On the happy path this entire step emits one line, once it is done:

```
✅ Found your tracker — [📘 EDIT: Team Observation Tracker](url)
```

Then the current roster, bulleted, **capped at five**, with a `+N more` line when it overflows:

```
Current roster
- Marcus Lindqvist — PM, Product
- Sophia Reyes — SWE II, Engineering
- Nia Patel — Senior SWE, Engineering
+7 more
```

A `<details>` block renders as raw tags in a terminal, so truncation is the expander. The roster is
there so a duplicate is caught at a glance; it is not a report.

Never narrate which route hit, that the marker was found or which version it carried, the property
audit, database or data source IDs, or the phrase "step 0".

> [!IMPORTANT]
> **This silence applies to the happy path only.** Every halt above still reports in full — a pin
> pointing at the wrong page, a missing property, two or more confirmed candidates, an unmarked
> tracker, a marker version you don't recognise, no tracker at all. Each still names the page, the
> exact property, and the update command, exactly as written above. A silent failure is worse than
> a verbose one.

Carry four values out of this step:

```
Employees    database id  +  data source id
Observations database id  +  data source id
```

### After resolving

If the target came from anywhere other than the pin, tell the user at the end which page you used and offer to write its URL into the `TRACKER_TARGET` comment so the next run resolves in a single fetch. Do not edit the file without being asked.

This matters most on a **first run**, where the pin ships empty and resolution costs several searches. Pinning turns every subsequent run into one call, and the pin now survives reinstalling.

---

## Step 1 — Gather inputs

Parse `$ARGUMENTS` first and ask only for what is genuinely missing. `/add Priya Raman, senior designer, Design, starting Monday` is complete — ask nothing at all and go straight to step 2.

Full name is the only hard requirement.

| Input | Required | Default |
| --- | --- | --- |
| Full name | Yes | — |
| Role | No | leave blank |
| Team | No | `Engineering` |
| Start date | No | leave blank |
| Photo | No | generate an avatar |
| Years to create | No | current year only |

### If the name is missing

One line, then stop and wait:

```
**Who are you adding?** Full name — *required*

/add Priya Raman, senior designer, Design, starting Monday
```

The second line is a pre-filled example the manager can accept and edit. Do **not** list the optional fields here — they are collected in the picker below, and repeating them turns a single question into a form.

### Collect the optional fields with `AskUserQuestion`

Once you have a name, ask for everything still missing in a **single** `AskUserQuestion` call, so the manager arrows through it instead of typing. One question per missing field, four maximum, in this order. Omit any question whose field `$ARGUMENTS` already supplied — nothing is asked twice.

Options come from the tracker, not from this file. You already fetched the Employees data source in step 0.

| Question | `header` | Options, in order |
| --- | --- | --- |
| Role | `Role` | the three most common `Role` values on the roster, then `Skip — leave blank` |
| Team | `Team` | the four most common `Team` values on the roster, `Engineering` first and labelled `(default)` |
| Start date | `Start date` | `Today`, `Next Monday`, `Skip — leave blank` |
| Avatar | `Avatar` | `Generate an avatar`, `I'll provide a photo URL`, `Skip` |

- Every question carries a free-text **Other** row automatically. That is how a manager enters a role or team the roster hasn't seen yet, or a specific date. Don't spend an option slot on it, and never add one named "Other".
- **Team options must be real values of the `Team` select.** Read them off the schema; offering a value the property doesn't have produces a write that fails at step 2.
- **Empty roster — the first hire.** There is nothing to rank. Take Team's options straight from the select schema, and drop the Role question in favour of asking for it in the text form below.
- `Skip`, or `Other` left empty, means the documented default: blank for role and start date, `Engineering` for team.
- `I'll provide a photo URL` → ask for the URL on one line after the panel and use it for both the page `icon` and `cover` in step 2, instead of generating. Anything else falls through to *Represent people properly*, which still governs how a generated avatar is chosen.
- Resolve relative answers — `Today`, `Next Monday`, and whatever is typed into `Other` — against today's date before writing.

### If `AskUserQuestion` is unavailable

Cursor, Windsurf and generic installs have no picker. Fall back to one terse block, then wait:

```
**Who are you adding?**

Full name — *required*
Role — *optional*
Team — *optional* · Engineering | Product | Design | Data | Sales | Marketing | Operations | Other
Start date — *optional*

/add Priya Raman, senior designer, Design, starting Monday
```

Teams stay pipe-separated on one line, and read the real options off the `Team` select rather than copying the list above. No "otherwise left blank" annotations — `*optional*` already says it.

---

## Step 2 — Create the employee row

Create a page whose parent is the **Employees data source**.

Properties: `Name`, `Role`, `Team`, `Status` = `Active`, `date:Start Date:start` (ISO `YYYY-MM-DD`).

Set **two** image fields on the page itself — both matter, and they are not the same picture:

| Field | Value | Why |
| --- | --- | --- |
| `icon` | circular avatar (`radius=50`) | The small round avatar beside the page title and in every mention |
| `cover` | square avatar (**no** `radius`) | The **only** thing that renders on the gallery card |

The avatars use DiceBear's **`avataaars`** style. Build one URL, then request it twice — once
with `radius=50` for the icon, once without for the cover:

```
https://api.dicebear.com/9.x/avataaars/png
  ?seed=<unique>
  &skinColor=<tone>
  &top=<hair>
  &hairColor=2c1b18
  &facialHairProbability=<0|100>
  &eyes=default&eyebrows=default&mouth=smile
  &clothing=blazerAndShirt
  &backgroundColor=<hex>
  &size=256   (icon, add &radius=50)   |   &size=512   (cover, no radius)
```

Everything except `radius` and `size` must be **identical** between the two, or the icon and
the card show different people.

Rotate `backgroundColor` across `b6e3f4`, `c0aede`, `ffd5dc`, `ffdfbf`, `d1d4f9` so cards
don't all look alike.

Omit `radius` on the cover deliberately: a circular avatar has transparent corners that render
as dark wedges once the card fills. A solid-background square fills cleanly.

### Represent people properly

If the user supplied no photo you are inventing someone's likeness, so do it thoughtfully.

- **Ask, or infer from the name, rather than defaulting.** A single default skin tone across
  every hire is its own statement. If you have nothing to go on, vary it.
- `skinColor` accepts `614335`, `ae5d29`, `d08b5b`, `edb98a`, `f8d25c`, `fd9841`, `ffdbb4`.
- For textured hair use `top=frizzle`, `dreads01`, `dreads02`, `shortCurly`, or `curly`.
  Pair with `hairColor=2c1b18`.
- `facialHairProbability=100` plus `facialHair=beardLight` reads male; `0` omits it.
- Glance at the existing roster first and avoid making every new hire look the same.

> [!NOTE]
> **Do not switch back to the `notionists` style.** It was used originally and abandoned
> deliberately: it has **no `skinColor` parameter at all** — the figures are pure line art with
> no skin fill — and none of its 64 hair variants is an afro or braids. It cannot represent a
> Black team member. `avataaars` was chosen because it supports both skin tone and textured
> hair, at the cost of a flatter, less hand-drawn look.

The `Photo` property is **vestigial** — populating it is harmless but it does not display
anywhere. See *Images* below for why.

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
FILTER "Employee Key" = "<employee page id>"
FILTER "Date" >= "<year>-01-01"
FILTER "Date" <= "<year>-12-31"
SORT BY "Date" DESC
SHOW "Observation", "Type", "KPI", "Date", "Status"
```

`<employee page id>` is the **dashed UUID of the page you created in step 2**, not the person's name. Filtering on a key rather than on `Employee` looks backwards; *Filtering* below explains why it is the only thing that works.

---

## Step 4b — Add the "All observations" view to the employee page

Create a view with `parent_page_id` = the **employee page**, `data_source_id` = Observations.

- Type: `table`
- Name: `<Full name> — all observations`
- Configure:

```
FILTER "Employee Key" = "<employee page id>"
SORT BY "Date" DESC
SHOW "Observation", "Date", "Type", "Status", "KPI"
```

This is what a manager lands on when they click the person's card on the home page, so it matters more than the year views.

> [!NOTE]
> **Do not create a per-employee tab on the Observations database.** This was tried and rejected: Notion truncates the view tab bar to "2 more…" at only three views, so it does not scale past a few reports. Per-employee browsing happens through the card grid on the home page, not through tabs.

---

## Step 5 — Reconcile observations

Run this at the end of every invocation, even when onboarding produced no observations. It is idempotent and does nothing when the data is already consistent, so there is no cost to running it too often. It exists because the manager's fastest logging path — **New** on a year page — leaves the `Employee` relation empty, and the rollups drift quietly until something repairs them.

It is unambiguous because `Employee Key` holds exactly the page ID that `Employee` points at, so either field can rebuild the other. No name matching is involved.

Find the drift:

```sql
SELECT url, "Observation", "Employee", "Employee Key"
FROM "<observations data source url>"
WHERE ("Employee" IS NULL AND "Employee Key" != '')
   OR ("Employee" IS NOT NULL AND ("Employee Key" IS NULL OR "Employee Key" = ''))
```

Repair each row with `notion-update-page`:

- **Key present, relation empty** → set `Employee` to `["<Employee Key>"]`. The common case: every row the manager logged by hand since the last run.
- **Relation present, key empty** → set `Employee Key` to the dashed page ID inside `Employee`. Until you do, that row is invisible on the person's pages.
- **Both empty** → do **not** guess, and do not delete. Leave it for the manager.

> [!WARNING]
> **Never infer an employee from the text of the observation.** "Pair with Marcus on the payments migration" is logged about **Nia**, not Marcus. Names in the body are evidence, not attribution.

---

## Step 6 — Verify, then report

Query the new year view in `view` mode and confirm what comes back.

- Zero rows for a brand-new hire is a **pass** — they have no observations yet.
- Rows belonging to **other people** is a **failure**: the filter was silently dropped. Re-read *Filtering* below.

Report what was created with a link to the new employee page, and name the target page you wrote into so a wrong-workspace mistake is caught immediately. If the target came from anywhere but the pinned URL, offer to pin it (see *After resolving* in step 0). Never invent sample observations for a real person.

Also report what step 5 did: how many observations you linked, and — if anything is sitting in `⚠️ Needs linking` — name those rows. That view is the only signal that an observation exists about nobody, and only the manager can resolve it.

---

## Filtering — read this before debugging a broken view

> [!WARNING]
> **The view API cannot bind a value to a relation, rollup, or formula filter.** `FILTER "Employee" = "Nia Patel"` is accepted and then **silently discarded** — no error, just an empty filter group and a view showing everyone. The page ID as the value does not help; neither does `CONTAINS`; neither does a rollup of the employee's name, nor a formula. Only plain scalars — text, select, date, number, checkbox — can carry a filter value.

Two facts about Notion, which together explain the whole design:

1. **A text filter's value is pre-filled into rows created in that view.** Hitting **New** on a year page stamps the new observation with that page's `Employee Key` automatically.
2. **A relation filter is not.** Even set by hand in the UI, where it is perfectly legal, it files rows correctly but leaves the `Employee` field on a new row empty. This was tested; do not re-derive it.

So `Employee Key` is not a workaround for the relation — it does a job the relation cannot do. It **routes** observations to the right person's pages, and it is the only field Notion will fill in on the manager's behalf. The `Employee` relation does the job the key cannot: it **feeds the rollups** (`Last observed`, `Total observations`, `Days since`).

Consequences to respect:

- The key holds the employee's **page ID**, never a name. IDs survive renames; names do not.
- Nothing fills the relation automatically. Any observation logged by hand arrives with a key and no relation — which is exactly what *Step 5 — Reconcile* repairs.
- When you write an observation yourself, set **both** fields. Reconciliation is a net, not a plan.
- `FILTER "Employee" IS EMPTY` / `IS NOT EMPTY` **do** work on a relation — there is no value to bind. That is what makes the `⚠️ Needs linking` view possible.
- Formula values are never readable through the API — they return opaque `formulaResult://` references. You cannot verify a formula by reading it back.

---

## House style

- Observations column order is `Observation, Date, Employee, Type, Status, KPI`. Preserve it.
- `Employee Key` stays **hidden in every view**. It is machinery, not information — a manager should never see a UUID column in a tool about people.
- **Never pass `SHOW` when updating a view the user already has**, including the default view — it overwrites their column order and widths.
- `HIDE "col"` is not a safe alternative: it **resets `displayProperties` to schema order**, destroying a hand-arranged layout. If you must hide something on an existing view, follow it with an explicit `SHOW` in the intended order. Column widths are not recoverable either way.
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
