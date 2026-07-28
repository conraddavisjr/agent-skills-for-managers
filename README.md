# skills

Reusable commands for AI coding agents: Claude Code, Cursor, Windsurf, and anything else that reads markdown instructions.

Each command is a single markdown file: YAML frontmatter declaring what it does and which tools it may use, followed by step-by-step instructions the agent follows.

## Install

```bash
npx github:conraddavisjr/agent-skills
```

That installs every command into `.claude/commands/` in the current project. No npm account, no global install, nothing to keep up to date — it pulls straight from this repo.

Install just one, by either its filename or the slash command it installs as:

```bash
npx github:conraddavisjr/agent-skills add
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

### `/add`

*File: `feedback-os-add-team-member.md`*

Onboards a new direct report into **Feedback OS**, a Notion template for managers who log observations about their team over time.

Adding someone by hand means creating four linked things in the right order — a profile card, a year page, a filtered view on that year page, and an all-observations view on the profile. Notion can't auto-create a view when you add a row, so this is otherwise a repetitive chore every time someone joins. The command does all four, then verifies the filter actually took.

**You say:** *`/add Priya Raman, senior designer, Design, starting Monday`* — or just `/add` and answer the questions. Everything after `/add` is parsed for a name, role, team, start date, and optionally a Notion URL.

**It does:**

1. Resolves your Feedback OS page and its databases
2. Creates the profile card, generating an avatar if you don't supply a photo
3. Creates the year page
4. Adds a view filtered to just that person's observations for that year
5. Adds an all-observations view to their profile page
6. Confirms the filters return their rows and nobody else's

**Finding your tracker.** The command never assumes database IDs — it resolves them on every run, so it works in any workspace. It tries, in order: a Notion URL you passed in, the pinned `FEEDBACK_OS_TARGET` URL near the top of the command file, a search by name, then a search by *structure* — a tracker is identified by having an Observations database with an `Employee Name` column related to an Employees database, which survives any rename. If nothing matches, or more than one does, it stops and asks you for the link rather than guessing or creating a second tracker.

So renaming your page is fine. To make the rename permanent, edit the URL in the `FEEDBACK_OS_TARGET` comment at the top of the command file; the command offers to do this for you whenever it had to fall back to searching. The pin ships pointing at my tracker, which you can't read — your first run will quietly skip it and search your workspace instead.

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
command: shortname
allowed-tools:
  - mcp__some__tool
  - Bash(git status *)
---

# /shortname

Instructions, in order.
```

The installer picks it up automatically. `description` is what shows in `--list`, and `README.md` is ignored.

| Frontmatter | Effect |
| --- | --- |
| `description` | Shown in `--list`; what the agent matches an ask against |
| `command` | Slash command to bind to. Optional — defaults to the filename |
| `allowed-tools` | Tools the command may use |

`command` exists so a file can keep a descriptive name in this repo while installing as something short you'd actually type: `feedback-os-add-team-member.md` installs as `add.md`, giving you `/add`. Keep these short names distinct — the installed filename wins, so two files claiming the same `command` will collide in `.claude/commands/`.

Two things worth doing:

- **Write for an agent, not a person.** Name exact tools, exact parameters, exact property names. Ambiguity gets guessed at.
- **Record what you learned the hard way.** API quirks, silent failures, conventions that matter. That knowledge is the real value — it's why the next run doesn't repeat your debugging.

## License

MIT
