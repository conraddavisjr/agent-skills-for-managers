# skills

Reusable commands for AI coding agents — Claude Code, Cursor, Windsurf, and anything else that reads markdown instructions.

Each command is a single markdown file: YAML frontmatter declaring what it does and which tools it may use, followed by step-by-step instructions the agent follows.

## Install

```bash
npx github:conraddavisjr/agent-skills
```

That installs every command into `.claude/commands/` in the current project. No npm account, no global install, nothing to keep up to date — it pulls straight from this repo.

Install just one:

```bash
npx github:conraddavisjr/agent-skills feedback-os-add-team-member
```

See what's available first:

```bash
npx github:conraddavisjr/agent-skills --list
```

### Options

| Flag | Effect |
| --- | --- |
| `-t, --target <agent>` | `claude` (default), `cursor`, `windsurf`, `generic` |
| `--dir <path>` | Install to an explicit directory |
| `-g, --global` | Install to your home directory instead of this project |
| `-f, --force` | Overwrite files that already exist |
| `-l, --list` | List available commands and exit |

Existing files are never overwritten unless you pass `--force`.

After installing into Claude Code, restart it and the commands appear as slash commands.

---

## Commands

### `/feedback-os-add-team-member`

Onboards a new direct report into **Feedback OS**, a Notion template for managers who log observations about their team over time.

Adding someone by hand means creating four linked things in the right order — a profile card, a year page, a filtered view on that year page, and a tab on the Observations database. Notion can't auto-create a view when you add a row, so this is otherwise a repetitive chore every time someone joins. The command does all four, then verifies the filter actually took.

**You say:** *"Add Priya to my team, she's a senior designer starting Monday."*

**It does:**

1. Finds your Feedback OS databases (by search — it never assumes IDs, so it works in any workspace)
2. Creates her profile card, generating a circular avatar if you don't supply a photo
3. Creates her year page
4. Adds a view filtered to just her observations for that year
5. Adds her tab to the Observations database
6. Confirms the filter returns her rows and nobody else's

**Requires:** the [Notion MCP connector](https://www.notion.so/help/notion-mcp) and a copy of the Feedback OS template.

> **Get the template:** <!-- NOTION_TEMPLATE_URL --> *(link coming — the template is still being finalized)*

The command also carries the non-obvious lessons from building the template, so the agent doesn't rediscover them the hard way. Most importantly: **Notion's view API silently discards filters on relation properties.** No error is raised — you just get a view showing everyone. The template works around this with a text column, and the command explains when and why.

---

### `/pr-assignments-slack`

Composes and posts a PR review focus message to Slack for the current sprint's Peer Review tickets.

Cross-references Jira against open GitHub PRs, matches them by branch name, then assigns reviewers using per-engineer profiles — team eligibility, story-point capacity, co-reviewer requirements — while skipping anyone who's out based on the team's time-off calendar. Shows you the message and waits for approval before posting.

**Requires:** the Atlassian, Slack, and Google Calendar MCP connectors, plus the `gh` CLI. Engineer profiles and channel IDs inside the file are specific to one team — fork and edit before using.

---

## Writing your own

Drop a markdown file in the repo root:

```markdown
---
description: One sentence on what this does and when to use it. This is what the agent matches against, so mention the phrases a user would actually say.
allowed-tools:
  - mcp__some__tool
  - Bash(git status *)
---

# /your-command-name

Instructions, in order.
```

The installer picks it up automatically — the filename becomes the command name, and `description` is what shows in `--list`. `README.md` is ignored.

Two things worth doing:

- **Write for an agent, not a person.** Name exact tools, exact parameters, exact property names. Ambiguity gets guessed at.
- **Record what you learned the hard way.** API quirks, silent failures, conventions that matter. That knowledge is the real value — it's why the next run doesn't repeat your debugging.

## License

MIT
