# `/onboard` — run week one for a new hire

Adds a new hire to your recurring ceremonies, schedules their intro 1:1s, files their first two
Jira tickets, invites them to Slack, and adds them to GitHub teams — from one command, after
showing you exactly what it's about to do.

The problem it solves is that onboarding is a checklist executed by hand across six browser tabs,
usually the week someone is busiest. It's not hard, it's just twenty small actions that are easy
to half-finish. The half that gets forgotten is always the same half: the ceremony nobody
remembered the hire wasn't on, the Slack channel they find out about in month two.

Run [`/onboard-setup`](../onboard-setup) once first — it discovers your team's meetings and
channels and writes the config this reads.

## What a run looks like

Nothing happens until you approve the plan:

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

10 actions · 3 need a human · 1 already done
```

Reply **yes** to run it, **edit** to change something, **no** to stop. Calendar invitations email
people the moment they're written, so the gate is the whole design — nothing touches any system
before you answer.

## The four things it gets right

**It's safe to re-run.** Every action is recorded against the hire, so a second run skips what's
finished and retries only what failed or was blocked. You'll re-run this — the hire's Slack account
won't exist on the day you first want to use it — and it will not double-book your team.

**It knows what it can't do.** Some ceremonies you don't organize, some teams you can't grant, some
tools have no API for this at all. Those don't fail silently or crash the run; they come back as a
short list of things for you or an admin to do, each with a link.

**Missing accounts aren't errors.** IT rarely finishes provisioning before you want to run this. It
does what it can, tells you what's waiting, and picks the rest up next time.

**Emails are drafts.** The welcome note and every request to a meeting organizer land in your Gmail
drafts for you to read and send. Nothing is sent on your behalf.

## What needs a human, and why

Worth knowing before you run it, because none of these are fixable in software:

| Thing | Why |
| --- | --- |
| Ceremonies you don't organize | Google Calendar won't let anyone but the organizer add a guest. You get a drafted email instead |
| Google Group membership | Needs Workspace admin. It's also the highest-leverage action available — one group can cover several meetings at once |
| Figma | The Figma API has no invite endpoint outside Enterprise SCIM, and seats cost money. Always a request to your design admin |
| GitHub teams | Needs org owner or team maintainer. On SSO orgs, membership stays pending until the hire authorizes |
| GitHub usernames | Can't be looked up from an email address. You'll be asked for it once |

## The first Jira ticket

Two tickets get filed. **Meet the Team** is generated from your onboarding content, and always
happens.

The second is the real first task — the one you planned in advance. By default it's found by the
label `onboarding-first-task` on an unassigned ticket in your project, so you can prepare it weeks
ahead and it'll be waiting.

If there isn't one, you get a single line offering to create a placeholder or skip. It won't ask
twice or block the run. Three days before someone starts, a reminder is useful and a lecture is not.

## Where your data lives

```
~/.claude/onboarding-pipeline/
  config.json          written by /onboard-setup
  hires/priya-raman.json   what was done for this hire
```

Outside any repo, on purpose — these hold colleagues' and new hires' email addresses. Nothing here
is ever committed or written into your project.

## What you need

`/onboard-setup` run at least once, and the **Google Calendar** connector working — it supplies both
the ceremonies and the 1:1s, so it's the one hard requirement.

**Notion**, **Gmail**, **Slack**, **Atlassian**, **Figma**, and the `gh` CLI are each optional. Anything
you haven't connected becomes a line on the manual checklist rather than an error, and anything you
didn't configure is never mentioned at all.
