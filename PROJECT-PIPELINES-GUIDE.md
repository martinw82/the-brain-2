# Project Pipelines — User Guide

Quick-start guide for the three v2.2 project pipelines: YouTube Factory, Competition Hunter, and B2B Outreach.

---

## 1. YouTube Factory

Produces upload-ready long-form videos (8-15 min) from a topic idea.

### Pipeline Steps

| # | Step | What Happens | You Do |
|---|------|-------------|--------|
| 1 | Research | Agent searches trending topics, validates search volume, finds unique angles | Nothing — automatic |
| 2 | Script | Writes 4-6 segment script (600-900 words each) with B-roll notes | Nothing — automatic |
| 3 | **Script Review** | -- | **Approve or reject the script** |
| 4 | Retention Review | Checks for weak hooks, missing pattern interrupts, long exposition | Nothing — automatic |
| 5 | Storyboard | Converts script to Remotion-compatible JSON with scene timings | Nothing — automatic |
| 6 | **Storyboard Review** | -- | **Approve visual direction** |
| 7 | Keywords/SEO | Generates titles, descriptions, tags, thumbnail text | Nothing — automatic |
| 8 | Asset Sourcing | Fetches stock footage, generates stills, creates text overlays | Nothing — automatic |
| 9 | Render | Remotion renders the video | Nothing — automatic |
| 10 | Assessment | Scores output across 5 dimensions (must all pass threshold) | Nothing — automatic |
| 11 | **Pre-Upload Review** | -- | **Final approval before upload prep** |
| 12 | Upload Prep | Packages video + metadata into upload-ready folder | Nothing — automatic |

### Trust Gates (3)

You must approve at three checkpoints: script, storyboard, and pre-upload. These appear in the **Trust Approval Panel**. As the pipeline builds trust (20+ runs, 90%+ approval), gates relax to batch mode, then autopilot.

### Agents Used

| Agent | Model | Cost | Time |
|-------|-------|------|------|
| Research | Sonnet 4.6 | ~$0.04 | ~20 min |
| Script Writer | Sonnet 4.6 | ~$0.05 | ~30 min |
| Storyboard | Haiku 4.5 | ~$0.01 | ~10 min |
| Keywords/SEO | Haiku 4.5 | ~$0.008 | ~8 min |
| Retention Analyzer | Sonnet 4.6 | ~$0.04 | ~15 min |
| Assessment | Sonnet 4.6 | ~$0.03 | ~12 min |

**Estimated total cost per video: ~$0.18**

### Output Files

```
YT_RESEARCH_{topic}_{date}.md      — Research findings
YT_SCRIPT_{topic}_{date}.md        — Segmented script
YT_RETENTION_{topic}_{date}.md     — Retention analysis
YT_STORYBOARD_{topic}_{date}.json  — Remotion scene data
YT_SEO_{topic}_{date}.md           — Titles, tags, description
YT_ASSESSMENT_{topic}_{date}.md    — Quality scorecard
renders/{topic}_{date}.mp4         — Rendered video
upload_ready/{topic}_{date}/       — Final package
```

### Assessment Thresholds

The video is blocked if any dimension scores below its threshold:

| Dimension | Minimum Score |
|-----------|--------------|
| Factual Accuracy | 7/10 |
| Narrative Engagement | 6/10 |
| Visual Variety | 6/10 |
| SEO Potential | 6/10 |
| Production Readiness | 7/10 |

---

## 2. Competition Hunter

Finds, scores, writes entries for, and submits to online competitions.

### Pipeline Steps

| # | Step | What Happens | You Do |
|---|------|-------------|--------|
| 1 | Research | Scrapes competition sites, extracts data, deduplicates via entity graph | Nothing — automatic |
| 2 | Score | Filters to 5.0+ composite score, ranks opportunities | Nothing — automatic |
| 3 | Style Detect | Tags each competition with a writing style | Nothing — automatic |
| 4 | Route to Writer | Sends brief to the matching style agent | Nothing — automatic |
| 5 | **Review** | -- | **Approve drafts in staging/** |
| 6 | Submit | Fills forms via Playwright, uploads, captures proof screenshots | Nothing — automatic (but requires prior approval) |

### Scoring Formula

Each competition is scored 0-10:

```
(prize_value x 0.3) + (effort x 0.2) + (odds x 0.2) + (deadline_pressure x 0.1) + (fit x 0.2)
```

Only competitions scoring **5.0+** proceed.

### Style Routing

The style detect step tags competitions, then routes to the correct writer:

| Style Tag | Writer Agent | Temperature |
|-----------|-------------|-------------|
| humorous | system-content-humorous-v1 | 0.8 |
| professional | system-content-professional-v1 | 0.4 |
| fiction | system-content-fiction-v1 | 0.7 |
| sad | system-content-sad-v1 | 0.7 |
| narrative | system-content-narrative-v1 | 0.7 |
| persuasive | system-content-persuasive-v1 | 0.6 |

### Trust Gates (2)

1. **Review** — approve all drafts before submission
2. **Submit** — requires approval (the submitter will not send without it)

The submitter also escalates to you if it encounters CAPTCHAs, payment requirements, or unexpected terms.

### Triggers

- **Manual** — run on demand
- **Weekly schedule** — automatic research sweep

---

## 3. B2B Outreach

Cold email pipeline with CRM tracking and follow-up management.

### Pipeline Steps

| # | Step | What Happens | You Do |
|---|------|-------------|--------|
| 1 | Research Prospect | Gathers company info, role, recent activity, pain points | Nothing — automatic |
| 2 | Draft Email | Writes cold email to `staging/` following strict tone rules | Nothing — automatic |
| 3 | **Review Gate** | -- | **Approve email draft** |
| 4 | **Send Email** | -- | **Approve send** (CRM updates to `email_sent`) |
| 5 | Monitor Reply | Watches inbox, updates CRM when reply detected | Nothing — automatic |
| 6 | Follow-Up | Drafts 72h and 5-day follow-ups if no reply | Nothing — automatic |

### Email Tone Rules

- Direct — no pleasantries, get to the point
- Value-first — lead with what you offer, not who you are
- Short paragraphs — scannable
- Human — sounds like a person, not a template

**Forbidden words:** synergy, leverage, circle back, touch base, low-hanging fruit

### CRM Status Chain

Each prospect moves through these statuses automatically:

```
lead → email_draft → email_sent → reply_detected → meeting_booked
```

Status is tracked via REL entity graph edges (`awaits_reply_by`, `responds_to`).

### Trust Gates (2)

1. **Review Gate** — approve draft before it can be sent
2. **Send Email** — explicit send approval

### Inbound Email Management (companion pipeline)

Runs alongside outreach to handle incoming replies:

| Step | What Happens |
|------|-------------|
| Fetch | Polls Gmail API (every 5 min during business hours, 30 min off-hours) |
| Classify | Sorts into: `lead_reply`, `newsletter`, `spam`, `support`, `personal` |
| Route | Lead replies update CRM; support creates tickets; spam archived |
| Notify | Summary logged to `inbound-log.md` |

The inbound pipeline is **fully automated** — no trust gates. It requires Gmail API OAuth 2.0 to be configured.

---

## Trust Ladder (applies to all pipelines)

All pipelines start at **Tier 1** (every gate needs your approval). As they build a track record, they earn more autonomy:

| Tier | Name | Behaviour | How to Reach |
|------|------|-----------|-------------|
| 1 | Full Approval | Every gate reviewed individually | Default |
| 2 | Batch Digest | Routine items grouped, approve in batches | 20+ runs, 90%+ approval, 5 consecutive approvals |
| 3 | Autopilot | Runs without approval, human override only | 40+ runs, 95%+ approval, 10 consecutive approvals |

**Regression:** If 15%+ of the last 10 runs are rejected, the pipeline drops back one tier (with a 24h cooldown).

All approvals happen in the **Trust Approval Panel** component (`TrustApprovalPanel.jsx`), accessible from the main UI.
