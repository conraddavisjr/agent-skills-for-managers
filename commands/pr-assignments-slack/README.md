# `/pr-assignments-slack` — route the sprint's PR reviews

Works out who should review each open pull request this sprint, then posts the round-up to
Slack for you to approve before it sends.

The problem it solves is that reviewer assignment is a scheduling problem people solve from
memory. The same two names get tagged because they came to mind, someone on holiday gets
assigned anyway, and the engineer who quietly absorbed 40 points of review last sprint absorbs
40 more. This reads the actual state of Jira, GitHub, and your team's time-off calendar, and
routes by capacity instead.

## What a run looks like

```
Hey crew!! Here's the PR review focus:

• Fix export timeout on large result sets - @maya :white_check_mark: @dev
• Add saved-search pagination - @sam :eyes: @jordan
• hotfix: null guard in billing webhook - @alex
• Refactor filter tree traversal - @priya @sam

⚠️ sam has reached their review capacity (18/18 pts)
⚠️ Migrate legacy auth adapter — no reviewers available (all engineers at capacity or unavailable)
```

Approvers are marked ✅, people who've already commented 👀, and the rest are the assignment.
Nothing posts until you reply **yes** — you can also say **edit** to revise it first.

> **Screenshot of the real thing in Slack:** *(to come)*

## How it works

Four systems, in order:

| Step | System | What it takes |
| --- | --- | --- |
| 1–2 | **Jira** | Tickets in `Peer Review` on the current sprint, with their team and story points |
| 3 | **GitHub** | Open PRs across your repos, with reviewers and approval state |
| 4 | — | Matches the two by branch name (`<PROJECT>-1234` at the start of the branch) |
| 5 | **Google Calendar** | Today's entries on your time-off calendar, to exclude anyone away |
| 6 | — | Selects up to two reviewers per PR (this is where the profiles matter) |
| 7–8 | **Slack** | Composes the message, shows it to you, posts on approval |

A PR with **two or more approvals already** is called out as done rather than assigned more
reviewers, and doesn't consume anyone's capacity.

## The part you have to write: `team-config.md`

**The command assigns nobody until you edit this file.** Engineers not described there are
excluded from selection entirely — that's deliberate, so it can't guess at people it knows
nothing about.

Everything in `team-config.md` ships as a **placeholder in angle brackets** and will not
resolve against your systems:

- `<your-site>`, `<PROJECT>`, `<org>/<repo-a>`, `<SLACK_CHANNEL_ID>` — your workspace
- `<github-login-1>`, `<slack-user-id-1>` — your engineers

The IDs were stripped on purpose. A GitHub login or Slack member ID from someone else's
company doesn't half-work; it fails, or worse, mentions a stranger. The command is written to
**stop and name the unset value** rather than call an API with a literal `<PROJECT>`.

### Why a profile is prose, not a config row

The agent doesn't run a scoring algorithm — it reads what you wrote about each person and
applies it. So a profile is written the way you'd brief a new manager taking over your team:

```markdown
### Engineer 3 — the lead co-reviewer

- **GitHub:** `<github-login-3>` | **Slack:** `<slack-user-id-3>`
- **Level:** Senior Engineer — high-performing IC
- **Story point cap:** 18
- **Eligible teams:** Data
- **Rules:**
  - Favour for large or complex tickets; can also absorb small ones
  - Acts as the required lead co-reviewer for Engineer 4
```

Five fields carry the weight:

| Field | What the agent does with it |
| --- | --- |
| **GitHub** | Matches the login on a PR, so it can exclude authors and spot existing reviews |
| **Slack** | Turns the assignment into a real mention. A missing ID falls back to plain text, which notifies nobody |
| **Story point cap** | The budget for one run. Once a PR's points would exceed it, they stop being eligible |
| **Eligible teams** | Which tickets they can review, and how strongly — the words *primary*, *sole specialization*, *secondary*, *overflow*, and *tertiary* map onto the Tier 1–4 sort in Step 6 |
| **Rules** | Free prose for everything else: hotfix priority, per-run limits, required co-reviewers, caps that only apply under a condition |

The five archetypes shipped in the file each demonstrate a different rule the selection logic
understands — a generalist lead, a single-team specialist, a lead co-reviewer, a supervised
reviewer whose cap collapses to zero without their lead, and a high-volume reviewer. Keep the
shapes, replace the people, delete what you don't need.

Two failure modes worth knowing, both called out in the file itself:

- **Delete a lead co-reviewer without deleting the requirement that names them**, and the
  engineer who depended on them becomes permanently unassignable.
- **Leave the login → Slack ID table unedited**, and the message mentions nobody.

### Keeping your real config out of git

`team-config.md` is the version that ships. If you'd rather your actual roster never left your
machine, put it in `team-config.local.md` beside it — the installer uses that instead when it
exists, and `*.local.md` is gitignored.

```
commands/pr-assignments-slack/
  team-config.md          committed, generic
  team-config.local.md    yours, ignored by git
```

## What you need

The **Atlassian**, **Slack**, and **Google Calendar** MCP connectors, plus the `gh` CLI
authenticated against your repos. A run touching only some of them will fail partway; the
command skips repos that fail auth but needs Jira and Slack to do anything useful.
