#!/usr/bin/env bash
# Tag and release the version in plugin.json as vX.Y.Z, with its README changelog entry as the notes.
# Does nothing when the tag already exists. DRY_RUN=true prints the release instead of creating it.
set -euo pipefail

version=$(node -p "require('./plugins/oncue/.claude-plugin/plugin.json').version")
tag="v$version"

if gh api "repos/{owner}/{repo}/git/ref/tags/$tag" --silent 2>/dev/null; then
  echo "$tag already exists, nothing to release."
  exit 0
fi

# The entry runs from "### X.Y.Z (date)" to the next heading.
notes=$(awk -v head="### $version " '
  index($0, head) == 1 { on = 1; next }
  on && /^#/ { exit }
  on { print }
' README.md)

args=(--title "OnCue $version" --target "${GITHUB_SHA:-$(git rev-parse HEAD)}")
if [[ -n "${notes//[[:space:]]/}" ]]; then
  args+=(--notes "$notes")
else
  echo "::warning::README.md has no changelog entry for $version; using generated notes."
  args+=(--generate-notes)
fi

if [[ "${DRY_RUN:-}" == true ]]; then
  echo "Would create release $tag: ${args[*]}"
  exit 0
fi
gh release create "$tag" "${args[@]}"
