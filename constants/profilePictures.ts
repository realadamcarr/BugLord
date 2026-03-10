// Profile picture options — 'default' renders PixelatedEmoji, the rest are PNG assets.

export interface ProfilePictureOption {
  key: string;
  label: string;
  source: any; // require() result or null for the default pixelated emoji
}

export const PROFILE_PICTURES: ProfilePictureOption[] = [
  { key: 'default', label: 'Bug Explorer', source: null },
  { key: 'ant', label: 'Ant', source: require('../assets/pfps/antpfp.png') },
  { key: 'butterfly', label: 'Butterfly', source: require('../assets/pfps/butterflypfp.png') },
  { key: 'spider', label: 'Spider', source: require('../assets/pfps/spiderpfp.png') },
  { key: 'battle', label: 'Bug Battle', source: require('../assets/pfps/bugbattlepfp.png') },
];

/** Look up the source for a profile picture key. Returns null for 'default'. */
export function getProfilePictureSource(key: string): any {
  const found = PROFILE_PICTURES.find(p => p.key === key);
  return found?.source ?? null;
}
