// Cuts a release from master (E7, D28): bumps the app version, turns CHANGELOG.md's "Unreleased"
// section into the new version's, commits, tags vX.Y.Z and pushes. The tag starts the Release
// workflow, which builds the installers into a draft GitHub release with those notes.
// If a local `development` branch exists, master is then merged back into it.
//
//   pnpm release patch|minor|major|X.Y.Z [--dry-run] [--no-push]

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const RELEASE_BRANCH = 'master'
const DEV_BRANCH = 'development'
const PACKAGE = 'apps/desktop/package.json'
const CHANGELOG = 'CHANGELOG.md'
const UNRELEASED = '## Unreleased'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const push = !args.includes('--no-push')
const bump = args.find((a) => !a.startsWith('--'))

function fail(message) {
  console.error(`release: ${message}`)
  process.exit(1)
}

function git(...gitArgs) {
  return execFileSync('git', gitArgs, { encoding: 'utf8' }).trim()
}

/** Runs git, or only prints the command in a dry run. */
function step(...gitArgs) {
  console.log(`${dryRun ? '[dry run] ' : ''}git ${gitArgs.join(' ')}`)
  if (!dryRun) execFileSync('git', gitArgs, { stdio: 'inherit' })
}

function nextVersion(current, how) {
  if (/^\d+\.\d+\.\d+$/.test(how ?? '')) return how
  const [major, minor, patch] = current.split('.').map(Number)
  switch (how) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      fail('usage: pnpm release patch|minor|major|X.Y.Z [--dry-run] [--no-push]')
  }
}

const isNewer = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number))
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

// Checks first; nothing is changed until they all pass.
const pkgText = readFileSync(PACKAGE, 'utf8')
const current = JSON.parse(pkgText).version
const version = nextVersion(current, bump)
const tag = `v${version}`
if (!isNewer(version, current)) fail(`${version} isn't newer than the current ${current}`)

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch !== RELEASE_BRANCH) {
  fail(`releases are cut from ${RELEASE_BRANCH}, you're on ${branch} (merge ${DEV_BRANCH} first)`)
}
if (git('status', '--porcelain')) fail('commit or stash your changes first')

git('fetch', '--quiet', '--tags', 'origin')
const behind = Number(git('rev-list', '--count', `${RELEASE_BRANCH}..origin/${RELEASE_BRANCH}`))
if (behind > 0) fail(`${RELEASE_BRANCH} is ${behind} commit(s) behind origin, pull first`)
if (git('tag', '--list', tag)) fail(`tag ${tag} already exists`)
if (git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`))
  fail(`tag ${tag} is already on origin`)

const changelog = readFileSync(CHANGELOG, 'utf8').replace(/\r\n/g, '\n')
const start = changelog.indexOf(`\n${UNRELEASED}\n`)
if (start < 0) fail(`${CHANGELOG} has no "${UNRELEASED}" section`)
const bodyStart = start + UNRELEASED.length + 2
const nextHeading = changelog.indexOf('\n## ', bodyStart)
const notes = changelog.slice(bodyStart, nextHeading < 0 ? undefined : nextHeading).trim()
if (!notes) fail(`the "${UNRELEASED}" section of ${CHANGELOG} is empty: write the release notes`)

// Local date, like the other changelog headings.
const now = new Date()
const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
  .map((n) => String(n).padStart(2, '0'))
  .join('-')

console.log(`Releasing ${current} → ${version} (${tag})\n\n${notes}\n`)

// A fresh, empty "Unreleased" stays on top for the next changes.
const newChangelog =
  changelog.slice(0, start) +
  `\n${UNRELEASED}\n\n## ${version} (${date})\n\n${notes}\n` +
  (nextHeading < 0 ? '' : changelog.slice(nextHeading))
const newPkg = pkgText.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`)

if (!dryRun) {
  writeFileSync(PACKAGE, newPkg)
  writeFileSync(CHANGELOG, newChangelog)
}
console.log(`${dryRun ? '[dry run] ' : ''}updated ${PACKAGE} and ${CHANGELOG}`)
step('commit', '-m', `Release ${tag}`, '--', PACKAGE, CHANGELOG)
step('tag', '-a', tag, '-m', `Cyclotron ${version}`)
// Atomic: the branch and the tag land together or not at all.
if (push) step('push', '--atomic', 'origin', RELEASE_BRANCH, tag)

// Bring the release commit into the development branch, so the next merge to master is clean.
if (git('branch', '--list', DEV_BRANCH)) {
  step('checkout', DEV_BRANCH)
  try {
    step('merge', '--no-edit', RELEASE_BRANCH)
    if (push) step('push', 'origin', DEV_BRANCH)
  } catch {
    git('merge', '--abort')
    console.warn(`release: merging ${RELEASE_BRANCH} into ${DEV_BRANCH} failed; do it by hand`)
  }
}

console.log(
  push
    ? `\nDone. The Release workflow is building ${tag}; publish the draft on GitHub when it's ready.`
    : `\nDone locally. Push with: git push --atomic origin ${RELEASE_BRANCH} ${tag}`,
)
