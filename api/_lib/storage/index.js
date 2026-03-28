/**
 * Storage Utility
 * 
 * Handles file uploads using S3-compatible APIs (R2, S3, etc.)
 * Generates presigned URLs for direct upload from workers.
 */

/**
 * Generate a presigned URL for file upload
 * 
 * @param {object} options
 * @param {string} options.key - File path/key in bucket
 * @param {string} options.contentType - MIME type
 * @param {number} options.expiresIn - URL expiration in seconds (default: 3600)
 * @returns {Promise<{uploadUrl: string, publicUrl: string}>}
 */
export async function generatePresignedUrl({ key, contentType = 'application/octet-stream', expiresIn = 3600 }) {
  // Check if R2/S3 credentials are configured
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || 'spine-uploads';
  
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Storage credentials not configured');
  }

  // For Cloudflare R2
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  
  // Import AWS SDK dynamically (only when needed)
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  
  const s3Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  
  // Public URL (if bucket is public) or temporary access URL
  const publicUrl = `${endpoint}/${bucket}/${key}`;
  
  return {
    uploadUrl,
    publicUrl,
    key,
    bucket,
    expiresIn,
  };
}

/**
 * Generate a key for workflow artifacts
 */
export function generateArtifactKey(projectId, workflowId, filename) {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `projects/${projectId}/workflows/${workflowId}/${timestamp}_${sanitized}`;
}

/**
 * Check if storage is configured
 */
export function isStorageConfigured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

export default {
  generatePresignedUrl,
  generateArtifactKey,
  isStorageConfigured,
};
