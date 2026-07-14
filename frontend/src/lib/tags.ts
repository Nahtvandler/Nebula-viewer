// Цвет и радиус узла по тегу (из мокапа). Неизвестные теги — дефолт.

export const TAG_COLOR: Record<string, string> = {
  System: '--tag-system',
  Module: '--tag-module',
  Component: '--tag-component',
  ApiEndpoint: '--tag-endpoint',
  DTO: '--tag-dto',
  OutboundCall: '--tag-outbound',
  ExternalSystem: '--tag-external',
  MessageChannel: '--tag-channel',
  Table: '--tag-table',
  GitFile: '--tag-gitfile',
  GitFileVersion: '--tag-version',
  CodeChunk: '--tag-chunk',
  ServiceUrlConfig: '--tag-config',
  ServicePathConfig: '--tag-config',
}

export const TAG_RADIUS: Record<string, number> = {
  System: 42,
  Module: 33,
  Component: 30,
  ExternalSystem: 28,
  MessageChannel: 26,
  Table: 26,
  OutboundCall: 25,
  ApiEndpoint: 25,
  GitFile: 24,
  DTO: 22,
  GitFileVersion: 22,
  CodeChunk: 20,
  ServiceUrlConfig: 22,
  ServicePathConfig: 22,
}

const DEFAULT_COLOR = '--tag-default'
const DEFAULT_RADIUS = 24

export function tagColorVar(tag: string | undefined): string {
  return (tag && TAG_COLOR[tag]) || DEFAULT_COLOR
}

export function tagRadius(tag: string | undefined): number {
  return (tag && TAG_RADIUS[tag]) || DEFAULT_RADIUS
}

/** Первый (главный) тег узла — им определяем цвет/размер. */
export function primaryTag(tags: string[]): string | undefined {
  return tags && tags.length ? tags[0] : undefined
}
