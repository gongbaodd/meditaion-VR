import { AssetType, defineAssets } from '@iwsdk/core';
import hubDial from './scene-assets/hub-dial.scene-asset.js';
import hubFloor from './scene-assets/hub-floor.scene-asset.js';
import placeWindow from './scene-assets/place-window.scene-asset.js';

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
  'place-window': placeWindow,
  'hub-dial': hubDial,
  'hub-floor': hubFloor,
  'hub-title-panel': uikitml('hub-title.uikitml', 'Hub Title'),
  'window-label-panel': uikitml('window-label.uikitml', 'Window Label'),
});
