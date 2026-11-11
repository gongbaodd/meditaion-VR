import { AssetType, defineAssets } from '@iwsdk/core';

/**
 * Only the spatial UI panels are declared here. HDRIs are loaded on demand by
 * PlaceSystem (one place at a time), so they don't block startup.
 */
const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'menu-panel': uikitml('menu.uikitml', 'Menu Panel'),
  'cue-panel': uikitml('cue.uikitml', 'Cue Caption'),
  'hud-panel': uikitml('hud.uikitml', 'Session HUD'),
  'pause-panel': uikitml('pause.uikitml', 'Pause Panel'),
  'summary-panel': uikitml('summary.uikitml', 'Summary Panel'),
});
