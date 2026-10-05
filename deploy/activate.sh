#!/usr/bin/env bash
set -euo pipefail
sha="${1:?Expected release commit SHA}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
base=/var/www/code-museum
release="$base/releases/$sha"
test -f "$release/dist/index.html"
test -f "$release/server/analytics.py"
old_target="$(readlink "$base/current" || true)"
if [[ -n "$old_target" ]]; then
  [[ "$old_target" =~ ^releases/[0-9a-f]{40}$ ]]
fi
temporary="$base/.current-$$"
rollback() {
  rm -f "$temporary"
  if [[ -n "$old_target" ]]; then
    ln -s "$old_target" "$temporary"
    mv -Tf "$temporary" "$base/current"
    sudo -n systemctl restart code-museum-analytics || true
    echo 'Activation failed; previous release restored.' >&2
  else
    echo 'Initial activation failed; inspect analytics service before accepting release.' >&2
  fi
}
trap rollback ERR
ln -s "releases/$sha" "$temporary"
mv -Tf "$temporary" "$base/current"
sudo -n systemctl restart code-museum-analytics
curl --fail --silent --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:4180/healthz >/dev/null
trap - ERR
echo "Activated $sha"
