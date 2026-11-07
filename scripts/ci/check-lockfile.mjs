#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Lockfile guard. Fails (exit 1) unless package-lock.json:
//   1. is lockfileVersion 3;
//   2. resolves every installed package from https://registry.npmjs.org/
//      with an `integrity` hash (workspace links and bundled packages excepted);
//   3. covers every package with `hasInstallScript` by an entry in the root
//      package.json `allowScripts` (approved `true` or denied `false`; a
//      pinned `name@x.y.z` entry must match the locked version);
//   4. for every native family that ships a darwin-arm64 build, also locks
//      the glibc linux-x64 and linux-arm64 builds. A lockfile written on a
//      Mac can silently drop them, and then `npm ci` on the cloud VM (x64)
//      or the production server (arm64) installs no binary at all.
//
// Runs in the `ci` job, in lefthook pre-commit when the lockfile changes,
// and in the cloud SessionStart hook (warning only).
//
// Usage: node scripts/ci/check-lockfile.mjs
//   LOCKFILE_PATH   lockfile to check (default: <repo root>/package-lock.json);
//                   allowScripts is read from the package.json next to it.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REGISTRY = 'https://registry.npmjs.org/'
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const lockPath = resolve(process.env.LOCKFILE_PATH ?? join(repoRoot, 'package-lock.json'))
const manifestPath = join(dirname(lockPath), 'package.json')

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error(`check-lockfile: cannot read ${path}: ${error.message}`)
    process.exit(2)
  }
}

if (!existsSync(lockPath)) {
  console.error(`check-lockfile: ${lockPath} not found (run npm install)`)
  process.exit(1)
}

const lock = readJson(lockPath)
const manifest = readJson(manifestPath)
const problems = []

// 1. Format.
if (lock.lockfileVersion !== 3) {
  problems.push(`lockfileVersion is ${lock.lockfileVersion}, expected 3`)
}

/** Package name for a `packages` key, e.g. `node_modules/a/node_modules/@s/b` -> `@s/b`. */
function nameOf(key, entry) {
  if (entry.name) return entry.name
  const index = key.lastIndexOf('node_modules/')
  return key.slice(index + 'node_modules/'.length)
}

/** allowScripts keys split into name and optional version spec. */
const allowEntries = Object.keys(manifest.allowScripts ?? {}).map((key) => {
  const at = key.indexOf('@', 1)
  return at === -1 ? { name: key, spec: null } : { name: key.slice(0, at), spec: key.slice(at + 1) }
})

function coveredByAllowScripts(name, version) {
  return allowEntries.some((entry) => {
    if (entry.name !== name) return false
    if (entry.spec === null) return true
    // Exact pins must match; ranges (`1 || 2`, `^1`) are trusted as written.
    return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(entry.spec) ? entry.spec === version : true
  })
}

const packages = Object.entries(lock.packages ?? {})
let installed = 0
const installScripts = new Set()
const natives = []

for (const [key, entry] of packages) {
  if (key === '' || !key.includes('node_modules/')) continue // root and workspace folders
  if (entry.link || entry.inBundle) continue // workspace symlinks, bundled deps
  installed += 1
  const name = nameOf(key, entry)

  // 2. Provenance.
  if (typeof entry.resolved !== 'string' || !entry.resolved.startsWith(REGISTRY)) {
    problems.push(`${key}: not resolved from ${REGISTRY}`)
  }
  if (typeof entry.integrity !== 'string' || entry.integrity === '') {
    problems.push(`${key}: missing integrity`)
  }

  // 3. Install scripts.
  if (entry.hasInstallScript) {
    installScripts.add(name)
    if (!coveredByAllowScripts(name, entry.version)) {
      problems.push(`${name}@${entry.version}: has an install script but no allowScripts entry`)
    }
  }

  if (Array.isArray(entry.os) || Array.isArray(entry.cpu)) natives.push({ name, entry })
}

// 4. Native families. A family is the package name with its platform suffix
// removed: `@esbuild/darwin-arm64` -> `@esbuild/`, `@swc/core-linux-x64-gnu`
// -> `@swc/core`, `lightningcss-darwin-arm64` -> `lightningcss`.
const PLATFORM_SUFFIX =
  /[-/](darwin|linux|win32|freebsd|openbsd|netbsd|openharmony|android|sunos|aix)-(x64|64|arm64|arm|ia32|ppc64|s390x|riscv64|loong64|mips64el|universal)(-[a-z0-9]+)*$/

function familyOf(name) {
  const match = name.match(PLATFORM_SUFFIX)
  if (!match) return null
  return name.slice(0, match.index + 1)
}

function isMusl(name, entry) {
  if (Array.isArray(entry.libc)) return entry.libc.includes('musl') && !entry.libc.includes('glibc')
  return /musl/.test(name)
}

function supports(entry, os, cpu) {
  const osOk = !Array.isArray(entry.os) || entry.os.includes(os)
  const cpuOk = !Array.isArray(entry.cpu) || entry.cpu.includes(cpu)
  return osOk && cpuOk
}

const families = new Map()
for (const native of natives) {
  const family = familyOf(native.name)
  if (family === null) continue // e.g. fsevents: one package, macOS only by design
  if (!families.has(family)) families.set(family, [])
  families.get(family).push(native)
}

let checkedFamilies = 0
for (const [family, members] of families) {
  if (!members.some(({ entry }) => supports(entry, 'darwin', 'arm64') && Array.isArray(entry.os)))
    continue
  checkedFamilies += 1
  for (const cpu of ['x64', 'arm64']) {
    const found = members.some(
      ({ name, entry }) =>
        Array.isArray(entry.os) && supports(entry, 'linux', cpu) && !isMusl(name, entry)
    )
    if (!found) {
      problems.push(
        `native family ${family}*: darwin-arm64 build locked but no glibc linux-${cpu} build`
      )
    }
  }
}

const summary =
  `${installed} packages, ${installScripts.size} with install scripts ` +
  `(${[...installScripts].sort().join(', ') || 'none'}), ${checkedFamilies} native families`

if (problems.length > 0) {
  console.error(`check-lockfile: ${problems.length} problem(s) in ${lockPath}:`)
  for (const problem of [...new Set(problems)].sort()) console.error(`  - ${problem}`)
  console.error(`(${summary})`)
  console.error(
    'Fix: regenerate on a clean tree (`rm -rf node_modules package-lock.json && npm install`), ' +
      'review install scripts with `npm install-scripts ls`, then approve or deny them.'
  )
  process.exit(1)
}

console.log(`check-lockfile: ok, ${summary}`)
