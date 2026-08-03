import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import path from 'path';

@Injectable()
export class FfmpegWorker {
  private readonly logger = new Logger(FfmpegWorker.name);

  async transcodeToHls(inputPath: string, outDir: string) {
    if (process.env.MOCK_FFMPEG === '1') {
      // Use mock behavior to produce a minimal manifest
      const { runFfmpegMock } = require('../ffmpeg/ffmpeg.mock');
      return runFfmpegMock(inputPath, outDir);
    }

    // Ensure ffmpeg binary is available via env or system path
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const manifest = path.join(outDir, 'index.m3u8');
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-g', '48',
      '-sc_threshold', '0',
      '-b:v', '2500k',
      '-maxrate', '2675k',
      '-bufsize', '3750k',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-f', 'hls',
      manifest,
    ];

    return new Promise<string>((resolve, reject) => {
      const ff = spawn(ffmpegPath, args, { stdio: 'inherit' });
      ff.on('exit', (code) => {
        if (code === 0) resolve(manifest);
        else reject(new Error('ffmpeg failed with code ' + code));
      });
      ff.on('error', (err) => reject(err));
    });
  }
}
