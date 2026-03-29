// Handler for upload resources: upload
// Merged from api/upload.js into data.js handler pattern

import { generatePresignedUrl, generateArtifactKey, isStorageConfigured } from '../storage/index.js';

export default async function handleUpload(req, res, { db, userId, ok, err }) {
  if (req.method !== 'POST') {
    return err(res, 'Method not allowed', 405);
  }

  // Check storage configuration
  if (!isStorageConfigured()) {
    return res.status(503).json({
      error: 'Storage not configured',
      message: 'File uploads are not available. R2/S3 credentials required.',
    });
  }

  const {
    project_id,
    workflow_id,
    filename,
    content_type = 'application/octet-stream',
    file_size,
  } = req.body || {};

  if (!project_id || !filename) {
    return err(res, 'project_id and filename are required');
  }

  // Generate unique key
  const key = generateArtifactKey(project_id, workflow_id || 'general', filename);

  // Generate presigned URL (valid for 1 hour)
  const { uploadUrl, publicUrl } = await generatePresignedUrl({
    key,
    contentType: content_type,
    expiresIn: 3600,
  });

  return ok(res, {
    success: true,
    upload_url: uploadUrl,
    public_url: publicUrl,
    key,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
}
