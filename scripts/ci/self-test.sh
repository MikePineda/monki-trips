#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# Self-test for the CI guard scripts. Runs privacy-check.sh, check-commits.sh
# and check-lockfile.mjs against throwaway git repositories and lockfiles in
# a temp directory, with a synthetic pattern (`zebrafoo`) only: real patterns
# are never needed and never used here (any PRIVACY_PATTERNS* in the caller's
# environment is unset first). Probe strings are assembled at runtime so this
# file itself passes the generic e-mail and phone checks.
#
# Usage: bash scripts/ci/self-test.sh
set -euo pipefail

unset PRIVACY_PATTERNS PRIVACY_PATTERNS_FILE

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# The owner handle, derived from the repo URL so it is never spelled out alone.
owner="$(printf '%s' 'github.com/MikePineda/monki-trips' | cut -d/ -f2)"

failures=0
pass() { echo "ok   - $1"; }
fail() {
  echo "FAIL - $1" >&2
  failures=$((failures + 1))
}

# expect <name> <expected-exit> <command...>
# The command's output lands in "$tmp/out" once it has finished, so an
# assertion can grep the output of the previous command.
expect() {
  local name="$1" expected="$2" status=0
  shift 2
  "$@" >"$tmp/out.next" 2>&1 || status=$?
  mv "$tmp/out.next" "$tmp/out"
  if [[ "$status" == "$expected" ]]; then
    pass "$name"
  else
    fail "$name (exit $status, expected $expected)"
    sed 's/^/       /' "$tmp/out" >&2
  fi
}

new_repo() {
  rm -rf "$tmp/repo"
  mkdir -p "$tmp/repo/scripts/ci" "$tmp/repo/.github"
  cp "$script_dir/privacy-check.sh" "$script_dir/check-commits.sh" "$tmp/repo/scripts/ci/"
  printf '* @%s\n' "$owner" >"$tmp/repo/.github/CODEOWNERS"
  printf 'hello\n' >"$tmp/repo/README.md"
  git -C "$tmp/repo" init -q
  git -C "$tmp/repo" add -A
}

privacy() { (cd "$tmp/repo" && bash scripts/ci/privacy-check.sh); }
privacy_with_file() { (cd "$tmp/repo" && PRIVACY_PATTERNS_FILE="$tmp/patterns.txt" bash scripts/ci/privacy-check.sh); }
privacy_with_env() { (cd "$tmp/repo" && PRIVACY_PATTERNS="$(printf '# comment\n\nzebrafoo\n')" bash scripts/ci/privacy-check.sh); }

printf '# synthetic patterns for the self-test\nzebrafoo\n\n' >"$tmp/patterns.txt"
at='@'

# --- privacy-check.sh --------------------------------------------------------
new_repo
expect 'privacy: clean repo passes (generic only)' 0 privacy
expect 'privacy: clean repo passes (pattern file)' 0 privacy_with_file
expect 'privacy: clean repo passes (pattern env)' 0 privacy_with_env

new_repo
printf 'line one\nsee ZebraFoo here\n' >"$tmp/repo/notes.md"
expect 'privacy: pattern from env fails' 1 privacy_with_env
expect 'privacy: pattern in a new file fails' 1 privacy_with_file
cp "$tmp/out" "$tmp/hit-out"
expect 'privacy: hit is reported as file:line' 0 grep -q '^notes.md:2$' "$tmp/hit-out"
expect 'privacy: matched text is never printed' 1 grep -qi 'zebrafoo' "$tmp/hit-out"
expect 'privacy: without patterns the synthetic word passes' 0 privacy

new_repo
printf 'see https://github.com/MikePineda/monki-trips by zebrafoo\n' >"$tmp/repo/notes.md"
expect 'privacy: allowed URL is stripped, rest of the line still checked' 1 privacy_with_file

new_repo
printf 'see https://github.com/MikePineda/monki-trips and ghcr.io/mikepineda/monki-trips-app\n' >"$tmp/repo/notes.md"
expect 'privacy: allowed URLs alone pass' 0 privacy_with_file

new_repo
printf '* @%s zebrafoo\n' "$owner" >"$tmp/repo/.github/CODEOWNERS"
expect 'privacy: CODEOWNERS is scanned after stripping the handle' 1 privacy_with_file

new_repo
: >"$tmp/repo/zebrafoo-notes.txt"
expect 'privacy: pattern in a file path fails' 1 privacy_with_file
expect 'privacy: path hit is reported by number' 0 grep -q '^path #' "$tmp/out"

new_repo
printf 'contact: someone%scorp-mail.test\n' "$at" >"$tmp/repo/notes.md"
expect 'privacy: generic e-mail check fails' 1 privacy

new_repo
printf 'bot: 1+bot%susers.noreply.github.com, demo%sexample.com\n' "$at" "$at" >"$tmp/repo/notes.md"
expect 'privacy: noreply and example e-mails pass' 0 privacy

new_repo
printf 'call %s %s %s %s\n' '+61' '412' '345' '678' >"$tmp/repo/notes.md"
expect 'privacy: generic phone check fails' 1 privacy

new_repo
printf 'version 1.2.3 on 2026-10-25, port 3433\n' >"$tmp/repo/notes.md"
expect 'privacy: versions, dates and ports pass' 0 privacy

new_repo
printf 'zebrafoo(\n' >"$tmp/bad-patterns.txt"
expect 'privacy: invalid pattern fails with exit 2' 2 \
  bash -c "cd '$tmp/repo' && PRIVACY_PATTERNS_FILE='$tmp/bad-patterns.txt' bash scripts/ci/privacy-check.sh"
expect 'privacy: unreadable pattern file fails with exit 2' 2 \
  bash -c "cd '$tmp/repo' && PRIVACY_PATTERNS_FILE='$tmp/missing.txt' bash scripts/ci/privacy-check.sh"

# --- check-commits.sh --------------------------------------------------------
owner_email="1234+${owner}${at}users.noreply.github.com"
bot_email="49699333+dependabot[bot]${at}users.noreply.github.com"
github_email="noreply${at}github.com"
agent_email="noreply${at}anthropic.com"
outside_email="someone${at}corp-mail.test"

# commit <author-name> <author-email> <committer-name> <committer-email> <message>
commit() {
  GIT_AUTHOR_NAME="$1" GIT_AUTHOR_EMAIL="$2" GIT_COMMITTER_NAME="$3" GIT_COMMITTER_EMAIL="$4" \
    git -C "$tmp/repo" commit -q --allow-empty -m "$5"
}
commits() { (cd "$tmp/repo" && bash scripts/ci/check-commits.sh "$1" HEAD); }
commits_with_env() { (cd "$tmp/repo" && PRIVACY_PATTERNS='zebrafoo' bash scripts/ci/check-commits.sh "$1" HEAD); }

new_repo
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" 'chore: initial commit'
git -C "$tmp/repo" tag base
commit 'Maintainer' "$owner_email" 'GitHub' "$github_email" \
  "$(printf 'feat: add a thing\n\nCo-authored-by: Agent <%s>\n' "$agent_email")"
commit 'dependabot[bot]' "$bot_email" 'GitHub' "$github_email" 'build(deps): bump a tool'
expect 'commits: no-reply identities pass' 0 commits base
expect 'commits: no-reply identities pass with patterns' 0 commits_with_env base
expect 'commits: all-zero base checks the whole history' 0 commits 0000000000000000000000000000000000000000
expect 'commits: unknown base checks the whole history' 0 commits origin/does-not-exist

new_repo
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" 'chore: initial commit'
git -C "$tmp/repo" tag base
commit 'Contributor' "5678+some-contributor${at}users.noreply.github.com" 'GitHub' "$github_email" \
  "$(printf 'fix: a contribution\n\nCo-authored-by: Helper <other-login%susers.noreply.github.com>\n' "$at")"
expect "commits: another contributor's no-reply identity passes" 0 commits base
commit 'Maintainer' "1234+${owner}${at}users.noreply.github.com.evil.test" 'Maintainer' "$owner_email" 'fix: lookalike'
expect 'commits: a look-alike no-reply domain fails' 1 commits base

commit 'Maintainer' "$outside_email" 'Maintainer' "$owner_email" 'fix: something'
expect 'commits: a non-noreply author fails' 1 commits base
cp "$tmp/out" "$tmp/commit-out"
expect 'commits: the field kind is reported' 0 grep -q ' author-email$' "$tmp/commit-out"
expect 'commits: the address is never printed' 1 grep -q 'corp-mail' "$tmp/commit-out"

new_repo
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" 'chore: initial commit'
git -C "$tmp/repo" tag base
commit 'Maintainer' "$owner_email" 'Maintainer' "$outside_email" 'fix: something'
expect 'commits: a non-noreply committer fails' 1 commits base

new_repo
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" 'chore: initial commit'
git -C "$tmp/repo" tag base
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" \
  "$(printf 'fix: pair work\n\nco-authored-by: Friend <%s>\n' "$outside_email")"
expect 'commits: a non-noreply co-author fails' 1 commits base
expect 'commits: co-author field kind is reported' 0 grep -q ' co-author-email$' "$tmp/out"

new_repo
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" 'chore: initial commit'
git -C "$tmp/repo" tag base
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" 'docs: trip to ZebraFoo'
expect 'commits: pattern in the message fails' 1 commits_with_env base
cp "$tmp/out" "$tmp/commit-out"
expect 'commits: message kind is reported' 0 grep -q ' message$' "$tmp/commit-out"
expect 'commits: matched text is never printed' 1 grep -qi 'zebrafoo' "$tmp/commit-out"
expect 'commits: without patterns the synthetic word passes' 0 commits base

new_repo
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" 'chore: initial commit'
git -C "$tmp/repo" tag base
commit 'Zebrafoo Person' "$owner_email" 'Maintainer' "$owner_email" 'fix: something'
expect 'commits: pattern in the author name fails' 1 commits_with_env base
expect 'commits: author-name kind is reported' 0 grep -q ' author-name$' "$tmp/out"

new_repo
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" 'chore: initial commit'
git -C "$tmp/repo" tag base
commit 'ZebraFoo' "77+zebrafoo${at}users.noreply.github.com" 'ZebraFoo' "77+zebrafoo${at}users.noreply.github.com" \
  "$(printf 'fix: something\n\nCo-authored-by: zebrafoo <zebrafoo%susers.noreply.github.com>\n' "$at")"
expect 'commits: a name equal to its own no-reply login passes' 0 commits_with_env base

new_repo
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" 'chore: initial commit'
git -C "$tmp/repo" tag base
commit 'ZebraFoo' "77+someone-else${at}users.noreply.github.com" 'Maintainer' "$owner_email" 'fix: other'
expect 'commits: a matching name with a different no-reply login fails' 1 commits_with_env base

new_repo
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" 'chore: initial commit'
git -C "$tmp/repo" tag base
commit 'Maintainer' "$owner_email" 'Maintainer' "$owner_email" \
  "$(printf 'fix: pair\n\nCo-authored-by: Zebrafoo Person <zebrafoo%susers.noreply.github.com>\n' "$at")"
expect 'commits: a co-author name longer than its login is still checked' 1 commits_with_env base
expect 'commits: co-author-name kind is reported' 0 grep -q ' co-author-name$' "$tmp/out"
expect 'commits: invalid pattern fails with exit 2' 2 \
  bash -c "cd '$tmp/repo' && PRIVACY_PATTERNS='zebrafoo(' bash scripts/ci/check-commits.sh base HEAD"

# --- check-lockfile.mjs ------------------------------------------------------
# lockfile <allowScripts-json> <extra-packages-json> [lockfileVersion]
lockfile() {
  rm -rf "$tmp/lock"
  mkdir -p "$tmp/lock"
  printf '{"name":"probe","version":"1.0.0","allowScripts":%s}\n' "$1" >"$tmp/lock/package.json"
  cat >"$tmp/lock/package-lock.json" <<EOF
{
  "name": "probe",
  "lockfileVersion": ${3:-3},
  "requires": true,
  "packages": {
    "": { "name": "probe", "version": "1.0.0", "workspaces": ["apps/web"] },
    "apps/web": { "name": "web", "version": "0.0.0" },
    "node_modules/web": { "resolved": "apps/web", "link": true },
    "node_modules/left-pad": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz",
      "integrity": "sha512-AAAA"
    }$2
  }
}
EOF
}
lockcheck() { LOCKFILE_PATH="$tmp/lock/package-lock.json" node "$script_dir/check-lockfile.mjs"; }
pkg() { # pkg <name> <extra-fields>
  printf ',\n    "node_modules/%s": { "version": "1.0.0", "resolved": "https://registry.npmjs.org/%s/-/x-1.0.0.tgz", "integrity": "sha512-AAAA"%s }' "$1" "$1" "$2"
}
native_family="$(pkg '@probe/darwin-arm64' ', "os": ["darwin"], "cpu": ["arm64"], "optional": true')"
linux_x64="$(pkg '@probe/linux-x64' ', "os": ["linux"], "cpu": ["x64"], "optional": true')"
linux_arm64="$(pkg '@probe/linux-arm64' ', "os": ["linux"], "cpu": ["arm64"], "optional": true')"
musl_arm64="$(pkg '@probe/linux-arm64-musl' ', "os": ["linux"], "cpu": ["arm64"], "libc": ["musl"], "optional": true')"

lockfile '{}' ''
expect 'lockfile: a clean lockfile passes' 0 lockcheck
lockfile '{}' '' 2
expect 'lockfile: lockfileVersion 2 fails' 1 lockcheck
lockfile '{}' "$(printf ',\n    "node_modules/evil": { "version": "1.0.0", "resolved": "https://registry.example.com/evil-1.0.0.tgz", "integrity": "sha512-AAAA" }')"
expect 'lockfile: a non-registry tarball fails' 1 lockcheck
lockfile '{}' "$(printf ',\n    "node_modules/loose": { "version": "1.0.0", "resolved": "https://registry.npmjs.org/loose/-/loose-1.0.0.tgz" }')"
expect 'lockfile: a missing integrity fails' 1 lockcheck
lockfile '{}' "$(pkg 'esbuild' ', "hasInstallScript": true')"
expect 'lockfile: an unreviewed install script fails' 1 lockcheck
lockfile '{"esbuild": true}' "$(pkg 'esbuild' ', "hasInstallScript": true')"
expect 'lockfile: an approved install script passes' 0 lockcheck
lockfile '{"esbuild": false}' "$(pkg 'esbuild' ', "hasInstallScript": true')"
expect 'lockfile: a denied install script passes (explicit decision)' 0 lockcheck
lockfile '{"esbuild@0.9.0": true}' "$(pkg 'esbuild' ', "hasInstallScript": true')"
expect 'lockfile: a stale pinned approval fails' 1 lockcheck
lockfile '{"esbuild@1.0.0": true}' "$(pkg 'esbuild' ', "hasInstallScript": true')"
expect 'lockfile: a matching pinned approval passes' 0 lockcheck
lockfile '{}' "${native_family}${linux_x64}${linux_arm64}"
expect 'lockfile: a native family with both glibc linux builds passes' 0 lockcheck
lockfile '{}' "${native_family}${linux_x64}"
expect 'lockfile: a native family without linux-arm64 fails' 1 lockcheck
expect 'lockfile: the missing build is named' 0 grep -q 'no glibc linux-arm64 build' "$tmp/out"
lockfile '{}' "${native_family}${linux_x64}${musl_arm64}"
expect 'lockfile: a musl-only linux-arm64 build does not count' 1 lockcheck

if [[ $failures -gt 0 ]]; then
  echo "self-test: ${failures} failure(s)" >&2
  exit 1
fi
echo 'self-test: all checks passed'
