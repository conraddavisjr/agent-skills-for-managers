---
description: Compose and post a PR review focus message to #scrum-the-bridge for the current sprint's Peer Review tickets. Cross-references Jira with open GitHub PRs, applies engineer profiles and availability checks, and produces the formatted Slack message.
allowed-tools:
  - Bash(gh pr list *)
  - mcp__claude_ai_Atlassian__getAccessibleAtlassianResources
  - mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql
  - mcp__claude_ai_Slack__slack_send_message
  - mcp__claude_ai_Google_Calendar__list_events
  - mcp__claude_ai_Google_Calendar__list_calendars
---

# /pr-slack-report

Compose and post a PR review focus message to #scrum-the-bridge. Follow every step in order.

---

## Step 1 — Resolve Jira Cloud ID

Call `mcp__claude_ai_Atlassian__getAccessibleAtlassianResources`. Find the resource whose URL contains `govspend` and note its `id` as **cloudId**.

If not found, tell the user to check Atlassian MCP auth and stop.

---

## Step 2 — Fetch Jira "Peer Review" Tickets

Call `mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql`:

```json
{
  "cloudId": "<cloudId>",
  "jql": "project = GS AND status = 'Peer Review' AND sprint in openSprints() ORDER BY updated DESC",
  "fields": ["summary", "status", "customfield_10001", "customfield_10016"],
  "maxResults": 100
}
```

For each ticket, store:
- **key** → ticket ID (e.g. GS-15600)
- **summary** → ticket title
- **url** → `https://govspend.atlassian.net/browse/{key}`
- **team** → `customfield_10001.name` (e.g. "AI Platform", "Greenfield", "Federal", "WebApp")
- **storyPoints** → `customfield_10016` (default to `0` if null/absent)
- **isHotfix** → `true` if the word "hotfix" appears anywhere in the summary (case-insensitive)

Store as **jiraTickets** (map: key → { summary, url, team, storyPoints, isHotfix }). If empty, tell the user and stop.

---

## Step 3 — Fetch Open GitHub PRs

Run sequentially:

```bash
gh pr list -R smartprocure/spark --state open --limit 200 --json number,title,url,headRefName,author,reviewRequests,latestReviews,reviewDecision,isDraft,state
gh pr list -R smartprocure/spark-mcp --state open --limit 200 --json number,title,url,headRefName,author,reviewRequests,latestReviews,reviewDecision,isDraft,state
gh pr list -R smartprocure/contexture --state open --limit 200 --json number,title,url,headRefName,author,reviewRequests,latestReviews,reviewDecision,isDraft,state
```

Tag each PR with its repo name. Combine into **allPRs**. Skip any repo that fails auth.

---

## Step 4 — Cross-Reference by Branch Name

For each non-draft PR, extract the Jira ticket ID from `headRefName` using `^(GS-\d+)` (case-insensitive, uppercase result).

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
   - If `isHotfix == true` → Alejandro Hernandez is always eligible regardless of team; also include engineers normally eligible for that team
   - Otherwise, filter engineers by team eligibility per their profile
   - Remove: PR author, bots (`augmentcode`, `copilot-pull-request-reviewer`, `github-actions`, any login containing `[bot]`)
   - Remove engineers in **unavailableEngineers**
   - Remove engineers where `pointsUsed[login] + storyPoints > their effective cap`
   - Apply special co-reviewer rules:
     - **Kasey** (kpasqualini): only assign if José (JBezerra) or JP (jhuaco-govspend) is also being assigned to the same PR
     - **Marc** (lusid): only assign if José (JBezerra) or JP (jhuaco-govspend) is also being assigned to the same PR; effective cap is 0 if neither is co-assigned
3. **Select up to 2 engineers** — sort candidates by the following priority, then pick the top 2:
   - **Tier 1 — sole/specialized primary**: The ticket's team is this engineer's only or defining primary team. These engineers are always preferred first.
     - Greenfield → Yasmani Avila (yavilagovspend)
     - AI Platform → Juan Pablo Huaco (jhuaco-govspend)
     - Federal → Sandhya Govindaraju (sandhya-spend)
   - **Tier 2 — shared primary**: The ticket's team is listed as primary, but the engineer covers multiple primary teams (e.g. José covers Greenfield + AI Platform; Pranita covers Greenfield + Federal + AI Platform; Alejandro covers Greenfield + Federal + WebApp)
   - **Tier 3 — secondary / overflow / exception**: Secondary, overflow, or named-exception eligibility (e.g. Yasmani for AI Platform overflow, Alejandro for Federal secondary, Sandhya for WebApp CRM exceptions)
   - **Tier 4 — tertiary**: Alejandro for WebApp (non-DS, non-hotfix)
   - Within the same tier, sort by remaining capacity (cap − pointsUsed) descending
   - For Alejandro: use 20 as the base cap. Only expand to 30 if no other eligible engineers remain for a given PR
4. **Add storyPoints** to pointsUsed for each selected engineer
5. Store selected reviewers as `{ login, role: "selected" }` for this PR

### Post-Processing Alerts

After all PRs are processed, collect:
- Any engineer where `pointsUsed >= cap` → ⚠️ capacity warning
- Any PR where no reviewers could be selected (all eligible were over cap, unavailable, or excluded) → ⚠️ no reviewers available

---

## Engineer Profiles

Engineers not listed here are **excluded from auto-assignment**.

---

### Alejandro Hernandez
- **GitHub:** stellarhoof | **Slack:** U02N8C1SREJ
- **Level:** Staff Engineer
- **Story point cap:** 20 (expandable to 30 only when no other eligible engineers remain for a given PR)
- **Eligible teams:** Greenfield (primary), Federal (secondary), WebApp (tertiary)
- **Rules:**
  - **Hotfix tickets take top priority** — assign Alejandro to any PR whose Jira ticket title contains "hotfix" (case-insensitive), regardless of team
  - For non-hotfix PRs, assign in priority order: Greenfield → Federal → WebApp
  - Only expand cap from 20 to 30 when all other eligible engineers are at capacity or unavailable
  - **WebApp limit:** Assign Alejandro to a maximum of **1 WebApp PR per run**. Exceptions: (1) the ticket involves a Design System change, or (2) no other eligible engineers are available for that WebApp PR

---

### Juan Pablo Huaco (JP)
- **GitHub:** jhuaco-govspend | **Slack:** U09JSQ2DTT3
- **Level:** Senior Engineer — high-performing IC
- **Story point cap:** 18
- **Eligible teams:** AI Platform
- **Rules:**
  - Favor for large/complex tickets (high story points)
  - Can also take smaller tasks
  - Acts as required lead co-reviewer for Kasey Pasqualini and Marc Melvin

---

### José Bezerra
- **GitHub:** JBezerra | **Slack:** U071WSRFJD8
- **Level:** Top engineer
- **Story point cap:** 20
- **Eligible teams:** Greenfield (primary), AI Platform (primary), WebApp Design System tickets (eligible)
- **Rules:**
  - Strong preference for complex PRs implementing architectural changes
  - Eligible for WebApp Design System tickets in addition to Greenfield and AI Platform
  - Acts as required lead co-reviewer for Kasey Pasqualini and Marc Melvin

---

### Yasmani Avila
- **GitHub:** yavilagovspend | **Slack:** U09JD13RYHK
- **Level:** Senior Engineer
- **Story point cap:** 18
- **Eligible teams:** Greenfield (primary — sole specialization), AI Platform (overflow only)
- **Rules:**
  - Greenfield is Yasmani's sole primary focus — he is **Tier 1** for all Greenfield PRs and should always be selected before engineers who cover Greenfield alongside other teams
  - Eligible for AI Platform only when Greenfield PRs are already covered (Tier 3 for AI Platform)

---

### Sandhya Govindaraju
- **GitHub:** sandhya-spend | **Slack:** U0786NNGD3K
- **Level:** Senior Engineer — Federal team lead
- **Story point cap:** 18
- **Eligible teams:** Federal (primary), WebApp (exceptions only: Saved Searches, AI panel, core table/filter changes, Exports feature)
- **Rules:**
  - Default to Federal tickets
  - WebApp eligibility is limited to the CRM-related exceptions listed above

---

### Pranita Bhadviya
- **GitHub:** PranitaJainB | **Slack:** U0726F8PZ1C
- **Level:** QA Engineer — high review volume
- **Story point cap:** 26
- **Eligible teams:** Greenfield (highest priority), Federal (second), AI Platform (third)
- **Rules:**
  - Prioritize: high-priority bugs → major project tickets (stories with parent Epic) → one-off tickets

---

### Kasey Pasqualini
- **GitHub:** kpasqualini | **Slack:** U02NR58JJ86
- **Level:** Senior Software Engineer
- **Story point cap:** 18
- **Eligible teams:** AI Platform only
- **Rules:**
  - Can handle high volumes of small tickets
  - Can review large/complex tickets **only if** José Bezerra (JBezerra) or Juan Pablo Huaco (jhuaco-govspend) is also assigned as a reviewer on the same PR
  - Do not assign without a lead co-reviewer (JP or José) on any complex or high-point PR

---

### Marc Melvin
- **GitHub:** lusid | **Slack:** U02NTH868BB
- **Level:** AI Developer — uses AI to conduct reviews; high volume, cursory quality
- **Story point cap:** 30 (conditional — see rules)
- **Eligible teams:** AI Platform only
- **Rules:**
  - Do not assign as sole senior reviewer on any PR
  - Cap of 30 applies **only if** Juan Pablo Huaco (jhuaco-govspend) or José Bezerra (JBezerra) is also assigned on those same PRs
  - If neither JP nor José is co-assigned, effective cap is 0 — do not assign

---

## GitHub Login → Slack User ID Mapping

Use this mapping to convert GitHub logins to Slack user IDs for mentions. If a login is not in this table, fall back to `@{login}` (plain text).

| GitHub Login | Slack User ID |
|---|---|
| kpasqualini | U02NR58JJ86 |
| jhuaco-govspend | U09JSQ2DTT3 |
| conraddavisjr | U06CLD11FML |
| dshishkov | U02NF408Q0K |
| JBezerra | U071WSRFJD8 |
| yavilagovspend | U09JD13RYHK |
| manuelluques-govspend | U09LPSM5FK9 |
| cescudero-dev | U0A6TKS868H |
| sandhya-spend | U0786NNGD3K |
| nico-olivares | U02NTN1AV09 |
| PranitaJainB | U0726F8PZ1C |
| petelis | U03CHHSUXAQ |
| mhussain110 | U09CALJ0PSB |
| mperez-govspend | U09JT340Z25 |
| lusid | U02NTH868BB |
| stellarhoof | U02N8C1SREJ |
| jcruz-code | U0B4E3CK351 |

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

> "Here is the Slack message ready to post to #scrum-the-bridge. Reply **yes** to post, **edit** to revise, or **no** to skip."

- **yes** → call `mcp__claude_ai_Slack__slack_send_message` with `channel_id: "C08HKGM4GU9"` and the message. Confirm: "Posted ✓"
- **edit** → ask for revised text, confirm again before posting
- **no** → "Skipped."
