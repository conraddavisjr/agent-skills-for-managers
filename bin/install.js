#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');

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
      return { name, command, dir, description: parseField(body, 'description') };
    });
}

// Resolve `<!-- include: file.md -->` against the command's own directory, so a
// long command can be authored in pieces but still install as one self-contained
// file. Includes are not recursive: one level keeps the failure modes obvious.
function render(skill) {
  const source = fs.readFileSync(path.join(skill.dir, ENTRY), 'utf8');
  return source.replace(INCLUDE_RE, (_match, ref) => {
    const target = path.resolve(skill.dir, ref);
    // Keep includes inside the command's own directory.
    if (!target.startsWith(skill.dir + path.sep)) {
      throw new Error(`${skill.name}: include "${ref}" escapes its command directory`);
    }
    if (!fs.existsSync(target)) {
      throw new Error(`${skill.name}: include "${ref}" not found`);
    }
    // Included fragments are body-only; drop any frontmatter they carry so the
    // rendered file keeps exactly one frontmatter block, at the top.
    return fs.readFileSync(target, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
  });
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

function parseArgs(argv) {
  const opts = { target: 'claude', dir: null, global: false, force: false, names: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list' || a === '-l') opts.list = true;
    else if (a === '--help' || a === '-h') opts.help = true;
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
  console.log(`
${bold('Conrad Davis Jr. — AI agent commands')}

  ${bold('npx github:conraddavisjr/agent-skills')}                 install everything
  ${bold('npx github:conraddavisjr/agent-skills <name>')}          install one command
  ${bold('npx github:conraddavisjr/agent-skills --list')}          show what's available

${bold('Options')}
  -t, --target <agent>   claude (default), cursor, windsurf, generic
      --dir <path>       install to an explicit directory instead
  -g, --global           install to your home directory, not this project
  -f, --force            overwrite files that already exist
  -l, --list             list available commands and exit

${bold('Available')}
${skills.map((s) => `  ${label(s)}\n      ${dim(truncate(s.description, 96))}`).join('\n')}
`);
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
    console.log('\n' + skills.map((s) => `  ${label(s)}\n      ${dim(truncate(s.description, 96))}`).join('\n') + '\n');
    return;
  }

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
    pending.push({ skill, to, content: render(skill) });
  }

  if (pending.length) fs.mkdirSync(dest, { recursive: true });

  for (const { skill, to, content } of pending) {
    fs.writeFileSync(to, content);
    console.log(`  ${green('added')} ${label(skill)}`);
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
