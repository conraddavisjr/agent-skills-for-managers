#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');

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
  return fs
    .readdirSync(REPO_ROOT)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort()
    .map((file) => {
      const body = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
      return { name: path.basename(file, '.md'), file, description: parseDescription(body) };
    });
}

// Pull `description:` out of the YAML frontmatter without taking a YAML dependency.
// Handles plain, quoted, and multi-line-folded values.
function parseDescription(body) {
  const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return '';
  const lines = fm[1].split(/\r?\n/);
  const start = lines.findIndex((l) => /^description\s*:/.test(l));
  if (start === -1) return '';

  let value = lines[start].replace(/^description\s*:\s*/, '');
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

  ${bold('npx github:conraddavisjr/skills')}                 install everything
  ${bold('npx github:conraddavisjr/skills <name>')}          install one command
  ${bold('npx github:conraddavisjr/skills --list')}          show what's available

${bold('Options')}
  -t, --target <agent>   claude (default), cursor, windsurf, generic
      --dir <path>       install to an explicit directory instead
  -g, --global           install to your home directory, not this project
  -f, --force            overwrite files that already exist
  -l, --list             list available commands and exit

${bold('Available')}
${skills.map((s) => `  ${green(s.name)}\n      ${dim(truncate(s.description, 96))}`).join('\n')}
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
    console.log('\n' + skills.map((s) => `  ${green(s.name)}\n      ${dim(truncate(s.description, 96))}`).join('\n') + '\n');
    return;
  }

  let selected = skills;
  if (opts.names.length) {
    selected = [];
    for (const name of opts.names) {
      const match = skills.find((s) => s.name === name);
      if (!match) {
        console.error(red(`\nNo command named "${name}".`));
        console.error(dim(`Available: ${skills.map((s) => s.name).join(', ')}\n`));
        process.exit(1);
      }
      selected.push(match);
    }
  }

  const dest = resolveDestination(opts);
  fs.mkdirSync(dest, { recursive: true });

  let written = 0;
  let skipped = 0;

  for (const skill of selected) {
    const to = path.join(dest, skill.file);
    if (fs.existsSync(to) && !opts.force) {
      console.log(`  ${yellow('skip')}  ${skill.name} ${dim('(already exists — use --force to overwrite)')}`);
      skipped++;
      continue;
    }
    fs.copyFileSync(path.join(REPO_ROOT, skill.file), to);
    console.log(`  ${green('added')} ${skill.name}`);
    written++;
  }

  // Prefer a relative path, but fall back to absolute when it would climb out of cwd.
  const rel = path.relative(process.cwd(), dest);
  const where = !rel ? dest : rel.startsWith('..') ? dest : rel;
  console.log(`\n${written} installed, ${skipped} skipped → ${bold(where)}`);

  if (written && opts.target === 'claude') {
    console.log(dim(`\nRestart Claude Code, then run /${selected[0].name}\n`));
  }
}

try {
  main();
} catch (err) {
  console.error(red(`\nInstall failed: ${err.message}\n`));
  process.exit(1);
}
