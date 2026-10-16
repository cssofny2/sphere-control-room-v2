// Version, author and copyright shown in the app. Values are filled in at build time (see vite.config.ts and site.info.json).
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
declare const __COMMIT__: string;
declare const __COPYRIGHT_YEARS__: string;
declare const __SITE__: { name: string; url: string; author: string; owner: string; startYear: number };

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const BUILD_DATE: string = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '';
export const COMMIT: string = typeof __COMMIT__ === 'string' ? __COMMIT__ : 'local';
export const AUTHOR = typeof __SITE__ === 'object' ? __SITE__.author : 'Michael P. Goodman';
export const OWNER = typeof __SITE__ === 'object' ? __SITE__.owner : 'SPHERE Research, LLC';
export const COPYRIGHT_YEARS: string = typeof __COPYRIGHT_YEARS__ === 'string' ? __COPYRIGHT_YEARS__ : '2026';
export const COPYRIGHT_LINE = `© ${COPYRIGHT_YEARS} ${OWNER}. All rights reserved.`;
export const CREDIT_LINE = `Designed and developed by ${AUTHOR}.`;
export const VERSION_LABEL = `v${APP_VERSION}`;
export const VERSION_TITLE = `S.P.H.E.R.E. Metrology Lab version ${APP_VERSION}${BUILD_DATE ? `, built ${BUILD_DATE}` : ''}${COMMIT && COMMIT !== 'local' ? `, commit ${COMMIT}` : ''}`;
