import fs from 'fs/promises';
import path from 'path';
import crypto from 'node:crypto';

let S3Client;
let PutObjectCommand;
let GetObjectCommand;
let DeleteObjectCommand;
let s3Client;
let s3ClientConfigKey;

async function loadS3() {
  if (!S3Client) {
    const mod = await import('@aws-sdk/client-s3');
    S3Client = mod.S3Client;
    PutObjectCommand = mod.PutObjectCommand;
    GetObjectCommand = mod.GetObjectCommand;
    DeleteObjectCommand = mod.DeleteObjectCommand;
  }
}

// Reuse one S3-compatible client for Cloudflare R2 instead of creating a new
// client for every resume operation. Credentials remain server-side in .env.
async function getS3Client() {
  await loadS3();
  const bucket = String(process.env.S3_BUCKET || '').trim();
  const endpoint = String(process.env.S3_ENDPOINT || '').trim();
  const accessKeyId = String(process.env.S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.S3_SECRET_ACCESS_KEY || '').trim();

  if (!bucket) throw new Error('S3_BUCKET is required when OBJECT_STORAGE_PROVIDER=s3.');
  if (!endpoint) throw new Error('S3_ENDPOINT is required for Cloudflare R2.');
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required for Cloudflare R2.');
  }

  const configKey = JSON.stringify({
    region: process.env.S3_REGION || 'auto',
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    accessKeyId,
    secretAccessKey
  });
  if (!s3Client || s3ClientConfigKey !== configKey) {
    s3Client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: { accessKeyId, secretAccessKey }
    });
    s3ClientConfigKey = configKey;
  }
  return { client: s3Client, bucket };
}

function safeName(name) {
  return String(name || 'resume').replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, ' ').slice(0, 180) || 'resume';
}

export function storageProvider() {
  return String(process.env.OBJECT_STORAGE_PROVIDER || 'local').toLowerCase();
}

export async function putResume(file) {
  if (!file) return null;
  const provider = storageProvider();
  const extension = path.extname(file.originalname || '').toLowerCase();
  const key = `resumes/${crypto.randomUUID()}${extension}`;

  if (provider === 's3') {
    const { client, bucket } = await getS3Client();
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: { originalname: safeName(file.originalname) }
    }));
    return {
      provider: 's3',
      storedName: key,
      objectKey: key,
      originalName: safeName(file.originalname),
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: Date.now()
    };
  }

  const root = path.resolve(process.env.LOCAL_UPLOAD_ROOT || 'server/data/uploads');
  await fs.mkdir(root, { recursive: true });
  const storedName = path.basename(key);
  const target = path.join(root, storedName);
  await fs.writeFile(target, file.buffer, { flag: 'wx' });
  return {
    provider: 'local',
    storedName,
    objectKey: storedName,
    originalName: safeName(file.originalname),
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: Date.now()
  };
}

export async function getResume(ref) {
  if (!ref) return null;
  const provider = ref.provider || storageProvider();
  if (provider === 's3') {
    const { client, bucket } = await getS3Client();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: ref.objectKey || ref.storedName }));
    const chunks = [];
    for await (const chunk of result.Body) chunks.push(Buffer.from(chunk));
    return {
      buffer: Buffer.concat(chunks),
      mimeType: ref.mimeType || result.ContentType || 'application/octet-stream',
      originalName: safeName(ref.originalName)
    };
  }

  const root = path.resolve(process.env.LOCAL_UPLOAD_ROOT || 'server/data/uploads');
  // Older records used values such as "resumes/<file>", "server/data/uploads/<file>",
  // or absolute paths. Resolve only the basename and search known local storage roots;
  // never trust a database path to read arbitrary files.
  const rawKey = String(ref.storedName || ref.objectKey || ref.path || ref.filePath || '');
  const stored = path.basename(rawKey.replace(/\\/g, '/'));
  if (!stored || stored === '.' || stored === path.sep) return null;
  const candidates = [
    path.join(root, stored),
    path.join(root, 'resumes', stored),
    path.resolve('server/data/uploads', stored),
    path.resolve('uploads', stored)
  ];
  for (const filePath of [...new Set(candidates)]) {
    try {
      const buffer = await fs.readFile(filePath);
      return {
        buffer,
        mimeType: ref.mimeType || 'application/octet-stream',
        originalName: safeName(ref.originalName || stored)
      };
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
    }
  }
  return null;
}

export const sanitizeOriginalFileName = safeName;

export async function deleteResume(ref) {
  if (!ref) return;
  const provider = ref.provider || storageProvider();
  if (provider === 's3') {
    const { client, bucket } = await getS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: ref.objectKey || ref.storedName }));
    return;
  }

  const root = path.resolve(process.env.LOCAL_UPLOAD_ROOT || 'server/data/uploads');
  const rawKey = String(ref.storedName || ref.objectKey || '').replace(/^[/\\]*resumes[/\\]/i, '');
  const stored = path.basename(rawKey);
  if (!stored || stored !== rawKey) return;
  const filePath = path.join(root, stored);
  if (!filePath.startsWith(`${root}${path.sep}`)) return;
  await fs.rm(filePath, { force: true });
}
