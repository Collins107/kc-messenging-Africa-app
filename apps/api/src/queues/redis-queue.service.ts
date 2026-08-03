import { Injectable, Logger } from '@nestjs/common';
import { InMemoryQueueService, QueueJob } from './inmemory-queue.service';

let Bull: any;
try { Bull = require('bullmq'); } catch (e) { Bull = null; }

@Injectable()
export class RedisQueueService {
  private readonly logger = new Logger(RedisQueueService.name);
  private redisUrl = process.env.REDIS_URL;
  private useRedis = !!this.redisUrl && !!Bull;
  private inMemory = new InMemoryQueueService();
  private queue: any;

  constructor() {
    if (this.useRedis) {
      const { Queue } = Bull;
      this.queue = new Queue('kc-jobs', { connection: { url: this.redisUrl } });
      this.logger.log('Using Redis-backed BullMQ queue');
    } else {
      this.logger.warn('Redis/BullMQ not configured — using in-memory queue fallback');
    }
  }

  async add(job: QueueJob) {
    if (this.useRedis) {
      await this.queue.add(job.type, job.payload, { jobId: job.id });
      return job.id;
    }
    return this.inMemory.add(job);
  }

  async getNext() {
    if (this.useRedis) {
      // Redis-backed consumers should be separate worker processes; not used here.
      return null;
    }
    return this.inMemory.getNext();
  }

  async count() {
    if (this.useRedis) return (await this.queue.getJobCounts()).waiting || 0;
    return this.inMemory.count();
  }
}
