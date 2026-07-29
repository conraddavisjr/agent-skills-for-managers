---
description: Compose and post a PR review focus message to your team's Slack channel for the current sprint's Peer Review tickets. Cross-references Jira with open GitHub PRs, applies engineer profiles and availability checks, and produces the formatted Slack message.
example: "/pr-assignments-slack"
allowed-tools:
  - Bash(gh pr list *)
  - mcp__claude_ai_Atlassian__getAccessibleAtlassianResources
  - mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql
  - mcp__claude_ai_Slack__slack_send_message
  - mcp__claude_ai_Google_Calendar__list_events
  - mcp__claude_ai_Google_Calendar__list_calendars
---

# /pr-assignments-slack

Compose and post a PR review focus message to your team's Slack channel. Follow every step in order.

This command spans **three systems**: Jira supplies the tickets, GitHub supplies the pull requests, and
Slack is where the result is posted. Google Calendar is consulted for time off. All of them must be
connected before a run can succeed.

Every site-specific value — Jira project, GitHub repos, Slack channel, and the engineer profiles that
drive reviewer selection — lives in the **Workspace** and **Engineer Profiles** sections below. They
ship as placeholders in angle brackets. If you meet one that still looks like `<PROJECT>` or
`<github-login-1>`, stop and tell the user which value is unset instead of guessing.

---

<!-- include: team-config.md -->

---

## Step 1 — Resolve Jira Cloud ID

Call `mcp__claude_ai_Atlassian__getAccessibleAtlassianResources`. Find the resource whose URL contains the **Atlassian site** from Workspace and note its `id` as **cloudId**.

If not found, tell the user to check Atlassian MCP auth and stop.

---

## Step 2 — Fetch Jira "Peer Review" Tickets

Call `mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql`:

```json
{
  "cloudId": "<cloudId>",
  "jql": "project = <PROJECT> AND status = 'Peer Review' AND sprint in openSprints() ORDER BY updated DESC",
  "fields": ["summary", "status", "customfield_10001", "customfield_10016"],
  "maxResults": 100
}
```

For each ticket, store:
- **key** → ticket ID (e.g. `<PROJECT>-1420`)
- **summary** → ticket title
- **url** → `https://<your-site>.atlassian.net/browse/{key}`
- **team** → the Jira team field from Workspace, `.name` (see **Teams** above)
- **storyPoints** → `customfield_10016` (default to `0` if null/absent)
- **isHotfix** → `true` if the word "hotfix" appears anywhere in the summary (case-insensitive)

Store as **jiraTickets** (map: key → { summary, url, team, storyPoints, isHotfix }). If empty, tell the user and stop.

---

## Step 3 — Fetch Open GitHub PRs

Run sequentially:

```bash
gh pr list -R <org>/<repo-a> --state open --limit 200 --json number,title,url,headRefName,author,reviewRequests,latestReviews,reviewDecision,isDraft,state
gh pr list -R <org>/<repo-b> --state open --limit 200 --json number,title,url,headRefName,author,reviewRequests,latestReviews,reviewDecision,isDraft,state
gh pr list -R <org>/<repo-c> --state open --limit 200 --json number,title,url,headRefName,author,reviewRequests,latestReviews,reviewDecision,isDraft,state
```

Run one command per repo listed under **GitHub repos** in Workspace. Tag each PR with its repo name. Combine into **allPRs**. Skip any repo that fails auth.

---

## Step 4 — Cross-Reference by Branch Name

For each non-draft PR, extract the Jira ticket ID from `headRefName` using `^(<PROJECT>-\d+)` (case-insensitive, uppercase result).

**matched** = PRs whose extracted ticket ID is in **jiraTickets**, enriched with ticket data (team, storyPoints, isHotfix).
**ticketsWithoutPR** = Jira tickets with no matching PR.

Sort **matched**: hotfix tickets first → approval count DESC (2+ approval PRs first for exception handling) → pending reviewer count DESC → alphabetically by title.

---

## Step 5 — Check Engineer Availability (Google Calendar)

1. Call `mcp__claude_ai_Google_Calendar__list_calendars` and find the calendar named **"Development Time Off"**. Note its `id`.
2. Call `mcp__claude_ai_Google_Calendar__list_events` for that calendar for today's full date range (start of day → end of day).
3. For each event, check attendees and the event title/description for engineer names. Mark any engineer whose name appears as **unavailable**.
4. Build **unavailableEngineers** (set of GitHub logins). Engineers in this set are excluded from all reviewer assignment.

---

## Step 6 — Select Reviewers Per PR

Initialize **pointsUsed** (map: GitHub login → running total, starting at 0) for every engineer with a defined profile.

Process each PR in **matched** in sorted order:

### Exception: 2+ Approvals

If `latestReviews` contains **2 or more** entries with `state == "APPROVED"` (bots excluded — see bot list below):
- Collect all approver logins, filter bots, map to Slack IDs
- Mark as `multiApproval: true`
- **Do not add to pointsUsed** for this PR
- Skip standard selection below

### Standard Reviewer Selection

1. **Get ticket data** → `team`, `storyPoints`, `isHotfix` from jiraTickets
2. **Build candidate list** using Engineer Profiles:
   - If `isHotfix == true` → include every engineer whose profile grants hotfix priority regardless of team, plus the engineers normally eligible for that team
   - Otherwise, filter engineers by team eligibility per their profile
   - Remove: PR author, bots (`augmentcode`, `copilot-pull-request-reviewer`, `github-actions`, any login containing `[bot]`)
   - Remove engineers in **unavailableEngineers**
   - Remove engineers where `pointsUsed[login] + storyPoints > their effective cap`
   - Apply co-reviewer rules **as written in each profile**: where a profile requires a named lead co-reviewer, that engineer is eligible only if the lead is also being assigned to this same PR. Where a profile's cap collapses to 0 without its lead, treat them as ineligible rather than assigning them alone.
3. **Select up to 2 engineers** — sort candidates into tiers, then pick the top 2. Tier comes from how the engineer's own profile describes the ticket's team, not from any list here:
   - **Tier 1 — sole / specialised primary**: the team is that engineer's only or defining primary focus (a profile saying "sole specialization" or naming exactly one primary team). Always preferred first.
   - **Tier 2 — shared primary**: the team is listed as primary, but the engineer covers several primary teams.
   - **Tier 3 — secondary / overflow / exception**: the team appears as secondary, overflow, or a named exception.
   - **Tier 4 — tertiary**: the team is listed as tertiary.
   - Within the same tier, sort by remaining capacity (cap − pointsUsed) descending
   - Where a profile gives a base cap with a conditional expansion, use the **base** cap; expand only if no other eligible engineer remains for that PR
   - Where a profile sets a per-run limit for a team, respect it across the whole run
4. **Add storyPoints** to pointsUsed for each selected engineer
5. Store selected reviewers as `{ login, role: "selected" }` for this PR

### Post-Processing Alerts

After all PRs are processed, collect:
- Any engineer where `pointsUsed >= cap` → ⚠️ capacity warning
- Any PR where no reviewers could be selected (all eligible were over cap, unavailable, or excluded) → ⚠️ no reviewers available

---

## Step 7 — Compose Slack Message

Include only non-draft PRs from **matched**. Sort: hotfixes first → most pending reviewers → alphabetically.

Format:
```
Hey crew!! Here's the PR review focus:

• <{prUrl}|{prTitle}> - {reviewer_list}
```

**For PRs with multiApproval = true:**
```
• <{prUrl}|{prTitle}> - {approver_slack_mentions} :white_check_mark: — This PR has multiple approvals :rocket:
```

**For standard PRs**, reviewer_list (max 2), in order:
1. Existing approvers (latestReviews, state APPROVED): `<@SLACK_USER_ID> :white_check_mark:`
2. Existing commenters (latestReviews, state COMMENTED or CHANGES_REQUESTED): `<@SLACK_USER_ID> :eyes:`
3. Selected pending reviewers from Step 6: `<@SLACK_USER_ID>`

If no reviewers assigned: `_(no reviewers available)_`

**Append at the bottom** (if any):
```
⚠️ {Name} has reached their review capacity ({pointsUsed}/{cap} pts)
⚠️ {PR title} — no reviewers available (all engineers at capacity or unavailable)
```

---

## Step 8 — Confirm and Post

Display the full message to the user and ask:

> "Here is the Slack message ready to post to #<your-channel>. Reply **yes** to post, **edit** to revise, or **no** to skip."

- **yes** → call `mcp__claude_ai_Slack__slack_send_message` with `channel_id` set to the **Slack channel ID** from Workspace and the message. Confirm: "Posted ✓"
- **edit** → ask for revised text, confirm again before posting
- **no** → "Skipped."
