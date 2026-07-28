# Commands

Each folder here is one command an AI agent can run on your behalf. They exist because
management work leaves a thin paper trail: the things worth remembering about your team get
noticed in passing and reconstructed months later, and the work of routing reviews gets done
from memory every sprint. These automate the recording, not the judgement.

| Command | Folder | What it does | Connects to |
| --- | --- | --- | --- |
| `/add` | [`add-team-member/`](./add-team-member) | Onboards a new direct report into your Notion tracker — profile card, year page, and the filtered views that surface their observations | Notion |
| `/pr-assignments-slack` | [`pr-assignments-slack/`](./pr-assignments-slack) | Assigns reviewers to the sprint's open PRs by capacity and availability, then posts the round-up to Slack | Jira, GitHub, Slack, Google Calendar |

Each folder has its own README with the detail: what the command does step by step, what you
have to configure, and where it will stop and ask rather than guess.

## Anatomy of a command

```
commands/
  add-team-member/
    command.md          the instructions the agent follows
    README.md           the explanation for humans
  pr-assignments-slack/
    command.md
    team-config.md      the part you rewrite
    README.md
```

`command.md` is the only required file. Its YAML frontmatter declares a `description` (what
the agent matches your request against), an optional `command:` naming the slash command, and
`allowed-tools` limiting what it may touch. Everything after the frontmatter is instructions,
in order.

A folder name and its slash command are allowed to differ. `add-team-member/` installs as
`add.md` and gives you `/add` — descriptive on disk, short to type.

## How they install

`npx github:conraddavisjr/agent-skills-for-managers` copies each command into
`.claude/commands/` as a single flat markdown file. Anything with a `.md` extension in that
directory becomes a slash command, so supporting files like `team-config.md` are **inlined**
at install time rather than copied — otherwise they'd show up in your command list as junk.

That inlining is what `<!-- include: team-config.md -->` does. See the root
[README](../README.md#splitting-a-long-command) for the rules.

## Before you run them

These commands act on real systems — they create Notion pages and post Slack messages. Two
habits worth keeping:

- **Read the command file before installing it.** It is plain markdown and tells you exactly
  which APIs it calls and in what order.
- **Configure before the first run.** `pr-assignments-slack` in particular ships with every
  team-specific value as a placeholder. It is written to stop and tell you which value is
  unset rather than call an API with a literal `<PROJECT>`.
