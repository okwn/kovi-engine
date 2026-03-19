import type {
  ExtractorAiFallback,
  NormalizedEntity,
  SourceDefinition,
  PageType
} from '@kovi/source-sdk';

export class DisabledAiFallback implements ExtractorAiFallback {
  public async extractFromHtml(
    html: string,
    source: SourceDefinition,
    pageType: Exclude<PageType, 'unknown'>
  ): Promise<NormalizedEntity[]> {
    void html;
    void source;
    void pageType;
    return [];
  }
}
