export interface SummaryResult {
  title: string;
  summary: string;
}

export interface SummarizerAdapter {
  summarize(text: string): Promise<SummaryResult>;
}

export class MockSummarizerAdapter implements SummarizerAdapter {
  async summarize(text: string) {
    const snippet = text.slice(0, 160);
    return { title: 'Meeting summary (mock)', summary: `${snippet}...` };
  }
}
