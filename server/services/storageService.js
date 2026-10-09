import fs from 'fs/promises';
import path from 'path';
import crypto from 'node:crypto';

let S3Client;
let PutObjectCommand;
let GetObjectCommand;
let DeleteObjectCommand;

async function loadS3() {
  if (!S3Client) {
    const mod = await import('@aws-sdk/client-s3');
    S3Client = mod.S3Client;
    PutObjectCommand = mod.PutObjectCommand;
    GetObjectCommand = mod.GetObjectCommand;
    DeleteObjectCommand = mod.DeleteObjectCommand;
  }
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
    await loadS3();
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('S3_BUCKET is required when OBJECT_STORAGE_PROVIDER=s3.');
    const client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: process.env.S3_ACCESS_KEY_ID ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      } : undefined
    });
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
    await loadS3();
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('S3_BUCKET is required when OBJECT_STORAGE_PROVIDER=s3.');
    const client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: process.env.S3_ACCESS_KEY_ID ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      } : undefined
    });
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
  const rawKey = String(ref.storedName || ref.objectKey || '').replace(/^[/\\]*resumes[/\\]/i, '');
  const stored = path.basename(rawKey);
  if (!stored || stored !== rawKey) return null;
  const filePath = path.join(root, stored);
  const rootPrefix = `${root}${path.sep}`;
  if (!filePath.startsWith(rootPrefix)) throw new Error('Stored resume reference is invalid.');
  try {
    return {
      buffer: await fs.readFile(filePath),
      mimeType: ref.mimeType || 'application/octet-stream',
      originalName: safeName(ref.originalName || stored)
    };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export const sanitizeOriginalFileName = safeName;

export async function deleteResume(ref) {
  if (!ref) return;
  const provider = ref.provider || storageProvider();
  if (provider === 's3') {
    await loadS3();
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return;
    const client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: process.env.S3_ACCESS_KEY_ID ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      } : undefined
    });
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
