// api/upload.js — File upload presigned URL generation
// Generates presigned URLs for direct upload to R2/S3

import jwt from 'jsonwebtoken';
import { getCorsHeaders } from './_lib/cors.js';
import { generatePresignedUrl, generateArtifactKey, isStorageConfigured } from './_lib/storage/index.js';

const JWT_SECRET = process.env.JWT_SECRET;

function getAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const cors = getCorsHeaders(req);
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = getAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
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
    return res.status(400).json({ error: 'project_id and filename are required' });
  }

  try {
    // Generate unique key
    const key = generateArtifactKey(project_id, workflow_id || 'general', filename);
    
    // Generate presigned URL (valid for 1 hour)
    const { uploadUrl, publicUrl } = await generatePresignedUrl({
      key,
      contentType: content_type,
      expiresIn: 3600,
    });

    return res.status(200).json({
      success: true,
      upload_url: uploadUrl,
      public_url: publicUrl,
      key,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
  } catch (e) {
    console.error('[Upload] Error generating presigned URL:', e);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}
