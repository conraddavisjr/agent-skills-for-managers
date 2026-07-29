# Agent skills for managers

Capture what you notice about your team, route
PR reviews to the people with room to do them, and keep the record straight, from wherever
you already work.

![The feedback loop a manager runs: observe, then a 1:1, then growth, circling back to observe](./assets/hero.svg)

Every command lives in its own folder under `commands/`: a `command.md` with YAML
frontmatter declaring what it does and which tools it may touch, then step-by-step
instructions an agent follows. Each one installs as a single self-contained markdown file,
so they run in Claude Code, Cursor, Windsurf, or anything else that reads markdown
instructions.

## Commands

| What you're doing | Command | Key principle |
| --- | --- | --- |
| Onboarding a new report | `/add` | Build the record before you need it, not the week reviews are due |
| Getting a sprint's PRs reviewed | `/pr-assignments-slack` | Route by who has capacity, not by who's loudest |

## The loop

Engineering has had its loop for decades. Work opens, gets reviewed, ships, and the cycle
starts again — and every stage leaves an artifact you can go back and read.

Management runs the same shape on a longer clock. You notice something, you talk it through
in a 1:1, the person grows, and you notice the next thing. The difference is that the
management loop usually leaves no artifact at all. It lives in memory until review season,
when it gets reconstructed under time pressure from whatever happened most recently.

These skills exist to give the people loop the same paper trail the code loop already has.
That's the whole idea: **the loop you can see is the loop you can improve.**

Routing PR reviews is the other half of the week, and `/pr-assignments-slack` handles it.

## Install

```bash
npx github:conraddavisjr/agent-skills-for-managers
```

Run with no arguments and nothing is installed — you get the list of commands, what each one
does, and an example of using it. Once you know what you want:

```bash
npx github:conraddavisjr/agent-skills-for-managers --all
```

That installs every command into `.claude/commands/` in the current project. No npm account,
no global install, nothing to keep up to date — it pulls straight from this repo.

Install just one, by either its folder name or the slash command it installs as:

```bash
npx github:conraddavisjr/agent-skills-for-managers add
```

### Options

| Flag | Effect |
| --- | --- |
| `-a, --all` | Install every available command |
| `-t, --target <agent>` | `claude` (default), `cursor`, `windsurf`, `generic` |
| `--dir <path>` | Install to an explicit directory |
| `-g, --global` | Install to your home directory instead of this project |
| `-f, --force` | Overwrite files that already exist |
| `-l, --list` | List available commands and exit |

Existing files are never overwritten unless you pass `--force`.

After installing into Claude Code, restart it and the commands appear as slash commands.

---

## Command reference

### `/add`

*Source: [`commands/add-team-member/`](./commands/add-team-member)*

Onboards a new direct report into your Notion team-observation tracker — the place a manager
logs what they noticed about their team over time.

Adding someone by hand means creating four linked things in the right order — a profile card,
a year page, a filtered view on that year page, and an all-observations view on the profile.
Notion can't auto-create a view when you add a row, so this is otherwise a repetitive chore
every time someone joins. The command does all four, then verifies the filter actually took.

**You say:** *`/add Priya Raman, senior designer, Design, starting Monday`* — or just `/add`
and answer the questions. Everything after `/add` is parsed for a name, role, team, start
date, and optionally a Notion URL.

**It does:**

1. Resolves your tracker page and its databases
2. Creates the profile card, generating an avatar if you don't supply a photo
3. Creates the year page
4. Adds a view filtered to just that person's observations for that year
5. Adds an all-observations view to their profile page
6. Reconciles any observations you logged by hand since the last run, so the "last observed"
   and "total observations" rollups stay accurate
7. Confirms the filters return their rows and nobody else's

**Finding your tracker.** The command never assumes database IDs — it resolves them on every
run, so it works in any workspace. It tries, in order: a Notion URL you passed in, the pinned
`TRACKER_TARGET` URL near the top of the command file, a search by name, then a search by
*structure* — a tracker is identified by having an Observations database with an
`Employee` relation to an Employees database, which survives any rename. If nothing
matches, or more than one does, it stops and asks you for the link rather than guessing or
creating a second tracker.

So renaming your page is fine. To make the rename permanent, edit the URL in the
`TRACKER_TARGET` comment at the top of the command file; the command offers to do this for
you whenever it had to fall back to searching. The pin ships pointing at my tracker, which you
can't read — your first run will quietly skip it and search your workspace instead.

**Requires:** the [Notion MCP connector](https://www.notion.so/help/notion-mcp) and a copy of
the template.

> **Get the template:** <!-- NOTION_TEMPLATE_URL --> *(link coming — the template is still being finalized)*

The command also carries the non-obvious lessons from building the template, so the agent
doesn't rediscover them the hard way. Most importantly: **Notion's view API silently discards
filters on relation properties.** No error is raised — you just get a view showing everyone.
The template works around this with a text column, and the command explains when and why.

---

### `/pr-assignments-slack`

*Source: [`commands/pr-assignments-slack/`](./commands/pr-assignments-slack)*

Composes and posts a PR review focus message to Slack for the current sprint's Peer Review
tickets.

Cross-references Jira against open GitHub PRs, matches them by branch name, then assigns
reviewers using per-engineer profiles — team eligibility, story-point capacity, co-reviewer
requirements — while skipping anyone who's out based on the team's time-off calendar. Shows
you the message and waits for approval before posting.

**Requires:** the Atlassian, Slack, and Google Calendar MCP connectors, plus the `gh` CLI.

Everything team-specific — the eight engineer profiles, story-point caps, co-reviewer rules,
and the GitHub-login-to-Slack-ID table — lives in `commands/pr-assignments-slack/team-config.md`,
separate from the procedure in `command.md`. Fork and rewrite that one file; the steps around
it stay as they are. The installer stitches the two back together, so what lands in
`.claude/commands/` is still a single self-contained file.

---

## Writing your own

Make a folder under `commands/` with a `command.md` inside it:

```
commands/
  your-command-name/
    command.md
```

```markdown
---
description: One sentence on what this does and when to use it. This is what the agent matches against, so mention the phrases a user would actually say.
command: shortname
example: "/shortname a realistic argument, as you'd actually type it"
allowed-tools:
  - mcp__some__tool
  - Bash(git status *)
---

# /shortname

Instructions, in order.
```

The installer picks it up automatically — any directory under `commands/` containing a
`command.md` is a command, and directories without one are ignored.

| Frontmatter | Effect |
| --- | --- |
| `description` | Shown in `--list`; what the agent matches an ask against |
| `command` | Slash command to bind to. Optional — defaults to the folder name |
| `example` | One realistic invocation, shown in listings. Optional |
| `allowed-tools` | Tools the command may use |

`command` exists so a folder can keep a descriptive name in this repo while installing as
something short you'd actually type: `commands/add-team-member/` installs as
`add.md`, giving you `/add`. Keep these short names distinct — the installed filename wins,
so two commands claiming the same `command` will collide in `.claude/commands/`.

### Splitting a long command

A command can be authored in pieces and stitched back together at install time:

```markdown
<!-- include: team-config.md -->
```

The installer replaces that line with the contents of the named file, resolved relative to
the command's own folder. Use it to lift the parts a forker will want to rewrite — team
rosters, IDs, thresholds — out of the procedure that surrounds them.

Rules worth knowing:

- **Installs stay flat.** Everything under `.claude/commands/` becomes a slash command, so a
  reference file installed alongside would show up as junk in the command list. Includes are
  inlined instead, and each command still lands as exactly one file.
- **Frontmatter in an included file is dropped**, so the rendered command keeps one
  frontmatter block, at the top.
- **Includes don't nest** and can't reach outside their command's folder. One level keeps the
  failure modes obvious.
- **A broken include fails the whole run** before anything is written, rather than leaving a
  half-installed directory.
- **`<name>.local.md` beside the file wins.** `*.local.md` is gitignored, so the version that
  ships can stay generic while your real config never leaves your machine — see
  [`commands/pr-assignments-slack/`](./commands/pr-assignments-slack#keeping-your-real-config-out-of-git).

Two things worth doing:

- **Write for an agent, not a person.** Name exact tools, exact parameters, exact property
  names. Ambiguity gets guessed at.
- **Record what you learned the hard way.** API quirks, silent failures, conventions that
  matter. That knowledge is the real value — it's why the next run doesn't repeat your
  debugging.

## License

MIT
