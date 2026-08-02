---
description: Discover your team's recurring ceremonies, Slack channels, Jira project, GitHub teams, and 1:1 partners, then write them to an onboarding config that /onboard reads. Run once to set up, and again any time your team's meetings, channels, or repos change.
argument-hint: [--sync-notion] [--from-notion <url>] [--show]
example: "/onboard-setup"
allowed-tools:
  - Read
  - AskUserQuestion
  - Bash(python3 -c ' *)
  - Bash(gh api *)
  - mcp__claude_ai_Google_Calendar__list_calendars
  - mcp__claude_ai_Google_Calendar__list_events
  - mcp__claude_ai_Figma__whoami
  - mcp__claude_ai_Notion__notion-search
  - mcp__claude_ai_Notion__notion-fetch
  - mcp__claude_ai_Notion__notion-create-pages
  - mcp__claude_ai_Notion__notion-update-page
  - mcp__claude_ai_Slack
  - mcp__claude_ai_Atlassian
---

# /onboard-setup

Build the config that `/onboard` runs on. Follow every step in order.

This command **only reads** from your systems and **only writes** to one local file. It never invites
anyone, never creates a ticket, and never sends a message. That is what makes it safe to re-run, and
re-running is the intended way to update your config when a ceremony moves or a channel is retired.

Everything site-specific — event IDs, channel IDs, project keys, org slugs — is **discovered here and
stored in config**, never hardcoded in this file. That is the whole point: this command ships identical
to every manager who installs it, and the config is what makes it theirs.

## Whenever you stop, say how to get unstuck

Several steps below halt deliberately — a connector without scopes, a workspace you cannot read. Every
one of those must end with the fix, not just the diagnosis.

For anything that looks like this file disagreeing with reality — a tool name that no longer exists, a
field the API stopped returning, instructions describing something you cannot find — remember that
**you are a snapshot**. This file was rendered at install time and has not changed since; the repo has.
Just under the frontmatter is a comment reading `<!-- Installed <date> from <repo>@<ref> -->`. Read it,
quote the date, and give the update command verbatim:

```
npx github:conraddavisjr/agent-skills-for-managers onboard-setup --force
```

`--force` is required — without it the installer sees the existing file and skips it silently. After
updating, the user must restart their agent before the new version is read. If the stamp is absent, the
copy predates stamping and is definitely stale.

This does **not** apply to a connector that won't authenticate or a system the user simply doesn't use.
Those are configuration, and reinstalling fixes neither.

---

## Where config lives

```
~/.claude/onboarding-pipeline/
  config.json          the file this command writes
  hires/<slug>.json    per-hire run receipts, written by /onboard — never touched here
```

**This path is deliberate.** Everything installed into `.claude/commands/` becomes a slash command, so a
config file cannot live beside the command. Keeping it under `~/.claude/onboarding-pipeline/` also means
reinstalling or updating this command never costs the user their settings.

> [!WARNING]
> `config.json` holds colleagues' names and email addresses, and the receipts hold new hires' personal
> details. It lives outside any repo on purpose. **Never offer to commit it, copy it into the project,
> or paste its full contents into a shared document.**

### Reading and writing it

Read with the `Read` tool. Write with a `python3 -c` round-trip, which creates the directory, merges
rather than clobbers, and writes atomically:

```bash
python3 -c '
import json, os, tempfile

patch = {"team": {"name": "Core Platform"}}   # <- only the sections you are updating

d = os.path.expanduser("~/.claude/onboarding-pipeline")
os.makedirs(d, exist_ok=True)
p = os.path.join(d, "config.json")
cfg = json.load(open(p)) if os.path.exists(p) else {}
cfg.update(patch)
fd, tmp = tempfile.mkstemp(dir=d)
with os.fdopen(fd, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
os.replace(tmp, p)
print("wrote", p)
'
```

Three things about this snippet are load-bearing, and changing them breaks it in ways that are not
obvious until a user loses config:

- **The patch is a literal inside the script.** Do not pass it through an environment variable
  (`PATCH=… python3 -c …`). The permission granted to this command is `Bash(python3 -c ' *)`, which
  matches only a command *starting* with `python3 -c '` — any prefix makes it prompt.
- **`cfg.update()` is a shallow merge.** Always send whole top-level keys — the entire `ceremonies`
  array, never one element — or you will silently drop its siblings.
- **Write through `os.fdopen` in a `with` block, then `os.replace`.** The `with` guarantees the
  buffer is flushed before the rename, so an interrupted run leaves the old config intact rather
  than a truncated one.

> [!WARNING]
> The whole script is inside shell single quotes, so **an apostrophe in any value terminates the
> quoting early** and the command fails or, worse, runs a fragment. Names like `O'Brien` are common
> enough to plan for: write it escaped as `\u0027` (six characters, no apostrophe among them) and let Python decode it.

The same snippet writes a hire receipt — only `p` changes, to
`os.path.join(d, "hires", "<slug>.json")`, with `os.makedirs` on the `hires` subdirectory.

### The schema

```jsonc
{
  "version": 1,
  "team": {
    "name": "Core Platform",
    "manager_email": "you@company.com",
    "timezone": "America/Chicago"          // IANA. 1:1 scheduling depends on this
  },
  "notion": {
    "content_page_url": null,              // human-written onboarding material, rendered into tickets
    "mirror_page_url": null                // optional human-readable copy of this config
  },
  "ceremonies": [
    {
      "summary": "Sprint Planning",
      "recurring_event_id": "…",           // the SERIES id, never an instance id
      "calendar_id": "primary",
      "organizer": "pm@company.com",
      "add_via": "direct"                  // direct | request_organizer | group
    }
  ],
  "one_on_ones": {
    "manager": { "cadence": "weekly", "duration_min": 30 },
    "peers": [ { "name": "…", "email": "…", "duration_min": 30 } ],
    "scheduling": { "max_per_day": 2, "window_days": 10, "work_hours": "09:00-17:00" }
  },
  "google_groups": ["core-platform@company.com"],
  "slack": {
    "channels": [ { "id": "C…", "name": "eng-core", "private": false, "required": true } ]
  },
  "jira": {
    "site": "company.atlassian.net",
    "project_key": "ENG",
    "issue_type": "Task",
    "first_task": { "discovery": "label", "label": "onboarding-first-task" }
  },
  "github": { "org": "company", "teams": ["core-platform"] },
  "figma": { "mode": "request", "admin_contact": "design-admin@company.com", "teams": ["…"] },
  "manual_tasks": [ { "label": "Add to PagerDuty rotation", "url": "https://…" } ]
}
```

Any section the user skips is written as `null`. `/onboard` treats `null` as "this manager doesn't use
that system" and stays silent about it — an omitted section must never produce a warning on every run.

### Flags

| Flag | Behavior |
| --- | --- |
| *(none)* | Full wizard. Existing config is loaded first and pre-selected. |
| `--show` | Print the current config as a readable summary and stop. Writes nothing. |
| `--sync-notion` | Write a human-readable mirror of the config to Notion and stop. |
| `--from-notion <url>` | Re-import a mirror page into `config.json`, then run the wizard so it can be confirmed. |

---

## Step 0 — Capability preflight

Probe what is actually connected before asking a single question. Nothing is more annoying than
answering ten questions and then learning the connector was dead.

Run these concurrently and build a status table:

| System | Probe | If it fails |
| --- | --- | --- |
| Google Calendar | `list_calendars` | **Halt.** See below |
| Notion | `notion-search` for anything, `page_size: 1` | Note as unavailable, continue |
| Figma | `whoami` | Note as unavailable, skip step 7 |
| Slack | any `mcp__claude_ai_Slack__*` tool exists | Fall back to manual entry in step 4 |
| Jira | `getAccessibleAtlassianResources` | Fall back to manual entry in step 5 |
| GitHub | `gh api user` | Fall back to manual entry in step 6 |

> [!IMPORTANT]
> **A Google Calendar failure is the one hard halt.** Calendar supplies both the ceremonies and the 1:1
> partners — the two things this pipeline exists to automate. There is nothing useful to discover
> without it.
>
> The known failure is `Request had insufficient authentication scopes.` That means the connector is
> linked but was authorized without calendar read/write. Reconnecting is the fix, and it is not
> obvious, so say it plainly: **the Google Calendar connector needs to be removed and re-added so it
> can request calendar scopes.** Do not suggest reinstalling this command — it will not help.

Print the table once, then continue. Do not narrate each probe as you make it.

---

## Step 1 — Team basics

If `config.json` exists, load it and use its values as defaults; this step is then a confirmation, not
an interrogation.

One `AskUserQuestion` call covering: **team name**, **your work email**, and **timezone**. Offer the
timezone detected from the primary calendar as the first option — it is almost always right.

---

## Step 2 — Discover ceremonies

Call `list_events` on the primary calendar for the **next 28 days**. Four weeks catches biweekly and
monthly cadences; a single week does not.

### Reduce instances to series — this is the step people get wrong

`list_events` returns **individual occurrences**, not series. Ten standups come back as ten events.

1. **Drop** anything with `eventType` of `OUT_OF_OFFICE`, `FOCUS_TIME`, `WORKING_LOCATION`, or
   `BIRTHDAY`, plus any event the user has declined.
2. **Drop** events with no `recurringEventId` — one-offs are not ceremonies.
3. **Group by `recurringEventId`** and keep one representative per group. That id is what gets stored;
   an instance id invites the hire to exactly one occurrence of standup and nothing else.
4. **Drop** groups with fewer than 2 attendees — those are personal reminders.

### Classify how each one can actually be joined

This determines whether `/onboard` can do the work or has to ask a human, and getting it right here is
what keeps the run from failing later.

| Test, in order | `add_via` | Why |
| --- | --- | --- |
| An attendee looks like a group alias — a `mailto` that is not a person, commonly `team@`, `-eng@`, `all-`, `*-team@`, and which appears on several ceremonies | `group` | **Best case.** One group membership change subscribes the hire to every meeting carrying that alias |
| `organizer.email` matches the manager, or `guestsCanModify` is true | `direct` | The API can add the attendee |
| Anything else | `request_organizer` | **The API cannot do this.** Only the organizer can add a guest |

> [!WARNING]
> **You cannot add a guest to an event you do not organize.** Google Calendar rejects attendee edits on
> other people's events unless *guests can modify* is set. Most sprint ceremonies and all-hands are
> organized by a PM, a scrum master, or an exec — so a meaningful share of any real team's ceremonies
> land in `request_organizer`, and that is correct, not a bug. `/onboard` turns each one into a drafted
> email rather than a silent failure.

### Present the choice

One `AskUserQuestion` with `multiSelect: true`. Label each option with the meeting name, its cadence,
and its route, so the trade-off is visible while choosing:

```
Sprint Planning — weekly, Mon 10:00 — you organize (can add directly)
Engineering All-Hands — monthly — organized by dana@ (will draft a request)
Daily Standup — daily — via core-platform@company.com (group covers it)
```

Cap the list at the 12 most frequent. If more survive filtering, say `+N more not shown` and offer to
list them.

### Surface the group opportunity

If any `group` candidates were found, say so prominently — it is the highest-leverage finding in the
whole run:

```
3 of your ceremonies already carry core-platform@company.com.
Adding a hire to that one group covers all 3 — worth doing first.
```

Store the aliases under `google_groups`. Adding someone to a Google Group needs Workspace admin and is
not available through any connector here, so `/onboard` will always emit it as a manual task — but as
*one* task that replaces several, which is a good trade.

---

## Step 3 — Discover 1:1 partners

Rank every attendee across the ceremonies selected in step 2 by how many of them they appear on.
Frequent co-attendees are the team; a once-a-month all-hands attendee is not.

Exclude the manager, room and resource bookings (anything with `resource.` in the address or
`self: false` room semantics), group aliases already captured, and external domains.

One `AskUserQuestion`, `multiSelect: true`, ordered by frequency, showing the count:

```
Sophia Reyes — on 4 of your 5 ceremonies
Marcus Lindqvist — on 4 of 5
Nia Patel — on 3 of 5
```

Then one more `AskUserQuestion` for scheduling policy, defaults pre-selected:

- **Meetings per day** — default **2**. More than two intro calls a day is a bad first week.
- **Window** — default **10 working days**, so intros spread across the ramp instead of stacking on day one.
- **Working hours** — default **09:00–17:00** in the team timezone.
- **Manager 1:1 cadence** — default **weekly, 30 minutes**, created as a recurring series.

Peer intros are one-offs; only the manager 1:1 recurs. Record both under `one_on_ones`.

---

## Step 4 — Slack channels

**If a Slack MCP is connected:** list public channels the manager belongs to and present them
`multiSelect: true`, most-recently-active first. Store `id` and `name` — **the id is what matters**,
because channels get renamed and a name lookup will start failing silently.

**If not connected** (the common case): say so in one line, then ask for a pasted list of channel names.
Store them with `"id": null`. `/onboard` resolves ids on the first run where Slack *is* connected and
writes them back.

Ask which are `required` (every hire) versus optional. Note privacy per channel:

> [!NOTE]
> Private channels can only be joined by an existing member, and adding someone who is not yet in the
> workspace at all is a different, admin-gated operation. Mark private channels now so `/onboard`
> reports them accurately instead of failing at execution time.

---

## Step 5 — Jira

If Atlassian is connected, call `getAccessibleAtlassianResources` and offer the real sites. Otherwise
ask for the site hostname.

Collect: **site**, **project key**, and the **issue type** for onboarding tickets (default `Task`).

Then the part worth getting right — **how `/onboard` finds the pre-planned first ticket**:

| `discovery` | How it works | Recommendation |
| --- | --- | --- |
| `label` | JQL for an unassigned issue in the project carrying a label, default `onboarding-first-task` | **Recommended.** Unambiguous, and the manager can prepare it weeks early |
| `ask` | `/onboard` asks for a ticket key each run | Fine for managers who don't want a convention |
| `none` | Skip entirely | For teams whose first task is decided in week one |

Steer toward `label`. Free-text searching for "onboarding" finds retrospectives, old tickets, and other
hires' work, and assigning the wrong ticket to a new hire is a genuinely bad first impression.

---

## Step 6 — GitHub

Collect the **org slug** and the **team slugs** the hire should join.

If `gh` is available, offer real values: `gh api /user/orgs --jq '.[].login'`, then
`gh api /orgs/<org>/teams --jq '.[].slug'`. Otherwise ask.

Say this plainly rather than discovering it at execution time:

> [!WARNING]
> Adding someone to a team needs **org owner or team maintainer** rights. Many EMs have neither. If
> `gh api /orgs/<org>/teams/<team>/memberships/<user> --method PUT` is going to 403, it is better to
> know now — `/onboard` will emit it as a manual task instead.
>
> Two more things that bite: on SSO-protected orgs, membership stays pending until the hire
> authorizes, and **GitHub usernames cannot be resolved from an email address**, so `/onboard` has to
> ask for it per hire. There is no way around either.

---

## Step 7 — Figma

Skip silently if `whoami` failed in step 0.

Call `mcp__claude_ai_Figma__whoami`, present the returned teams `multiSelect: true`, and note the seat
tier each one reports.

Store `"mode": "request"` and ask for an **admin contact**. That mode is not a placeholder for
something better later:

> [!IMPORTANT]
> **Figma access cannot be automated from here, and this is not a gap to work around.** The Figma MCP
> is a design-file interface — it reads files, exports assets, and creates designs. It has no
> member-invite or admin capability. Figma's public REST API has no invite endpoint either;
> provisioning is SCIM, on Enterprise plans only. Seats also cost money, and invite rights normally
> belong to design or billing rather than to an engineering manager.
>
> So `/onboard` drafts a request to the admin contact. Every run. That is the ceiling, and pretending
> otherwise would produce a command that fails at the last step of every onboarding.

---

## Step 8 — Onboarding content in Notion (optional)

Skip if Notion is unavailable.

This is where the *words* live — the "Meet the Team" checklist body, welcome text, links to team docs.
`/onboard` renders it into ticket descriptions and the welcome email.

**Do not ask the user to hand-build a page and paste the URL.** Offer to scaffold one with
`notion-create-pages` from this template, so its shape and this command's expectations cannot drift
apart. Store the URL as `content_page_url`.

```markdown
# Onboarding — <Team Name>

## Meet the Team
<!-- onboarding/v1:meet-the-team -->
Checklist items become the body of the "Meet the Team" ticket.
- [ ] 1:1 with each teammate — ask what they own and what they'd change
- [ ] Read the team charter and last quarter's retro
- [ ] Get the dev environment running end to end
- [ ] Ship something small — a typo fix counts

## Welcome message
<!-- onboarding/v1:welcome -->
Text here becomes the body of the drafted welcome email.

## Links
<!-- onboarding/v1:links -->
- Team charter — <url>
- On-call runbook — <url>
```

The `onboarding/v1:` comments are section markers. `/onboard` reads sections **by marker, not by
heading text**, so the user can rename headings freely. If a marker is missing, that section is skipped
without complaint.

> [!NOTE]
> This page is *content*, not config. `/onboard` never parses it for IDs or settings. Prose that a
> teammate might reformat is a bad place to keep an event ID, which is exactly why config is JSON and
> this is not.

---

## Step 9 — Write and confirm

Write `config.json` using the round-trip above, then print a compact summary — this is the one place a
full report is warranted, because the user is confirming work they will not see again until a hire starts:

```
✅ Onboarding config saved — ~/.claude/onboarding-pipeline/config.json

Ceremonies    5  (2 direct · 2 via organizer request · 1 covered by group)
1:1 partners  4  (max 2/day across 10 working days)
Slack         6 channels (2 private)
Jira          ENG · first task found by label `onboarding-first-task`
GitHub        company/core-platform
Figma         request mode → design-admin@company.com
Content       Onboarding — Core Platform

Next: /onboard "Priya Raman"
```

Name anything that will need a human at run time, so it is not a surprise later:

```
Will need you or someone else at run time
- Google Group core-platform@company.com — needs Workspace admin
- 2 ceremonies organized by others — you'll get drafted emails to send
- Figma — always a request to design-admin@company.com
```

Then offer `--sync-notion` in one line. Do not run it unasked.

### Re-runs are merges, never replacements

On a re-run, pre-select what is already in the config and **write back the union of old and new**. A
manager re-running this after adding one ceremony must not lose their Jira and GitHub settings because
those steps were skipped this time.

If a stored ceremony's `recurring_event_id` no longer resolves, keep it, mark it `"stale": true`, and
say which one. Deleting a user's config entry because a calendar query was scoped narrowly is not
recoverable; flagging it is.
