#!/usr/bin/env bash
# Starts the local Midnight devnet, retrying if the indexer crashes.
#
# The indexer occasionally exits if it queries the node for block 1 before
# the node has actually produced it yet ("Cannot construct OnlineClientAtBlock:
# block number 1 not found") — a startup race in the reference docker-compose
# setup, not this project's code. The node's healthcheck only confirms its
# RPC endpoint responds, not that it has produced a block past genesis, so
# this can't be avoided by waiting on healthchecks alone. Retrying clears it.
set -e

MAX_ATTEMPTS=5

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "Starting local devnet (attempt $attempt/$MAX_ATTEMPTS)..."
  if docker compose up -d --wait; then
    exit 0
  fi
  echo "Attempt $attempt failed — tearing down and retrying..."
  docker compose down --remove-orphans
  sleep 3
done

echo "Failed to start the local devnet after $MAX_ATTEMPTS attempts."
exit 1
