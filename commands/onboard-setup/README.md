# `/onboard-setup` — teach the pipeline about your team

Finds your recurring ceremonies, your team's Slack channels, your Jira project and GitHub teams,
and writes them to a config that [`/onboard`](../onboard) runs on. Two minutes, once — then again
whenever something changes.

This exists because the useful version of an onboarding tool is the one pointed at *your*
infrastructure, and no two teams' infrastructure looks alike. Rather than shipping a config file to
fill in by hand, this reads your calendar and asks you to tick boxes.

**It only reads.** No invitations, no tickets, no messages. That's what makes it safe to re-run, and
re-running is how you update it.

## What a run looks like

```
Google Calendar  ✓    Notion  ✓    Gmail  ✓
Slack  not connected  Jira  not connected  GitHub  no gh CLI

Found 5 recurring meetings on your calendar.
Which should a new hire join?

  [x] Sprint Planning — weekly, Mon 10:00 — you organize (can add directly)
  [x] Team Retro — biweekly, Thu 15:00 — you organize (can add directly)
  [x] Engineering All-Hands — monthly — organized by dana@ (will draft a request)
  [x] Daily Standup — daily — via core-platform@company.com (group covers it)
  [ ] Design Review — weekly — organized by sam@

3 of your ceremonies already carry core-platform@company.com.
Adding a hire to that one group covers all 3 — worth doing first.
```

Then the same for 1:1 partners, ranked by how many of your meetings they're on, and short questions
for Slack, Jira, GitHub, and Figma. Anything you skip is recorded as "not used" and never mentioned
again.

## What it works out for you

**Which meetings you can actually add someone to.** Google Calendar only lets the organizer add a
guest. Your sprint ceremonies are probably yours; the all-hands probably isn't. Each meeting gets
classified now, so `/onboard` drafts an email to the organizer instead of failing later.

**Whether a Google Group already covers it.** If a team alias is on your invites, adding the hire to
that one group subscribes them to every meeting carrying it. This is the single highest-leverage
thing in the whole pipeline and it's easy to forget you have it.

**Series, not occurrences.** Calendar returns ten standups as ten events. Storing the wrong id
invites your hire to exactly one standup — a bug that looks like success until someone notices.

**Who your team actually is.** 1:1 candidates are ranked by how many of your ceremonies they attend,
which is a better signal than an org chart.

## Where it writes

```
~/.claude/onboarding-pipeline/config.json
```

Not in this repo, and not beside the command — everything installed into `.claude/commands/`
becomes a slash command, so config can't live there. Keeping it under `~/.claude/` also means
updating the command never costs you your settings.

It holds your colleagues' names and email addresses. It should not be committed anywhere, and the
command will never offer to.

## Notion is for words, not settings

Optionally scaffolds a Notion page holding the *content* of onboarding — the Meet the Team
checklist, the welcome text, links to team docs. `/onboard` renders it into ticket descriptions and
emails.

Settings stay in JSON. A page a teammate might reformat is a bad place to keep an event ID, and
parsing prose at run time is the most fragile thing this pipeline could do.

Let it create the page rather than building one yourself and pasting the URL — that way its shape
and the command's expectations can't drift apart.

## Flags

| Flag | What it does |
| --- | --- |
| *(none)* | The wizard. Existing answers come back pre-selected |
| `--show` | Print your current config and stop |
| `--sync-notion` | Write a readable copy to Notion for a co-manager to review |
| `--from-notion <url>` | Re-import that copy, then confirm it |

## What you need

The **Google Calendar** connector, authorized with calendar scopes. If it returns
`insufficient authentication scopes`, it's linked but was connected without them — remove and re-add
it. Nothing here works without calendar access, so that's the one hard stop.

Everything else — Notion, Slack, Atlassian, Figma, `gh` — is optional. Whatever isn't connected falls
back to typing the values in by hand, and you can always re-run later once it is.
