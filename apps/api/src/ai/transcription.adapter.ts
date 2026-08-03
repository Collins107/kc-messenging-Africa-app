export interface TranscriptionResult {
  segments: Array<{ start: number; end: number; text: string }>;
}

export interface TranscriptionAdapter {
  transcribeStream(stream: any, options?: any): AsyncIterable<TranscriptionResult> | Promise<TranscriptionResult>;
}

// Simple mock adapter for CI/dev
export class MockTranscriptionAdapter implements TranscriptionAdapter {
  async transcribeStream(_stream: any) {
    // Return a deterministic transcript for tests
    return {
      segments: [
        { start: 0, end: 3, text: 'Hello from KC AI (mock).' },
        { start: 4, end: 7, text: 'This is a test transcription.' },
      ],
    };
  }
}
