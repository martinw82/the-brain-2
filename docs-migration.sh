#!/bin/bash
# Run from repo root to apply the documentation consolidation
# Usage: bash docs-migration.sh

echo "Creating docs/archive/..."
mkdir -p docs/archive

echo "Archiving completed/redundant files..."
ARCHIVE_FILES=(
  "ROADMAP-v2.md"
  "brain-roadmap.md"
  "REFACTOR_TASKS.md"
  "TEST-SUITE-FINAL.md"
  "TEST-SUITE-SUMMARY.md"
  "SESSION-PROMPT.md"
  "the-brain-v2-2-userguide.md"
  "agent-architecture-decision.md"
  "agent-workflow-architecture.md"
  "ARCHITECTURE-v2.md"
  "BRAIN-OS-V2.2-UPDATE.md"
)

for f in "${ARCHIVE_FILES[@]}"; do
  if [ -f "$f" ]; then
    mv "$f" "docs/archive/$f"
    echo "  archived: $f"
  else
    echo "  skipped (not found): $f"
  fi
done

echo ""
echo "Replacing updated files..."
echo "  Copy brain-status.md from outputs"
echo "  Copy agent-brief.md from outputs"
echo "  Copy README.md from outputs"
echo "  Copy CHANGELOG.md (new) from outputs"
echo "  Append dev-log-append.md to dev-log.md"
echo ""
echo "Manual steps remaining:"
echo "  1. Copy the 4 new/updated .md files from the downloaded outputs"
echo "  2. Run: cat dev-log-append.md >> dev-log.md"
echo "  3. git add -A && git commit -m 'docs: consolidate v2.2 documentation, archive completed files'"
echo ""
echo "Done."