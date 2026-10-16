import type { Plugin } from 'vite';
export const SITE: { name: string; shortName: string; url: string; projectUrl: string; author: string; owner: string; startYear: number; title: string; description: string };
export const VERSION: string;
export function copyrightYears(start?: number, now?: Date): string;
export function buildDate(now?: Date): string;
export function commitShort(env?: Record<string, string | undefined>): string;
export function sitemapXml(lastmod?: string): string;
export function fillHtml(html: string, now?: Date): string;
export function seoPlugin(): Plugin;
