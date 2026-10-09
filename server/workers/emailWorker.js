import 'dotenv/config';
import { processEmailQueueOnce } from '../services/emailService.js';
import { store } from '../services/store.js';
import { logger } from '../services/logger.js';

const intervalMs = Math.max(250, Number(process.env.EMAIL_WORKER_INTERVAL_MS || 2000));
const batchSize = Math.max(1, Math.min(50, Number(process.env.EMAIL_WORKER_BATCH_SIZE || 10)));
let stopping = false;

async function tick() {
  try {
    const result = await processEmailQueueOnce(batchSize);
    if (result.claimed) logger.info('email.worker.processed', result);
  } catch (err) {
    logger.error('email.worker.error', { error: err });
  }
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info('email.worker.shutdown', { signal });
  try {
    if (typeof store.close === 'function') await store.close();
  } finally {
    process.exit(0);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

logger.info('email.worker.started', { intervalMs, batchSize });
await tick();
const timer = setInterval(() => { if (!stopping) void tick(); }, intervalMs);
timer.unref?.();
