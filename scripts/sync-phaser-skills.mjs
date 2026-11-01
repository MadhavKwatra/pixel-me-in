// Copies Phaser's official AI-agent guides (shipped in the phaser npm package,
// MIT licensed) into .claude/skills/ so AI coding assistants use them.
// Each skill gets a "phaser-" prefix so generic names like "scenes" do not clash.
// Run after upgrading Phaser:  npm run skills:phaser
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'phaser', 'skills');
const dest = join(root, '.claude', 'skills');

if (!existsSync(src)) {
  console.error(
    '[sync-phaser-skills] node_modules/phaser/skills not found. Run npm install first.',
  );
  process.exit(1);
}
const version = JSON.parse(
  readFileSync(join(root, 'node_modules', 'phaser', 'package.json'), 'utf-8'),
).version;
mkdirSync(dest, { recursive: true });

let count = 0;
for (const name of readdirSync(src)) {
  const from = join(src, name);
  if (!existsSync(join(from, 'SKILL.md'))) continue;
  const to = join(dest, `phaser-${name}`);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  // Rename the skill and fix links to sibling skills (../scenes/SKILL.md -> ../phaser-scenes/SKILL.md).
  const file = join(to, 'SKILL.md');
  const text = readFileSync(file, 'utf-8')
    .replace(/^name:\s*(.+)$/m, (_m, n) => `name: phaser-${n.trim()}`)
    .replace(/\.\.\/([a-z0-9-]+)\/SKILL\.md/g, (_m, n) => `../phaser-${n}/SKILL.md`);
  writeFileSync(file, text);
  count++;
}
writeFileSync(
  join(dest, 'PHASER_SKILLS.md'),
  `# Phaser skills\n\nCopied from the official \`phaser\` npm package (v${version}, MIT license) by \`scripts/sync-phaser-skills.mjs\`.\nDo not edit these folders by hand; re-run \`npm run skills:phaser\` after upgrading Phaser.\n`,
);
console.log(
  `[sync-phaser-skills] copied ${count} skills from phaser ${version} to .claude/skills/`,
);
