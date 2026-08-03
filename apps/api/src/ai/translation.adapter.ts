export interface TranslationResult {
  text: string;
  language: string;
}

export interface TranslationAdapter {
  translate(text: string, targetLang: string): Promise<TranslationResult>;
}

export class MockTranslationAdapter implements TranslationAdapter {
  async translate(text: string, targetLang: string) {
    // very simple mock: append language code
    return { text: `[${targetLang}] ${text}`, language: targetLang };
  }
}
