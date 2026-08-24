#!/usr/bin/env bash
set -euo pipefail

if [ -f contracts/Cargo.toml ]; then
  (cd contracts && cargo test --workspace && stellar contract build)
elif [ -f Cargo.toml ]; then
  cargo test --workspace
  stellar contract build
fi

verify_node_project() {
  local dir="$1"
  [ -f "$dir/package.json" ] || return 0

  local runner
  if [ -f "$dir/pnpm-lock.yaml" ]; then runner=pnpm; elif [ -f "$dir/yarn.lock" ]; then runner=yarn; else runner=npm; fi

  if [ "$runner" = pnpm ]; then (cd "$dir" && pnpm install --frozen-lockfile); fi

  for script in lint typecheck test build; do
    if (cd "$dir" && node -e "const p=require('./package.json'); process.exit(p.scripts&&p.scripts['$script']?0:1)"); then
      if [ "$runner" = npm ]; then (cd "$dir" && npm run "$script"); else (cd "$dir" && "$runner" "$script"); fi
    fi
  done
}

if command -v node >/dev/null 2>&1; then
  verify_node_project web
  verify_node_project .
fi

echo "Verification commands completed."
