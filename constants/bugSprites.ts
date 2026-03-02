// 16-bit sprite icons for each bug category
// These map to the pre-made assets in assets/sprites/

export type BugCategory = 'bee' | 'butterfly' | 'beetle' | 'fly' | 'spider' | 'ant';

export const BUG_SPRITE: Record<BugCategory, any> = {
  bee: require('../assets/sprites/bee.png'),
  butterfly: require('../assets/sprites/butterfly.png'),
  beetle: require('../assets/sprites/beetle.png'),
  fly: require('../assets/sprites/fly.png'),
  spider: require('../assets/sprites/spider.png'),
  ant: require('../assets/sprites/ant.png'),
};
