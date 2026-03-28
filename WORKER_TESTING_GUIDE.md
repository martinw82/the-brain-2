# Spine Desktop Worker - Testing Guide

## Phase 1B Complete ✅

The Desktop Worker system is now ready for testing. This guide walks through testing the end-to-end video rendering pipeline.

---

## Prerequisites

1. **TiDB Database** - Migration applied
2. **R2 Storage** - Credentials configured (optional, for video upload)
3. **Node.js 18+** on your local machine
4. **Spine API Token** - Get from your account settings

---

## Step 1: Apply Database Migration

```bash
# Connect to TiDB and run:
mysql -h <tidb-host> -P 4000 -u <user> -p < scripts/migrations/0003_worker_system.sql
```

---

## Step 2: Configure Environment Variables (Vercel)

Add these to your Vercel project:

```bash
# R2 Storage (optional - for video uploads)
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=spine-uploads
```

---

## Step 3: Install and Configure Worker

```bash
# Navigate to worker package
cd packages/spine-worker

# Install dependencies
npm install

# Configure worker
node bin/spine-worker.js init \
  --url https://the-brain-2.vercel.app \
  --token YOUR_SPINE_API_TOKEN \
  --name my-desktop-worker

# Verify config
cat ~/.spine/worker.json
```

---

## Step 4: Start the Worker

```bash
# Start the worker
node bin/spine-worker.js start

# You should see:
# 🚀 Spine Worker Starting...
# URL: https://the-brain-2.vercel.app
# Worker: my-desktop-worker
# 
# ✅ Registered with worker ID: my-desktop-worker
# ✅ SSE connection established
# ✅ Worker is online and waiting for jobs
#
# Waiting for jobs... (Press Ctrl+C to stop)
```

---

## Step 5: Create a Test Project

1. Open Spine in browser: https://the-brain-2.vercel.app
2. Create a new project
3. Check the **Workers** panel - you should see your worker listed as 🟢 Online

---

## Step 6: Run Test Workflow

### Option A: Test with Simple Shell Job

Create a simple workflow template or use the API directly:

```bash
curl -X POST https://the-brain-2.vercel.app/api/workflow-job?action=queue \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "your-project-id",
    "job_type": "shell.execute",
    "payload": {
      "command": "echo",
      "args": ["Hello from Spine Worker!"]
    }
  }'
```

Your worker terminal should show:
```
🎯 Received job: shell.execute (job-xxx)
Project: your-project-id

Executing shell.execute...
✅ Job completed in 50ms
Result reported to Spine
```

### Option B: Test with Remotion Video Render

1. Create a storyboard JSON file (`test-storyboard.json`):

```json
{
  "composition_id": "test-video",
  "title": "Test Video",
  "segments": [
    {
      "segment_id": "intro",
      "scenes": [
        {
          "scene_id": "scene-1",
          "text": "Hello from Spine!",
          "visual_type": "text_overlay",
          "background_color": "#1a1a1a",
          "duration_s": 3
        },
        {
          "scene_id": "scene-2",
          "text": "This is a test render",
          "visual_type": "ken_burns",
          "image_url": "https://images.pexels.com/photos/1695052/pexels-photo-1695052.jpeg",
          "duration_s": 5,
          "zoom_direction": "in"
        }
      ]
    }
  ]
}
```

2. Queue a video render job:

```bash
curl -X POST https://the-brain-2.vercel.app/api/workflow-job?action=queue \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "your-project-id",
    "job_type": "video.render",
    "payload": {
      "storyboard_json": { ... paste JSON above ... },
      "output_format": "mp4",
      "output_resolution": "1080p"
    }
  }'
```

3. Your worker should:
   - Receive the job
   - Install Remotion dependencies
   - Render the video
   - Upload to R2 (if configured)
   - Report success

---

## Step 7: Verify in Spine UI

1. Open your project in Spine
2. Go to **Workflows** tab
3. You should see:
   - **Worker Status Panel** showing your connected worker
   - Completed jobs in the execution log
   - If using YouTube Factory: rendered video in project files

---

## Troubleshooting

### Worker won't connect
```bash
# Check network
ping the-brain-2.vercel.app

# Test API token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://the-brain-2.vercel.app/api/worker?action=status
```

### Database migration not applied
```sql
-- Check if tables exist
SHOW TABLES LIKE 'worker%';
SHOW TABLES LIKE 'job_queue';

-- If missing, re-run migration
source scripts/migrations/0003_worker_system.sql;
```

### Video upload fails
- Check R2 credentials are set in Vercel
- Verify bucket exists and is writable
- Check worker logs for specific error

### Remotion render fails
- Ensure Node.js 18+ is installed
- Check `npx remotion --version` works
- Check worker has sufficient disk space

---

## Expected Test Results

| Test | Expected Result | Status |
|------|-----------------|--------|
| Worker connects via SSE | ✅ Online status in UI | ⬜ |
| Shell job execution | ✅ Echo output returned | ⬜ |
| Video render | ✅ MP4 file created | ⬜ |
| Video upload | ✅ File uploaded to R2 | ⬜ |
| "Waiting for worker" UI | ✅ Shows when no workers | ⬜ |
| Worker status panel | ✅ Lists capabilities | ⬜ |

---

## Next Steps (Phase 2)

Once Phase 1B tests pass:
1. Integrate with YouTube Factory pipeline
2. Add trust gates for render approval
3. Build video preview in Spine UI
4. Add retry logic for failed renders

---

*Guide created: 2026-03-28*
