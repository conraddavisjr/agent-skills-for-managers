#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const SOURCE_REPO = 'conraddavisjr/agent-skills-for-managers';

// How people actually invoke this. Kept in one place so the help text can't drift
// from the repo name the way it did across the earlier renames.
const INVOCATION = 'npx github:conraddavisjr/agent-skills-for-managers';

// Each command is a directory under commands/ holding a command.md, plus any
// supporting files it inlines at install time.
const ENTRY = 'command.md';
const INCLUDE_RE = /^[ \t]*<!--[ \t]*include:[ \t]*([^\s>]+?)[ \t]*-->[ \t]*$/gm;

// Where each agent expects command/skill markdown to live, relative to a project root.
const TARGETS = {
  claude: '.claude/commands',
  cursor: '.cursor/rules',
  windsurf: '.windsurf/workflows',
  generic: 'ai-commands',
};

const COLORS = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLORS ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);
const green = (s) => c('32', s);
const yellow = (s) => c('33', s);
const red = (s) => c('31', s);
const cyan = (s) => c('36', s);

// A one-line note of where an installed file came from and when. An installed
// command is a snapshot: the repo moves on and the copy on disk never does, so
// when a command later refuses to run, this is what tells you whether the fix is
// already upstream. Written as a comment rather than frontmatter so it travels
// with the file without becoming a field an agent might try to validate against.
function provenance() {
  const stamped = new Date().toISOString().slice(0, 10);
  let ref = '';
  // npm strips .git when it packs a git dependency, so a sha is only available
  // when running from a real checkout. Fall back to the declared version.
  if (fs.existsSync(path.join(REPO_ROOT, '.git'))) {
    try {
      ref = require('child_process')
        .execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      // Not fatal: a stamp without a ref still dates the copy.
    }
  }
  if (!ref) {
    try {
      ref = `v${require(path.join(REPO_ROOT, 'package.json')).version}`;
    } catch {
      ref = 'unknown';
    }
  }
  return { stamped, ref };
}

// Name the actual command in the stamp rather than a placeholder, so the line can
// be copied straight out of the installed file without editing.
function stampFor(skill, meta) {
  return (
    `<!-- Installed ${meta.stamped} from ${SOURCE_REPO}@${meta.ref}\n` +
    `     Update with: ${INVOCATION} ${skill.command} --force -->\n\n`
  );
}

function listSkills() {
  if (!fs.existsSync(COMMANDS_DIR)) {
    console.error(red(`\nNo commands/ directory at ${COMMANDS_DIR}.\n`));
    process.exit(1);
  }
  return fs
    .readdirSync(COMMANDS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(COMMANDS_DIR, d.name, ENTRY)))
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const dir = path.join(COMMANDS_DIR, name);
      const body = fs.readFileSync(path.join(dir, ENTRY), 'utf8');
      // A command may bind itself to a shorter slash command than its directory.
      const command = parseField(body, 'command') || name;
      return {
        name,
        command,
        dir,
        description: parseField(body, 'description'),
        // Optional: one concrete line showing how you'd invoke the command once
        // installed. Shown in listings so `--list` teaches usage, not just names.
        example: parseField(body, 'example'),
      };
    });
}

// Resolve `<!-- include: file.md -->` against the command's own directory, so a
// long command can be authored in pieces but still install as one self-contained
// file. Includes are not recursive: one level keeps the failure modes obvious.
function render(skill, stamp) {
  const source = fs.readFileSync(path.join(skill.dir, ENTRY), 'utf8');
  const body = source.replace(INCLUDE_RE, (_match, ref) => {
    const target = path.resolve(skill.dir, ref);
    // Keep includes inside the command's own directory.
    if (!target.startsWith(skill.dir + path.sep)) {
      throw new Error(`${skill.name}: include "${ref}" escapes its command directory`);
    }
    // A gitignored `<name>.local.md` beside the file wins, so the version that
    // ships can stay generic while your real config never leaves your machine.
    const local = target.replace(/\.md$/, '.local.md');
    if (fs.existsSync(local)) return readFragment(local);
    if (!fs.existsSync(target)) {
      throw new Error(`${skill.name}: include "${ref}" not found`);
    }
    return readFragment(target);
  });

  // The stamp goes after the frontmatter, never before it: agents require the
  // `---` block to be the very first thing in the file, and a comment above it
  // stops the frontmatter being recognised at all.
  const fm = body.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return fm ? body.slice(0, fm[0].length) + '\n' + stamp + body.slice(fm[0].length).replace(/^\n+/, '') : stamp + body;
}

// Included fragments are body-only; drop any frontmatter they carry so the
// rendered file keeps exactly one frontmatter block, at the top.
function readFragment(file) {
  return fs.readFileSync(file, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}

// Pull a scalar out of the YAML frontmatter without taking a YAML dependency.
// Handles plain, quoted, and multi-line-folded values.
function parseField(body, field) {
  const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return '';
  const lines = fm[1].split(/\r?\n/);
  const key = new RegExp(`^${field}\\s*:`);
  const start = lines.findIndex((l) => key.test(l));
  if (start === -1) return '';

  let value = lines[start].replace(key, '').replace(/^\s*/, '');
  // Continuation lines are indented and not a new `key:` entry.
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s+\S/.test(lines[i]) && !/^\s*[\w-]+\s*:/.test(lines[i])) {
      value += ' ' + lines[i].trim();
    } else {
      break;
    }
  }
  return value.trim().replace(/^["']|["']$/g, '');
}

// What the command is called once installed, and how it's shown in listings.
function label(skill) {
  return skill.command === skill.name ? green(skill.name) : `${green(skill.command)} ${dim(`(${skill.name})`)}`;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

// The one place a command is rendered for the terminal. `--list` and the default
// help both go through this, so they can never describe the same command differently.
function describe(skills) {
  return skills
    .map((s) => {
      const lines = [`  ${label(s)}`, `      ${dim(truncate(s.description, 96))}`];
      if (s.example) lines.push(`      ${dim('e.g.')} ${cyan(s.example)}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function parseArgs(argv) {
  const opts = { target: 'claude', dir: null, global: false, force: false, all: false, names: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list' || a === '-l') opts.list = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--all' || a === '-a') opts.all = true;
    else if (a === '--global' || a === '-g') opts.global = true;
    else if (a === '--force' || a === '-f') opts.force = true;
    else if (a === '--dir') opts.dir = argv[++i];
    else if (a === '--target' || a === '-t') opts.target = argv[++i];
    else if (a.startsWith('-')) {
      console.error(red(`Unknown option: ${a}`));
      process.exit(1);
    } else opts.names.push(a);
  }
  return opts;
}

function usage(skills) {
  const first = skills[0];
  console.log(`
${bold('Conrad Davis Jr. — AI agent commands')}

Slash commands for engineering managers, installed as plain markdown into whichever
agent you already use.

${bold('Usage')}
  ${dim(`${INVOCATION} [name…] [options]`)}

  ${green('<no arguments>')}   show this help
  ${green('--all')}            install every command
  ${green('<name>')}           install one command, by folder name or slash command

${bold('Options')}
  -a, --all              install every available command
  -t, --target <agent>   claude (default), cursor, windsurf, generic
      --dir <path>       install to an explicit directory instead
  -g, --global           install to your home directory, not this project
  -f, --force            overwrite files that already exist
  -l, --list             list available commands and exit

${bold('Available')}
${describe(skills)}

${bold('Installing')}
  ${dim(`${INVOCATION} --all`)}
      every command, into ${bold('.claude/commands/')} in this project
  ${dim(`${INVOCATION} ${first ? first.command : '<name>'}`)}
      just one
  ${dim(`${INVOCATION} --all --global`)}
      into your home directory, so every project sees them
  ${dim(`${INVOCATION} --all --target cursor`)}
      for Cursor instead of Claude Code${
        first
          ? `

${bold('Then, in your agent')}
  Restart it, and the commands appear as slash commands:

      ${cyan(first.example || `/${first.command}`)}`
          : ''
      }

${dim('Existing files are never overwritten unless you pass --force.')}
`);
}

// A command may pin a resolved target into its own file — `/add-team-member` stores the Notion
// page it writes into. That pin is the user's, not ours, and reinstalling must not
// throw it away: the documented way to get a fix is `--force`, which overwrites.
// So carry any non-empty pin from the copy on disk into the fresh render.
const PIN_RE = /<!--\s*TRACKER_TARGET:\s*(\S*)\s*-->/;

function carryPin(existingPath, content) {
  if (!fs.existsSync(existingPath)) return content;
  let previous;
  try {
    previous = fs.readFileSync(existingPath, 'utf8');
  } catch {
    return content; // Unreadable is not a reason to fail the install.
  }
  const was = previous.match(PIN_RE);
  // Nothing to carry: no pin, or the user never resolved one.
  if (!was || !was[1]) return content;
  // Nothing to carry it into — the new version dropped the pin entirely.
  if (!PIN_RE.test(content)) return content;
  // Rewrite the whole comment rather than splicing into it, so the spacing is
  // canonical whether the template shipped it empty or already filled.
  return content.replace(PIN_RE, `<!-- TRACKER_TARGET: ${was[1]} -->`);
}

function resolveDestination(opts) {
  if (opts.dir) return path.resolve(opts.dir);
  const rel = TARGETS[opts.target];
  if (!rel) {
    console.error(red(`Unknown target "${opts.target}". Expected one of: ${Object.keys(TARGETS).join(', ')}`));
    process.exit(1);
  }
  return path.join(opts.global ? os.homedir() : process.cwd(), rel);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const skills = listSkills();

  if (opts.help) return usage(skills);
  if (opts.list) {
    console.log('\n' + describe(skills) + '\n');
    return;
  }
  // Installing is now something you ask for explicitly: a bare invocation shows
  // what's on offer rather than writing files into whatever directory you're in.
  if (!opts.all && !opts.names.length) return usage(skills);

  let selected = skills;
  if (opts.names.length) {
    selected = [];
    for (const name of opts.names) {
      // Accept either the filename or the slash command it installs as.
      const match = skills.find((s) => s.name === name || s.command === name);
      if (!match) {
        console.error(red(`\nNo command named "${name}".`));
        const available = skills.map((s) => (s.command === s.name ? s.name : `${s.command} / ${s.name}`));
        console.error(dim(`Available: ${available.join(', ')}\n`));
        process.exit(1);
      }
      selected.push(match);
    }
  }

  const dest = resolveDestination(opts);

  let skipped = 0;
  const pending = [];
  const stamp = provenance();

  // Render every command before writing any of them, so a broken include fails
  // the whole run instead of leaving a half-installed directory behind.
  for (const skill of selected) {
    // The installed filename is what becomes the slash command, so honour `command:`.
    const to = path.join(dest, `${skill.command}.md`);
    if (fs.existsSync(to) && !opts.force) {
      console.log(`  ${yellow('skip')}  ${skill.command} ${dim('(already exists — use --force to overwrite)')}`);
      skipped++;
      continue;
    }
    // One flat .md per command: everything under .claude/commands/ becomes a
    // slash command, so supporting files are inlined rather than copied.
    const fresh = render(skill, stampFor(skill, stamp));
    const content = carryPin(to, fresh);
    pending.push({ skill, to, content, keptPin: content !== fresh });
  }

  if (pending.length) fs.mkdirSync(dest, { recursive: true });

  for (const { skill, to, content, keptPin } of pending) {
    fs.writeFileSync(to, content);
    console.log(`  ${green('added')} ${label(skill)}${keptPin ? ` ${dim('(kept your pinned target)')}` : ''}`);
  }
  const written = pending.length;

  // Prefer a relative path, but fall back to absolute when it would climb out of cwd.
  const rel = path.relative(process.cwd(), dest);
  const where = !rel ? dest : rel.startsWith('..') ? dest : rel;
  console.log(`\n${written} installed, ${skipped} skipped → ${bold(where)}`);

  if (written && opts.target === 'claude') {
    console.log(dim(`\nRestart Claude Code, then run /${selected[0].command}\n`));
  }
}

try {
  main();
} catch (err) {
  console.error(red(`\nInstall failed: ${err.message}\n`));
  process.exit(1);
}
