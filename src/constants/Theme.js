/**
 * Theme constants shared by the 3D view (WebGL colours cannot come from CSS variables).
 * The DOM theme itself lives in css/theme.css and is toggled via body.theme-light.
 */
export const SCENE_BACKGROUND = { light: 0xf8fafc, dark: 0x0b0f19 };
export const FOG_DENSITY = 0.025;

export function sceneBackground(isLight) {
  return isLight ? SCENE_BACKGROUND.light : SCENE_BACKGROUND.dark;
}
