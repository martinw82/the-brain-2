// ── FILE HANDLERS ────────────────────────────────────────────
// Extracted from TheBrain.jsx

import { makeManifest } from './projectFactory.js';

export const getFileType = (path) => {
  const ext = path?.split('.').pop()?.toLowerCase() || '';
  const textExts = [
    'md',
    'json',
    'js',
    'ts',
    'py',
    'sol',
    'txt',
    'css',
    'html',
    'xml',
    'yaml',
    'yml',
    'env',
  ];
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  const archiveExts = ['zip', 'tar', 'gz', 'rar', '7z'];
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
  if (textExts.includes(ext)) return 'text';
  if (imageExts.includes(ext)) return 'image';
  if (audioExts.includes(ext)) return 'audio';
  if (videoExts.includes(ext)) return 'video';
  if (archiveExts.includes(ext)) return 'archive';
  if (docExts.includes(ext)) return 'document';
  return 'binary';
};

export const formatFileSize = (base64str) => {
  const kb = Math.floor(base64str.length / 4 / 1024);
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
};

export const buildZipExport = (project) => {
  const manifest = makeManifest(project);
  let out = `BUIDL_EXPORT_V1\nMANIFEST_START\n${JSON.stringify(manifest, null, 2)}\nMANIFEST_END\nFILES_START\n`;
  Object.entries(project.files || {}).forEach(([path, content]) => {
    out += `FILE_START:${path}\n${content || ''}\nFILE_END:${path}\n`;
  });
  out += `FILES_END\n`;
  return out;
};
