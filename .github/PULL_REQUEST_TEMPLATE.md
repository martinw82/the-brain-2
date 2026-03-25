## Description

<!-- Briefly describe what this PR does and why -->

## Philosophy Checklist (required — tick all before requesting review)

- [ ] Does this entity know what created it? (`generated_by` relation exists)
- [ ] Does this entity know what it requires? (`depends_on` relations exist)
- [ ] Does this entity know what it enables? (`succeeded_by` relations exist)
- [ ] Can the full lineage of any asset be traced to root? (End-to-end provenance chain)
- [ ] If this entity is deleted, do we know what breaks? (Orphan detection identifies downstream)
- [ ] Is this workflow gated by Trust Ladder? (All workflows start Tier 1)
- [ ] Is the execution package signed? (Policy_id present; full signing in Phase 6)
- [ ] Are worker capabilities checked before routing? (Worker Capability Registry validates)

**If any box is unchecked, this PR does not ship.**
