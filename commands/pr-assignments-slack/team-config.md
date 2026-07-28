## Workspace

Everything in this section is a placeholder. Replace each value before the first run —
none of these will resolve against your systems as shipped.

| Setting | Placeholder | Where to find yours |
| --- | --- | --- |
| Atlassian site | `<your-site>` | The subdomain in `https://<your-site>.atlassian.net` |
| Jira project key | `<PROJECT>` | The prefix on ticket IDs, e.g. `ENG` in `ENG-1420` |
| Jira team field | `customfield_10001` | Field IDs differ per site — check `/rest/api/3/field` |
| Jira story-point field | `customfield_10016` | Same |
| GitHub repos | `<org>/<repo-a>`, `<org>/<repo-b>` | The repos whose PRs you review |
| Slack channel | `#<your-channel>` | Where the message gets posted |
| Slack channel ID | `<SLACK_CHANNEL_ID>` | Channel details → bottom of the About tab |

> [!IMPORTANT]
> If any placeholder is still in angle brackets when the command runs, stop and tell the user
> which one, rather than guessing or calling an API with a literal `<PROJECT>`.

---

## Teams

The team names below are examples. Use whatever values your Jira team field actually returns,
and keep them consistent across every profile.

`Platform` · `Web` · `Data` · `Infra`

---

## Engineer Profiles

**This is the section you are expected to rewrite.** Engineers not listed here are excluded
from auto-assignment entirely, so an unedited file assigns nobody.

Each profile below demonstrates a different rule the selection logic understands. Keep the
shapes; replace the people. Delete any archetype you don't need, and add as many as you like.

Both identifiers are placeholders and will not resolve:

- `**GitHub:**` must be the login exactly as it appears on a PR (`gh pr list` shows it)
- `**Slack:**` must be the member ID like `U01ABCDEF23`, not a display name — profile → ⋮ →
  Copy member ID

---

### Engineer 1 — the generalist lead

- **GitHub:** `<github-login-1>` | **Slack:** `<slack-user-id-1>`
- **Level:** Staff Engineer
- **Story point cap:** 20 (expandable to 30 only when no other eligible engineer remains)
- **Eligible teams:** Platform (primary), Data (secondary), Web (tertiary)
- **Rules:**
  - **Hotfix tickets take top priority** — assign to any PR whose ticket title contains
    "hotfix" (case-insensitive), regardless of team
  - For non-hotfix PRs, assign in priority order: Platform → Data → Web
  - Only expand the cap from 20 to 30 when every other eligible engineer is at capacity or
    unavailable
  - **Web limit:** at most **1** Web PR per run, unless the ticket is a design-system change
    or no one else is eligible

*Demonstrates: multi-team priority ordering, a conditional cap, a per-run team limit, and an
override that ignores team eligibility.*

---

### Engineer 2 — the single-team specialist

- **GitHub:** `<github-login-2>` | **Slack:** `<slack-user-id-2>`
- **Level:** Senior Engineer
- **Story point cap:** 18
- **Eligible teams:** Platform (primary — sole specialization), Data (overflow only)
- **Rules:**
  - Platform is this engineer's sole focus — **Tier 1** for all Platform PRs, always selected
    ahead of engineers who cover Platform alongside other teams
  - Eligible for Data only once Platform PRs are covered (Tier 3 there)

*Demonstrates: the Tier 1 sole-specialist rule that drives the priority sort in Step 6.*

---

### Engineer 3 — the lead co-reviewer

- **GitHub:** `<github-login-3>` | **Slack:** `<slack-user-id-3>`
- **Level:** Senior Engineer — high-performing IC
- **Story point cap:** 18
- **Eligible teams:** Data
- **Rules:**
  - Favour for large or complex tickets; can also absorb small ones
  - Acts as the required lead co-reviewer for Engineer 4

*Demonstrates: an engineer other profiles depend on. If you delete this archetype, delete the
co-reviewer requirement on Engineer 4 too, or Engineer 4 becomes unassignable.*

---

### Engineer 4 — the supervised reviewer

- **GitHub:** `<github-login-4>` | **Slack:** `<slack-user-id-4>`
- **Level:** Engineer — high review volume, lighter depth
- **Story point cap:** 30 (conditional — see rules)
- **Eligible teams:** Data
- **Rules:**
  - Never assign as the sole senior reviewer on a PR
  - The cap of 30 applies **only if** Engineer 3 is also assigned to the same PR
  - If Engineer 3 is not co-assigned, the effective cap is 0 — do not assign

*Demonstrates: a conditional cap that collapses to zero, and a dependency between two
profiles. This is the rule most likely to silently exclude someone, so check it first when an
engineer is never getting picked.*

---

### Engineer 5 — the high-volume reviewer

- **GitHub:** `<github-login-5>` | **Slack:** `<slack-user-id-5>`
- **Level:** QA Engineer — high review volume
- **Story point cap:** 26
- **Eligible teams:** Platform (highest priority), Data (second), Infra (third)
- **Rules:**
  - Prioritise: high-priority bugs → project tickets with a parent epic → one-off tickets

*Demonstrates: a large cap with an ordering preference driven by ticket type rather than team.*

---

## GitHub Login → Slack User ID

Used to turn PR authors and reviewers into Slack mentions. A login missing from this table
falls back to plain text `@login`, which notifies nobody — so an unedited table produces a
message that mentions no one.

| GitHub Login | Slack User ID |
| --- | --- |
| `<github-login-1>` | `<slack-user-id-1>` |
| `<github-login-2>` | `<slack-user-id-2>` |
| `<github-login-3>` | `<slack-user-id-3>` |
| `<github-login-4>` | `<slack-user-id-4>` |
| `<github-login-5>` | `<slack-user-id-5>` |

Add a row for anyone who reviews PRs, including people with no profile above — reviewers who
have already approved still need to be mentioned by ID.
