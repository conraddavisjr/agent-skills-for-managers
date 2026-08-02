---
description: Run the onboarding pipeline for a new hire — add them to recurring ceremonies, schedule 1:1s with the team, file their first two Jira tickets, invite them to Slack channels, and add them to GitHub teams. Reads the config written by /onboard-setup. Use when the manager says "/onboard <name>", "onboard our new hire", or "set up week one for <name>".
argument-hint: <full name> [email] [start date] [github username]
example: "/onboard Priya Raman, priya@company.com, starting Aug 10, github pri-raman"
allowed-tools:
  - Read
  - AskUserQuestion
  - Bash(python3 -c ' *)
  - Bash(gh api *)
  - mcp__claude_ai_Google_Calendar__list_calendars
  - mcp__claude_ai_Google_Calendar__list_events
  - mcp__claude_ai_Google_Calendar__get_event
  - mcp__claude_ai_Google_Calendar__create_event
  - mcp__claude_ai_Google_Calendar__update_event
  - mcp__claude_ai_Google_Calendar__suggest_time
  - mcp__claude_ai_Gmail__create_draft
  - mcp__claude_ai_Notion__notion-fetch
  - mcp__claude_ai_Notion__notion-create-pages
  - mcp__claude_ai_Slack
  - mcp__claude_ai_Atlassian
---

# /onboard

Run the onboarding pipeline for one new hire. Follow every step in order.

**This command contacts real people.** Calendar invitations email their recipients the moment they are
written, and there is no undo. Nothing in this command writes to any system before the confirmation
gate in step 4, and that ordering is not negotiable — do not "just add the easy ones first" while
gathering the rest.

Everything site-specific comes from `~/.claude/onboarding-pipeline/config.json`, written by
`/onboard-setup`. This file contains no company names, project keys, or channel IDs, and must never
acquire any.

## Whenever you stop, say how to get unstuck

Several steps below halt deliberately — missing config, an unresolvable hire, a dead connector. Every
one must end with the fix, not just the diagnosis.

For anything that looks like this file disagreeing with reality — a tool name that no longer exists, a
field the API stopped returning — remember that **you are a snapshot**. This file was rendered at
install time and has not changed since; the repo has. Just under the frontmatter is a comment reading
`<!-- Installed <date> from <repo>@<ref> -->`. Read it, quote the date, and give the update command
verbatim:

```
npx github:conraddavisjr/agent-skills-for-managers onboard --force
```

`--force` is required — without it the installer sees the existing file and skips it silently. After
updating, the user must restart their agent before the new version is read. If the stamp is absent, the
copy predates stamping and is definitely stale.

This does **not** apply to missing config (that is `/onboard-setup`), an unprovisioned account, or a
permission the manager doesn't hold. Reinstalling fixes none of those.

---

## Step 0 — Load config

`Read` `~/.claude/onboarding-pipeline/config.json`.

**If it is missing**, stop and say exactly this — do not attempt to gather config inline, because a
wizard improvised mid-onboarding is how people end up with half-configured pipelines:

```
No onboarding config yet. Run /onboard-setup first — it discovers your
ceremonies, channels, and project settings, and takes about two minutes.
```

If `version` is greater than 1, this command is older than the config. Say so, quote the install
stamp, offer the update command, and stop.

Treat any `null` section as "this manager does not use that system." Skip it silently. A team without
Figma should never see the word Figma.

---

## Step 1 — Resolve the hire

Parse `$ARGUMENTS` first and ask only for what is genuinely missing.
`/onboard Priya Raman, priya@company.com, starting Aug 10, github pri-raman` is complete — ask nothing.

Full name is the only hard requirement. If it is absent, emit a two-line prompt with a fill-in example
and stop:

```
Who's starting? For example:
/onboard Priya Raman, priya@company.com, starting Aug 10
```

Otherwise, **one** `AskUserQuestion` covering only the gaps, max four questions:

| Field | Notes |
| --- | --- |
| **Work email** | The identity every other system keys off. Required to do anything useful |
| **Start date** | Anchors the 1:1 scheduling window. Accept natural language |
| **GitHub username** | Only if `github` is configured. **Cannot be derived from email** — GitHub does not expose that lookup. Ask, or mark GitHub manual |
| **Slack member ID** | Only if Slack is connected and lookup by email failed |

Derive the receipt slug from the name: lowercase, non-alphanumerics to hyphens (`priya-raman`).

---

## Step 2 — Load the receipt and resolve identity

### The receipt

`Read` `~/.claude/onboarding-pipeline/hires/<slug>.json`. Absent means first run.

```jsonc
{
  "name": "Priya Raman",
  "email": "priya@company.com",
  "start_date": "2026-08-10",
  "github_username": "pri-raman",
  "slack_user_id": "U…",
  "jira_account_id": "…",
  "actions": {
    // key is "<kind>:<target>" — this is the idempotency key
    "ceremony:abc123recurringid": { "status": "done", "at": "2026-08-03T14:02:11Z" },
    "one_on_one:sophia@company.com": { "status": "done", "event_id": "evt_…" },
    "jira:meet-the-team": { "status": "done", "issue_key": "ENG-4417" },
    "slack:C0123ABC": { "status": "manual_required", "reason": "Slack not connected" },
    "github:core-platform": { "status": "failed", "reason": "403 — needs org owner" }
  }
}
```

`status` is one of `done`, `skipped`, `failed`, or `manual_required`.

> [!IMPORTANT]
> **Only `done` suppresses an action.** `failed` and `manual_required` are explicitly retried on the
> next run — that is the whole point of re-running once the hire's Slack account exists or an admin
> has granted access. A run that skipped GitHub because it 403'd last Tuesday would be useless.

### Identity resolution

Resolve what you can, and let the rest degrade rather than stopping:

| System | How | If unresolved |
| --- | --- | --- |
| Slack | lookup by email | Every Slack action → `manual_required` |
| Jira | `lookupJiraAccountId` by email | Ticket is still created, just **unassigned** |
| GitHub | the username the user supplied | GitHub actions → `manual_required` |

> [!NOTE]
> **Missing identity is normal, not an error.** Managers run this before IT has finished provisioning,
> which is exactly when it is most useful. Report unresolved accounts once, in the dry run, as
> something to pick up on a later run — never as a failure, and never as a reason to stop.

---

## Step 3 — Build the plan

Compute every action without executing any of them.

### Ceremonies

For each entry in `ceremonies`, `get_event` on the `recurring_event_id` to confirm it still exists and
the hire is not already an attendee.

| `add_via` | Planned action |
| --- | --- |
| `direct` | `update_event` on the series, appending the hire to `attendees` |
| `request_organizer` | Gmail draft to `organizer` asking them to add the hire |
| `group` | Manual task — Workspace admin required |

Already an attendee → `done`, no action. Event 404s → `skipped`, and note it is stale in config.

### 1:1s

Skip any peer already recorded `done`. For the rest, `suggest_time` across the window starting the
first working day on or after `start_date`, honoring `max_per_day`, `work_hours`, and the team timezone.

- **Manager 1:1** — recurring series at the configured cadence.
- **Peer intros** — single events, titled `<Hire> ↔ <Peer> — intro`.

Spread them. Four intro calls on day one is a worse first day than four spread across two weeks, which
is why `max_per_day` defaults to 2.

### Jira

1. **Meet the Team** — always planned unless `done`. Body comes from the `onboarding/v1:meet-the-team`
   section of the Notion content page; if that page is unset or the marker is absent, use a sensible
   default checklist rather than failing.
2. **The pre-planned first task** — resolved per `first_task.discovery`:
   - `label` → JQL: `project = <key> AND labels = <label> AND assignee IS EMPTY ORDER BY created DESC`.
     Take the most recent. More than one match → name them and ask.
   - `ask` → ask for a key.
   - `none` → skip.

> [!IMPORTANT]
> **If no first task is found, nudge once and move on.** Exactly one line, offered as a choice, never
> repeated and never blocking:
>
> ```
> No first task found with label `onboarding-first-task`. Want me to create a
> placeholder you can fill in later, or skip it? Either is fine.
> ```
>
> A manager who has not planned the first ticket three days before a start date knows that. The value
> here is the reminder, not the enforcement — do not ask twice, do not warn about it in the summary,
> and never hold up the rest of the run for it.

### Slack, GitHub, Figma

- **Slack** — per channel: invite if connected and identity resolved, else `manual_required`. Private
  channels the manager isn't in are `manual_required` regardless.
- **GitHub** — `gh api /orgs/<org>/teams/<team>/memberships/<username> --method PUT` per team.
- **Figma** — always a drafted request to `admin_contact`. Never anything else.

---

## Step 4 — Dry run, then one gate

Print the complete plan grouped by system. Every line carries its verdict, so the manager can see what
is real work versus already handled:

```
Onboarding Priya Raman — priya@company.com — starts Mon Aug 10

Calendar — ceremonies
  ✅ Sprint Planning              already an attendee
  →  Team Retro                   add to series
  ✉️  Engineering All-Hands        draft request to dana@company.com
  👤 Daily Standup                add to core-platform@company.com (Workspace admin)

Calendar — 1:1s
  →  Manager 1:1                  weekly, Tue 09:30, from Aug 11
  →  Sophia Reyes                 Tue Aug 11, 14:00
  →  Marcus Lindqvist             Wed Aug 12, 11:00

Jira (ENG)
  →  Meet the Team                new Task, assigned to Priya
  →  ENG-4390                     assign existing first task

Slack
  👤 #eng-core, #eng-standup      Slack not connected — 4 channels

GitHub
  →  company/core-platform        add to team

Figma
  ✉️  draft request to design-admin@company.com

Gmail
  →  welcome email                draft only, not sent

10 actions · 3 need a human · 1 already done
```

Then, immediately before the gate, state the irreversible part plainly:

> Calendar invitations email their recipients as soon as they're created, and adding an attendee to an
> existing series can notify everyone already on it. Ticket assignment notifies the assignee.

Then ask, once:

> "Reply **yes** to run this, **edit** to change something, or **no** to stop."

- **yes** → execute step 5.
- **edit** → take the change, rebuild the plan, show it again, ask again.
- **no** → `"Stopped. Nothing was changed."` and end.

**Nothing before this point may write to any system.** Not one calendar event, not one draft, not one
ticket. If a run is interrupted here the world is untouched, and that property is worth more than the
few seconds it costs.

---

## Step 5 — Execute

Work through the plan in the order shown. Check-then-act on every action, even ones the plan marked as
new — the plan may be minutes old and someone else may have acted in between.

Emit one line per action as it completes. This is the one command where narrating the work is right:
it is doing things to other people's calendars, and the manager needs to see each one land.

### Calendar

`update_event` on the **series id**, appending to the existing `attendees` array. Send the whole array
— a partial one removes everyone omitted, which is a genuinely bad outcome on a meeting with fifteen
people on it.

Set `sendUpdates` to notify the new attendee only, if the API allows it. Re-notifying an entire
standing meeting every time someone joins the team is noise the manager will get blamed for.

For 1:1s, `create_event` with both parties as attendees. Record the returned event id in the receipt —
it is what makes the next run idempotent.

### Jira

Create **Meet the Team**, then assign the first task if one was resolved. Record issue keys.

If ticket creation succeeds but assignment fails — common when the hire's Jira account isn't
provisioned — record `done` for creation and `manual_required` for assignment, separately. Half-done
work should be recorded as half-done, not rolled back.

### Slack, GitHub

Slack: invite per channel; record each channel independently so one private-channel failure doesn't
mark six as failed. If ids were `null` in config and you resolved them here, write them back to
`config.json` so the next hire's run is faster.

GitHub: `PUT` per team. A 403 means the manager lacks org owner or team maintainer rights — record
`manual_required` with that reason, and do not retry.

### Drafts

Every email is a **draft**. `create_draft` only.

> [!NOTE]
> The Gmail connector exposes `create_draft` and `update_draft` but **no send tool**. Do not look for a
> workaround; this is the correct behavior. A pipeline that autonomously emails a hire's future
> colleagues on their manager's behalf is not something to build, and the drafts sitting in Gmail for
> review is a feature.

Drafts to produce: the welcome email to the hire, one request per `request_organizer` ceremony, and the
Figma admin request. Tell the user how many drafts are waiting.

### When something fails

Record it, say it in one line, and keep going. One 403 on a GitHub team must not abandon the Slack
invites or the 1:1s. Collect failures for the summary.

---

## Step 6 — Write the receipt

Merge results into `~/.claude/onboarding-pipeline/hires/<slug>.json` using the same atomic
`python3 -c` round-trip `/onboard-setup` documents — create the directory, load, merge, `os.replace`.

Write the receipt **even if the run failed partway**. An unwritten receipt turns the next run into a
duplicate-everything run, which is the single worst outcome this command can produce.

---

## Step 7 — Hand off

Close with what happened and what is left, separated by who owns it:

```
✅ Priya Raman — 7 done, 3 need a human

Done
  Team Retro · Manager 1:1 · 2 intro 1:1s
  ENG-4418 Meet the Team · ENG-4390 assigned
  company/core-platform

You need to
  Send 2 drafts in Gmail (All-Hands organizer, Figma admin)
  Add priya@company.com to core-platform@company.com — needs Workspace admin

Blocked until her accounts exist
  4 Slack channels — re-run /onboard "Priya Raman" once she's in Slack

Re-running is safe: finished work is skipped.
```

That last line matters. Managers do not re-run tools they suspect will double-book their team, so the
guarantee has to be stated, not merely implemented.

If Notion is configured, offer — do not automatically create — a page for the hire summarizing the
same thing. Some managers want it; the ones who don't should not have pages appearing in their
workspace uninvited.
