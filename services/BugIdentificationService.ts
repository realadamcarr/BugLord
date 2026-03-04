// Bug Identification API Service
import * as ImageManipulator from 'expo-image-manipulator';
import pako from 'pako';
import { BugIdentificationResult, IdentificationCandidate, SAMPLE_BUGS, SampleBugColorProfile } from '../types/Bug';
import { labelToCategory } from '../utils/bugCategory';
import { getCandidateBoosts } from './LearningService';

export interface APIError {
  code: string;
  message: string;
}

// Configuration for different identification services
const API_CONFIG = {
  INATURALIST: {
    BASE_URL: 'https://api.inaturalist.org/v1',
    ENABLED: true,
  },
  GOOGLE_VISION: {
    BASE_URL: 'https://vision.googleapis.com/v1',
    API_KEY: '',
    ENABLED: false,
  },
  PLANTNET: {
    BASE_URL: 'https://my-api.plantnet.org/v2',
    API_KEY: '',
    ENABLED: false,
  }
};

// ─── Image color analysis types ──────────────────────────

interface ImageColorProfile {
  /** Dominant hue in degrees (0-360) */
  hue: number;
  /** Average brightness 0-1 */
  brightness: number;
  /** Average saturation 0-1 */
  saturation: number;
  /** Fraction of very dark pixels (< 0.15 brightness) */
  darkPixelRatio: number;
  /** Fraction of very bright pixels (> 0.85 brightness) */
  brightPixelRatio: number;
  /** Secondary hue if bimodal */
  secondaryHue: number;
  /** Overall warmth (-1 cool .. +1 warm) */
  warmth: number;
}

class BugIdentificationService {
  
  /**
   * Main identification method - tries APIs first, then image-based local analysis
   */
  /** Run local color analysis only — used when rescan exhausts all API candidates. */
  async identifyLocalOnly(photoUri: string): Promise<BugIdentificationResult> {
    const result = await this.identifyWithImageAnalysis(photoUri);
    return this.applyLearningBoosts(result);
  }

  async identify(photoUri: string): Promise<BugIdentificationResult> {
    console.log('🔍 Starting bug identification for photo:', photoUri);

    try {
      let iNatResult: BugIdentificationResult | null = null;

      // Try iNaturalist if enabled
      if (API_CONFIG.INATURALIST.ENABLED) {
        iNatResult = await this.identifyWithiNaturalist(photoUri);
        if (iNatResult && iNatResult.candidates.length > 0) {
          console.log(`✅ iNaturalist returned ${iNatResult.candidates.length} candidate(s): ${iNatResult.candidates[0]?.label}`);
        } else {
          console.log('🌿 iNaturalist returned no usable candidates, falling back to image analysis');
          iNatResult = null;
        }
      }

      // Try Google Vision API if available (only if iNaturalist failed)
      if (!iNatResult && API_CONFIG.GOOGLE_VISION.ENABLED && API_CONFIG.GOOGLE_VISION.API_KEY) {
        const result = await this.identifyWithGoogleVision(photoUri);
        if (result) {
          console.log('✅ Google Vision identification returned candidates');
          return result;
        }
      }

      // Always run local image analysis for category sanity-check / override
      const localResult = await this.identifyWithImageAnalysis(photoUri);
      console.log(`📱 Local analysis: ${localResult.candidates[0]?.label}`);

      // If iNaturalist returned results, compare by broad category.
      // Prefer local when they disagree — color profile is reliable for top-level category.
      const baseResult = iNatResult
        ? this.pickBestResult(iNatResult, localResult)
        : localResult;

      return await this.applyLearningBoosts(baseResult);

    } catch (error) {
      console.error('❌ Bug identification error:', error);
      return this.getFallbackIdentification(photoUri);
    }
  }

  /**
   * Compare iNaturalist and local-analysis results by broad bug category.
   * If they disagree on category, prefer local (color profile is more reliable
   * for broad category; iNaturalist is better for species-level precision).
   */
  private pickBestResult(
    iNatResult: BugIdentificationResult,
    localResult: BugIdentificationResult,
  ): BugIdentificationResult {
    const iNatLabel = iNatResult.candidates[0]?.label ?? '';
    const localLabel = localResult.candidates[0]?.label ?? '';

    const iNatCat  = labelToCategory(iNatLabel);
    const localCat = labelToCategory(localLabel);

    // Scorpion vs true spider: both map to 'spider' category but are clearly different.
    const iNatIsScorpion = /scorpion/i.test(iNatLabel);
    const localIsSpider  = /spider|tarantula|widow|orb.?weaver/i.test(localLabel);
    const scorpionSpiderConflict = iNatIsScorpion && localIsSpider;

    const categoryConflict =
      scorpionSpiderConflict ||
      (iNatCat && localCat && iNatCat !== localCat);

    if (categoryConflict) {
      console.log(`🎨 Category conflict: iNat="${iNatLabel}" (${iNatCat ?? 'unknown'}) vs local="${localLabel}" (${localCat ?? 'unknown'}) → local leads, iNat appended`);
    }

    // Winner leads the merged list; the other source fills remaining slots.
    // This ensures candidates from BOTH sources are available for rescan cycling.
    const winner = categoryConflict ? localResult : iNatResult;
    const filler = categoryConflict ? iNatResult : localResult;

    const seenLabels = new Set(winner.candidates.map(c => c.label));
    const extra = filler.candidates.filter(c => !seenLabels.has(c.label));
    const merged = [...winner.candidates, ...extra].slice(0, 10);

    return { ...winner, candidates: merged };
  }

  /**
   * Re-rank candidates using stored user-preference boosts from LearningService.
   * Labels the user has previously confirmed score higher; labels they've
   * rescanned away from score lower relative to their preferred replacements.
   */
  private async applyLearningBoosts(
    result: BugIdentificationResult,
  ): Promise<BugIdentificationResult> {
    if (result.candidates.length === 0) return result;

    const currentTop = result.candidates[0]?.label;
    const labels = result.candidates.map(c => c.label);
    const boosts = await getCandidateBoosts(labels, currentTop);

    const boosted = result.candidates
      .map(c => ({ ...c, confidence: (c.confidence ?? 0) * (boosts[c.label] ?? 1) }))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

    const newTop = boosted[0]?.label;
    if (newTop !== currentTop) {
      console.log(`🧠 Learning boost re-ranked: "${currentTop}" → "${newTop}"`);
    }

    return { ...result, candidates: boosted };
  }

  // ──────────────────────────────────────────────
  // Image-based local classifier (uses actual photo content)
  // ──────────────────────────────────────────────

  /**
   * Analyze actual image color features and match against known insect profiles.
   * This is the core local identification method — it extracts real HSB features
   * from the photo to produce plausible species matches.
   */
  private async identifyWithImageAnalysis(photoUri: string): Promise<BugIdentificationResult> {
    console.log('🎨 Running image-based color analysis...');

    try {
      const profile = await this.extractColorProfile(photoUri);
      console.log(`🎨 Image profile: hue=${profile.hue.toFixed(0)}°, brightness=${profile.brightness.toFixed(2)}, saturation=${profile.saturation.toFixed(2)}, warmth=${profile.warmth.toFixed(2)}, darkRatio=${profile.darkPixelRatio.toFixed(2)}, brightRatio=${profile.brightPixelRatio.toFixed(2)}`);

      // Fire ant should only win on strongly warm/red ant signatures.
      const strongFireAntProfile =
        profile.hue >= 0 &&
        profile.hue <= 22 &&
        profile.brightness >= 0.14 &&
        profile.brightness <= 0.58 &&
        profile.saturation >= 0.40 &&
        profile.warmth >= 0.14 &&
        profile.darkPixelRatio >= 0.08;

      // Score each SAMPLE_BUG against the extracted profile
      let scored = SAMPLE_BUGS.map(bug => {
        const baseScore = this.scoreBugMatch(profile, bug.colorProfile);
        const name = bug.name.toLowerCase();
        const isFireAnt = bug.name === 'Fire Ant';
        const isBlackGardenAnt = bug.name === 'Black Garden Ant';
        const isRedVelvetAnt = bug.name === 'Red Velvet Ant';
        const isLadybug = bug.name === 'Ladybug';
        const isSpiderLikeName = /spider|widow|tarantula|orb-weaver/.test(name);
        const isBeeLikeName = /bee|wasp|hornet|bumble/.test(name);
        const isAntLikeName = /\bant\b|formicidae|carpenter/.test(name);
        const isFlyLikeName = /\bfly\b|house\s*fly|gnat|midge|mosquito/.test(name);
        const isMothLikeName = /moth|butterfly/.test(name);
        const looksSpiderLikeProfile =
          profile.hue >= 16 &&
          profile.hue <= 48 &&
          profile.brightness >= 0.18 &&
          profile.brightness < 0.52 &&
          profile.saturation >= 0.08 &&
          profile.saturation < 0.32 &&
          profile.darkPixelRatio > 0.14 &&
          profile.brightPixelRatio < 0.10 &&
          profile.warmth > -0.05;
        const looksBeeLikeProfile =
          profile.hue >= 20 &&
          profile.hue <= 75 &&
          profile.brightness >= 0.22 &&
          profile.brightness <= 0.72 &&
          profile.saturation >= 0.24 &&
          profile.darkPixelRatio >= 0.10 &&
          profile.brightPixelRatio >= 0.05;
        const hasBeeLikeContrast =
          profile.darkPixelRatio > 0.12 &&
          profile.brightPixelRatio > 0.08 &&
          profile.hue >= 28 &&
          profile.hue <= 75;
        const looksWarmAntLikeProfile =
          profile.hue >= 0 &&
          profile.hue <= 32 &&
          profile.brightness >= 0.14 &&
          profile.brightness <= 0.62 &&
          profile.saturation >= 0.30 &&
          profile.darkPixelRatio >= 0.08 &&
          profile.warmth > 0.08;
        const looksDarkAntLikeProfile =
          profile.brightness < 0.34 &&
          profile.saturation < 0.30 &&
          profile.darkPixelRatio > 0.14;
        const looksNeutralDarkAntProfile =
          profile.brightness >= 0.12 &&
          profile.brightness <= 0.48 &&
          profile.saturation <= 0.24 &&
          profile.darkPixelRatio >= 0.16 &&
          profile.brightPixelRatio <= 0.18;
        const looksAntLikeProfile = looksWarmAntLikeProfile || looksDarkAntLikeProfile;
        const likelyAntMacroProfile =
          profile.hue >= 0 &&
          profile.hue <= 35 &&
          profile.brightness >= 0.14 &&
          profile.brightness <= 0.64 &&
          profile.saturation >= 0.24 &&
          profile.warmth > 0.05;
        const stronglyWarmAntProfile =
          likelyAntMacroProfile &&
          profile.hue <= 28 &&
          profile.saturation >= 0.34 &&
          profile.warmth > 0.12;
        const strictSpiderProfile =
          looksSpiderLikeProfile &&
          !looksAntLikeProfile &&
          !looksBeeLikeProfile &&
          !hasBeeLikeContrast;
        const looksFlyLikeProfile =
          profile.brightness >= 0.24 &&
          profile.brightness <= 0.72 &&
          profile.saturation <= 0.24 &&      // tightened: real flies are grey/desaturated
          profile.warmth < 0.08 &&            // flies are not warm golden-coloured
          profile.darkPixelRatio >= 0.04 &&
          profile.darkPixelRatio <= 0.22 &&   // tightened: dark beetles have high darkPixelRatio
          profile.brightPixelRatio >= 0.10;
        const isScorpionName = bug.name === 'Scorpion';
        const isStaBeetleName = bug.name === 'Stag Beetle' || bug.name === 'Ground Beetle' || bug.name === 'Hercules Beetle';
        const isDragonflyLikeName = /dragonfly|damselfly/.test(name);
        const isGoldenScarabName = bug.name === 'Golden Scarab';
        // Dark beetle profile: low–moderate brightness, low saturation (or metallic blue/teal), high dark pixel ratio.
        const looksDarkBeetleLikeProfile =
          profile.brightness >= 0.12 &&
          profile.brightness <= 0.60 &&
          (profile.saturation <= 0.32 || (profile.saturation <= 0.60 && profile.hue >= 160 && profile.hue <= 270)) && // allow metallic blue/teal
          profile.darkPixelRatio >= 0.18 &&
          profile.brightPixelRatio >= 0.06;  // background usually visible
        const looksScorpionLikeProfile =
          profile.hue >= 18 &&
          profile.hue <= 65 &&
          profile.brightness >= 0.34 &&
          profile.brightness <= 0.68 &&
          profile.saturation >= 0.22 &&
          profile.saturation <= 0.74 &&
          profile.warmth > 0.08 &&
          profile.darkPixelRatio < 0.24 &&
          profile.brightPixelRatio <= 0.28;
        // Blue-winged insect profile — matches dragonflies AND blue butterflies
        const looksBlueWingedProfile =
          profile.hue >= 180 &&
          profile.hue <= 270 &&
          profile.brightness >= 0.24 &&
          profile.brightness <= 0.72 &&
          profile.saturation >= 0.28;
        // Broad spider-brown profile: warm, brownish, darkish, low-sat — distinct from bee contrast
        const looksSpiderBrownProfile =
          profile.hue >= 10 &&
          profile.hue <= 58 &&
          profile.brightness >= 0.15 &&
          profile.brightness <= 0.56 &&
          profile.saturation >= 0.06 &&
          profile.saturation <= 0.46 &&
          profile.darkPixelRatio > 0.07 &&   // lowered: spider legs reliably produce dark pixels
          profile.warmth > -0.12;
        const looksButterflyLikeProfile =
          profile.hue >= 16 &&
          profile.hue <= 55 &&
          profile.brightness >= 0.34 &&
          profile.brightness <= 0.82 &&
          profile.saturation >= 0.34 &&
          profile.darkPixelRatio >= 0.04 &&
          profile.darkPixelRatio <= 0.36 &&
          profile.brightPixelRatio >= 0.06;
        const isVeryBrightAchromaticProfile =
          profile.brightness > 0.72 &&
          profile.saturation < 0.22;
        const isUltraDarkMacroProfile =
          profile.brightness <= 0.18 &&
          profile.darkPixelRatio >= 0.45 &&
          profile.brightPixelRatio <= 0.03;

        let adjustedScore = baseScore;

        // Spider labels should only be promoted on strict spider-like profiles.
        if (strictSpiderProfile && isSpiderLikeName) {
          adjustedScore *= 1.18;
        }

        // Strong guard: unless profile is strictly spider-like, keep spider labels down.
        if (!strictSpiderProfile && isSpiderLikeName) {
          adjustedScore *= 0.45;
        }

        // Promote bees/wasps for warm, saturated, high-contrast black+yellow profiles.
        if (looksBeeLikeProfile && isBeeLikeName) {
          adjustedScore *= 1.22;
        }

        // Guard: ultra-dark subjects with almost no bright pixels are unlikely to be bees/wasps.
        if (isUltraDarkMacroProfile && isBeeLikeName) {
          adjustedScore *= 0.18;
        }

        // In ultra-dark macro captures, favor ant classes over bright-wing classes.
        if (isUltraDarkMacroProfile && isAntLikeName) {
          adjustedScore *= 1.55;
        }
        if (isUltraDarkMacroProfile && isMothLikeName) {
          adjustedScore *= 0.32;
        }

        // Promote flies for neutral gray, mid-brightness profiles.
        if (looksFlyLikeProfile && isFlyLikeName) {
          adjustedScore *= 1.30;
        }

        // Promote ants for warm red/orange ant photos and dark ant photos.
        if (looksAntLikeProfile && isAntLikeName) {
          adjustedScore *= 1.40;
        }

        // Additional macro-photo ant boost (close-up red/orange ants).
        if (likelyAntMacroProfile && isAntLikeName) {
          adjustedScore *= 1.22;
        }

        // Nudge ant species specialization.
        if (looksWarmAntLikeProfile && bug.name === 'Fire Ant') {
          adjustedScore *= 1.28;
        }
        if (looksDarkAntLikeProfile && bug.name === 'Black Garden Ant') {
          adjustedScore *= 1.22;
        }

        // Guard: do not allow Fire Ant to dominate unless profile is truly red-ant-like.
        if (isFireAnt && !strongFireAntProfile) {
          adjustedScore *= 0.34;
        }

        // Dark ant photos should strongly prefer Black Garden Ant over Fire Ant.
        if (looksDarkAntLikeProfile && isBlackGardenAnt) {
          adjustedScore *= 1.28;
        }
        if (looksDarkAntLikeProfile && isFireAnt) {
          adjustedScore *= 0.62;
        }

        // Neutral dark ant photos (common black ants) should overwhelmingly
        // prefer Black Garden Ant and suppress Fire Ant.
        if (looksNeutralDarkAntProfile && isBlackGardenAnt) {
          adjustedScore *= 1.62;
        }
        if (looksNeutralDarkAntProfile && isFireAnt) {
          adjustedScore *= 0.32;
        }

        // Warm, saturated ant photos should prefer Fire Ant.
        if (looksWarmAntLikeProfile && isBlackGardenAnt) {
          adjustedScore *= 0.82;
        }

        // Hard split for warm ant macro photos:
        // prefer Fire Ant, suppress Black Garden Ant.
        if (stronglyWarmAntProfile && isFireAnt) {
          adjustedScore *= 1.34;
        }
        if (stronglyWarmAntProfile && isBlackGardenAnt) {
          adjustedScore *= 0.52;
        }

        // Suppress cross-class confusion when profile clearly indicates bee-like subject.
        if ((looksBeeLikeProfile || hasBeeLikeContrast) && isSpiderLikeName) {
          adjustedScore *= 0.78;
        }

        // Suppress bee-like labels when profile is clearly spider-like.
        if (looksSpiderLikeProfile && isBeeLikeName) {
          adjustedScore *= 0.86;
        }

        // Suppress spiders on ant-like profiles.
        if (looksAntLikeProfile && isSpiderLikeName) {
          adjustedScore *= 0.45;
        }

        // Suppress ants on strongly spider-like profiles.
        if (looksSpiderLikeProfile && isAntLikeName) {
          adjustedScore *= 0.88;
        }

        // Suppress moth/butterfly labels on ant-like profiles (e.g., red macro ant photos).
        if (looksAntLikeProfile && !looksButterflyLikeProfile && isMothLikeName) {
          adjustedScore *= 0.58;
        }

        // Suppress moth/butterfly labels on fly-like profiles.
        if (looksFlyLikeProfile && isMothLikeName) {
          adjustedScore *= 0.38;
        }

        // Promote butterfly/moth labels for bright, saturated orange/yellow wing-like profiles.
        if (looksButterflyLikeProfile && isMothLikeName) {
          adjustedScore *= 1.38;
        }

        // Butterfly-like subjects should suppress ant labels to avoid Red Velvet Ant confusion.
        if (looksButterflyLikeProfile && isAntLikeName && !strongFireAntProfile) {
          adjustedScore *= 0.56;
        }

        // Strong guard: butterfly-like orange/black profiles should not resolve as Red Velvet Ant.
        if (
          isRedVelvetAnt &&
          looksButterflyLikeProfile &&
          profile.brightness >= 0.42 &&
          profile.brightPixelRatio >= 0.10 &&
          profile.darkPixelRatio >= 0.06
        ) {
          adjustedScore *= 0.24;
        }

        // Nudge Monarch on canonical orange butterfly signatures.
        if (bug.name === 'Monarch Butterfly' && looksButterflyLikeProfile && profile.hue >= 20 && profile.hue <= 48) {
          adjustedScore *= 1.28;
        }

        // Guard: orange/black butterfly-like subjects should not resolve as Ladybug.
        if (
          isLadybug &&
          looksButterflyLikeProfile &&
          profile.hue >= 16 &&
          profile.hue <= 52 &&
          profile.saturation >= 0.40 &&
          profile.darkPixelRatio >= 0.06 &&
          profile.brightPixelRatio >= 0.10
        ) {
          adjustedScore *= 0.34;
        }

        // Suppress spider labels on fly-like profiles.
        if (looksFlyLikeProfile && isSpiderLikeName) {
          adjustedScore *= 0.62;
        }

        // Hard guard: Hawk Moth should not win on likely ant macro photos.
        if (likelyAntMacroProfile && bug.name === 'Hawk Moth') {
          adjustedScore *= 0.18;
        }

        if (likelyAntMacroProfile && isMothLikeName) {
          adjustedScore *= 0.52;
        }

        // Hard guard: Hawk Moth should not win for fly-like profiles.
        if (looksFlyLikeProfile && bug.name === 'Hawk Moth') {
          adjustedScore *= 0.16;
        }

        // Hard guard: Hawk Moth/moths should not win on dark beetle profiles.
        if (looksDarkBeetleLikeProfile && isMothLikeName) {
          adjustedScore *= 0.12;
        }

        // Extra guard: spider labels should not win on high-contrast yellow/black subjects.
        if (hasBeeLikeContrast && isSpiderLikeName) {
          adjustedScore *= 0.72;
        }

        if (hasBeeLikeContrast && isBeeLikeName) {
          adjustedScore *= 1.16;
        }

        // Avoid bright white-class bugs winning on darker subjects.
        if (!isVeryBrightAchromaticProfile && bug.name === 'Cabbage White Butterfly') {
          adjustedScore *= 0.62;
        }

        // Boost Scorpion on warm golden-tan profiles.
        if (looksScorpionLikeProfile && isScorpionName) {
          adjustedScore *= 1.55;
        }
        // Guard: Scorpion should not win on clearly non-scorpion profiles.
        if (isScorpionName && !looksScorpionLikeProfile) {
          adjustedScore *= 0.38;
        }
        // Suppress House Fly on warm golden profiles (flies are grey/cold).
        if (isFlyLikeName && profile.warmth > 0.08 && profile.saturation > 0.14) {
          adjustedScore *= 0.30;
        }

        // Boost dark beetles on dark beetle profiles.
        if (looksDarkBeetleLikeProfile && isStaBeetleName) {
          adjustedScore *= 1.50;
        }
        // Suppress House Fly on high dark-pixel-ratio subjects (dark beetles).
        if (isFlyLikeName && profile.darkPixelRatio > 0.20) {
          adjustedScore *= 0.28;
        }

        // Suppress Golden Scarab unless the image is genuinely metallic/golden.
        // Ants and spiders photographed close-up can appear warm and saturated,
        // but should not resolve as an epic gold beetle.
        if (isGoldenScarabName && (looksAntLikeProfile || looksSpiderLikeProfile || looksDarkAntLikeProfile || looksNeutralDarkAntProfile)) {
          adjustedScore *= 0.20;
        }

        // Dragonflies (Blue Dasher, Emperor, Azure) are strongly blue/teal.
        // Suppress them on any profile that is NOT in the blue hue range.
        if (isDragonflyLikeName && !looksBlueWingedProfile) {
          adjustedScore *= 0.32;
        }

        // Extra suppression on dark beetle profiles — dragonflies are agile fliers, not dark.
        if (isDragonflyLikeName && looksDarkBeetleLikeProfile) {
          adjustedScore *= 0.28;
        }

        // Boost spider labels on spider-brown profiles when the strict spider test agrees.
        if (isSpiderLikeName && looksSpiderBrownProfile && strictSpiderProfile) {
          adjustedScore *= 1.25;
        }

        // On blue-winged profiles prefer butterflies/moths over dragonflies
        // (blue butterflies against sky background often land on dragonfly hue range).
        if (looksBlueWingedProfile && isMothLikeName) {
          adjustedScore *= 1.18;
        }
        if (looksBlueWingedProfile && isDragonflyLikeName) {
          adjustedScore *= 0.82;
        }

        return {
          bug,
          score: adjustedScore,
        };
      }).sort((a, b) => b.score - a.score);

      const globalBeeLikeProfile =
        profile.hue >= 18 &&
        profile.hue <= 75 &&
        profile.brightness >= 0.22 &&
        profile.brightness <= 0.74 &&
        profile.saturation >= 0.22 &&
        profile.darkPixelRatio >= 0.08 &&
        profile.brightPixelRatio >= 0.04;

      const globalBeeLikeContrast =
        globalBeeLikeProfile &&
        profile.darkPixelRatio >= 0.12 &&
        profile.brightPixelRatio >= 0.08;

      const globalUltraDarkMacroProfile =
        profile.brightness <= 0.18 &&
        profile.darkPixelRatio >= 0.45 &&
        profile.brightPixelRatio <= 0.03;

      // Global bee rerank: favor bee labels and suppress ant/spider/moth confusion.
      if (globalBeeLikeProfile) {
        scored = scored
          .map(entry => {
            const n = entry.bug.name.toLowerCase();
            const isBee = /bee|wasp|hornet|bumble/.test(n);
            const isAnt = /\bant\b|formicidae|carpenter/.test(n);
            const isSpider = /spider|widow|tarantula|orb-weaver/.test(n);
            const isMoth = /moth|butterfly/.test(n);
            let s = entry.score;
            if (isBee) s *= globalBeeLikeContrast ? 1.52 : 1.36;
            if (isAnt) s *= 0.48;
            if (isSpider) s *= 0.56;
            if (isMoth) s *= 0.62;
            return { ...entry, score: s };
          })
          .sort((a, b) => b.score - a.score);
      }

      // Final safety rerank: if the overall profile is ant-like, prevent spider labels
      // from winning due local score noise/background artifacts.
      const globalAntLikeProfile =
        (
          profile.brightness >= 0.12 &&
          profile.brightness <= 0.62 &&
          profile.hue <= 40 &&
          profile.darkPixelRatio >= 0.10 &&
          (
            (profile.saturation <= 0.26) ||
            (profile.saturation >= 0.28 && profile.warmth > 0.06)
          )
        );

      if (globalAntLikeProfile && !globalBeeLikeProfile) {
        scored = scored
          .map(entry => {
            const n = entry.bug.name.toLowerCase();
            const isSpider = /spider|widow|tarantula|orb-weaver/.test(n);
            const isAnt = /\bant\b|formicidae|carpenter/.test(n);
            const isGoldenScarab = entry.bug.name === 'Golden Scarab';
            let s = entry.score;
            if (isSpider) s *= 0.28;
            if (isAnt) s *= 1.45;
            // Golden Scarab is an epic metallic beetle — ants are not golden
            if (isGoldenScarab) s *= 0.18;
            return { ...entry, score: s };
          })
          .sort((a, b) => b.score - a.score);
      }

      // Global fly rerank: favor fly labels and suppress moth/spider confusion.
      const globalFlyLikeProfile =
        profile.brightness >= 0.24 &&
        profile.brightness <= 0.74 &&
        profile.saturation <= 0.24 &&       // tightened from 0.30 — exclude warm golden subjects
        profile.warmth < 0.08 &&             // exclude warm-coloured subjects (scorpions, beetles)
        profile.darkPixelRatio >= 0.04 &&
        profile.darkPixelRatio <= 0.22 &&    // tightened — dark beetles have high darkPixelRatio
        profile.brightPixelRatio >= 0.10;

      // Global dark beetle profile: dark body, low sat (or metallic blue/teal), high dark pixel ratio.
      // warmth < 0.12 excludes dark flies on warm substrates (bread, wood) from the beetle path.
      const globalDarkBeetleLikeProfile =
        profile.brightness >= 0.12 &&
        profile.brightness <= 0.60 &&
        (profile.saturation <= 0.32 || (profile.saturation <= 0.60 && profile.hue >= 160 && profile.hue <= 270)) && // allow metallic blue/teal
        profile.darkPixelRatio >= 0.22 &&
        // Metallic blue/teal beetles can have brightRatio ≈ 0 (dark shell + grey stone background)
        (profile.brightPixelRatio >= 0.06 || (profile.hue >= 160 && profile.hue <= 270 && profile.darkPixelRatio >= 0.28)) &&
        profile.warmth < 0.12; // dark beetles are not on warm golden substrates

      // Global scorpion-like profile: warm, golden-tan, moderate saturation.
      // Tightened (higher brightness/saturation, lower darkPixelRatio) to separate scorpions from spiders.
      const globalScorpionLikeProfile =
        profile.hue >= 18 &&
        profile.hue <= 65 &&
        profile.brightness >= 0.34 &&
        profile.brightness <= 0.68 &&
        profile.saturation >= 0.20 &&
        profile.warmth > 0.08 &&
        profile.darkPixelRatio < 0.24;

      // Global spider-brown profile: warm brownish, darker, lower sat — distinct from golden scorpions.
      // Lowered darkPixelRatio threshold: spider legs reliably produce dark pixels even on bright wood backgrounds.
      const globalSpiderBrownProfile =
        profile.hue >= 10 &&
        profile.hue <= 56 &&
        profile.brightness >= 0.14 &&
        profile.brightness <= 0.56 &&
        profile.saturation >= 0.05 &&
        profile.saturation <= 0.46 &&
        profile.darkPixelRatio > 0.08;

      // Global blue-winged profile (for dragonfly/blue-butterfly guard).
      // Require at least some bright pixels — dark metallic beetles have brightRatio ≈ 0.
      const globalBlueWingedProfile =
        profile.hue >= 180 &&
        profile.hue <= 270 &&
        profile.saturation >= 0.28 &&
        profile.brightPixelRatio >= 0.05;

      if (globalFlyLikeProfile) {
        scored = scored
          .map(entry => {
            const n = entry.bug.name.toLowerCase();
            const isFly = /\bfly\b|house\s*fly|gnat|midge|mosquito/.test(n);
            const isMoth = /moth|butterfly/.test(n);
            const isSpider = /spider|widow|tarantula|orb-weaver/.test(n);
            let s = entry.score;
            if (isFly) s *= 1.40;
            if (isMoth) s *= 0.26;
            if (isSpider) s *= 0.60;
            return { ...entry, score: s };
          })
          .sort((a, b) => b.score - a.score);
      }

      // Global dark beetle rerank: suppress fly and promote dark beetles.
      // Guard: if the profile also matches globalFlyLikeProfile (fly with dark background),
      // do NOT boost beetles — let the fly rerank win.
      if (globalDarkBeetleLikeProfile && !globalBeeLikeProfile && !globalFlyLikeProfile) {
        scored = scored
          .map(entry => {
            const n = entry.bug.name.toLowerCase();
            const isBeetle = /beetle/.test(n);
            const isFly = /\bfly\b|house\s*fly|gnat|midge|mosquito/.test(n);
            const isMoth = /moth|butterfly/.test(n);
            const isAnt = /\bant\b|formicidae|carpenter/.test(n);
            let s = entry.score;
            if (isBeetle) s *= 1.45;
            if (isFly)    s *= 0.20;   // flies are not dark beetles
            if (isMoth)   s *= 0.15;   // moths are not dark beetles
            if (isAnt)    s *= 0.35;   // ants are not large dark beetles
            return { ...entry, score: s };
          })
          .sort((a, b) => b.score - a.score);
      }
      // Global scorpion rerank: warm golden subjects should prefer Scorpion over House Fly.
      // Guard: do NOT suppress spiders — spider photos can look golden-tan too.
      if (globalScorpionLikeProfile && !globalBeeLikeContrast && !globalSpiderBrownProfile) {
        scored = scored
          .map(entry => {
            const n = entry.bug.name.toLowerCase();
            const isScorpion = n === 'scorpion';
            const isFly = /\bfly\b|house\s*fly/.test(n);
            let s = entry.score;
            if (isScorpion) s *= 1.40;
            if (isFly) s *= 0.22;      // flies are not golden
            return { ...entry, score: s };
          })
          .sort((a, b) => b.score - a.score);
      }

      // Global spider-brown rerank: brownish, darker profiles should prefer spiders over scorpions.
      if (globalSpiderBrownProfile && !globalBeeLikeProfile) {
        scored = scored
          .map(entry => {
            const n = entry.bug.name.toLowerCase();
            const isSpider = /spider|widow|tarantula|orb-weaver/.test(n);
            const isScorpion = n === 'scorpion';
            let s = entry.score;
            if (isSpider) s *= 1.30;
            if (isScorpion) s *= 0.55;
            return { ...entry, score: s };
          })
          .sort((a, b) => b.score - a.score);
      }

      // Global dragonfly guard: dragonflies are bright blue/teal insects.
      // On non-blue profiles (beetles, ants, flies, warm butterflies), suppress them strongly.
      if (!globalBlueWingedProfile) {
        scored = scored
          .map(entry => {
            const n = entry.bug.name.toLowerCase();
            const isDragonfly = /dragonfly|damselfly/.test(n);
            let s = entry.score;
            if (isDragonfly) s *= 0.35;
            return { ...entry, score: s };
          })
          .sort((a, b) => b.score - a.score);
      }

      // Log top 5 scores for debugging
      const topDebug = scored.slice(0, 5);
      for (const { bug, score } of topDebug) {
        console.log(`🎨   ${bug.name}: score=${score.toFixed(3)} (hue=${bug.colorProfile.hueRange}, bri=${bug.colorProfile.brightnessRange}, sat=${bug.colorProfile.saturationRange})`);
      }

      // Take top 5 as candidates
      const top = scored.slice(0, 5);
      const maxScore = top[0].score;

      let candidates: IdentificationCandidate[] = top.map((entry, i) => ({
        label: entry.bug.name,
        species: entry.bug.species,
        // Normalize confidence: top match = 0.75-0.95 depending on score quality
        confidence: Math.min(0.95, Math.max(0.30, (entry.score / Math.max(maxScore, 0.01)) * 0.85 - i * 0.08)),
        source: 'ImageAnalysis',
      }));

      // Final hard override: if top is Wolf Spider/Fire Ant on an ant-ish profile,
      // force a deterministic ant subtype even when no ant appears in top candidates.
      const antishProfileForOverride =
        (globalAntLikeProfile && !globalBeeLikeProfile) ||
        (
          profile.hue <= 48 &&
          profile.brightness <= 0.70 &&
          profile.darkPixelRatio >= 0.08
        ) && !globalBeeLikeProfile;

      const strongWarmFireAntProfile =
        antishProfileForOverride &&
        profile.hue >= 0 &&
        profile.hue <= 24 &&
        profile.saturation >= 0.38 &&
        profile.warmth >= 0.14 &&
        profile.brightness >= 0.16 &&
        profile.brightness <= 0.60;

      const shouldForceBlackAnt =
        antishProfileForOverride &&
        !strongWarmFireAntProfile;

      if (
        antishProfileForOverride &&
        (candidates[0]?.label === 'Wolf Spider' || candidates[0]?.label === 'Fire Ant')
      ) {
        const forcedAntName = shouldForceBlackAnt ? 'Black Garden Ant' : 'Fire Ant';

        const forcedAnt = SAMPLE_BUGS.find((b) => b.name === forcedAntName);
        if (forcedAnt) {
          const forcedCandidate: IdentificationCandidate = {
            label: forcedAnt.name,
            species: forcedAnt.species,
            confidence: shouldForceBlackAnt ? 0.90 : 0.88,
            source: 'ImageAnalysis',
          };

          candidates = [
            forcedCandidate,
            ...candidates.filter((c) => c.label !== forcedAnt.name),
          ].slice(0, 5);

          console.log(`🎨 Override applied: replaced Wolf Spider with ${forcedAnt.name}`);
        }
      }

      // Final fly override for stubborn Hawk Moth mislabels.
      if (globalFlyLikeProfile && candidates[0]?.label === 'Hawk Moth') {
        const houseFly = SAMPLE_BUGS.find((b) => b.name === 'House Fly');
        if (houseFly) {
          const forcedFly: IdentificationCandidate = {
            label: houseFly.name,
            species: houseFly.species,
            confidence: 0.86,
            source: 'ImageAnalysis',
          };

          candidates = [
            forcedFly,
            ...candidates.filter((c) => c.label !== houseFly.name),
          ].slice(0, 5);

          console.log('🎨 Override applied: replaced Hawk Moth with House Fly');
        }
      }

      // Scorpion override: House Fly winning on a warm golden profile → Scorpion.
      // Wolf Spider is intentionally excluded: spider photos can also look golden-tan,
      // and Wolf Spider winning is more likely to be correct than Scorpion.
      if (
        globalScorpionLikeProfile &&
        !globalBeeLikeContrast &&
        !globalSpiderBrownProfile &&
        (candidates[0]?.label === 'House Fly' ||
          candidates[0]?.label === 'Hawk Moth')
      ) {
        const scorpion = SAMPLE_BUGS.find((b) => b.name === 'Scorpion');
        if (scorpion) {
          candidates = [
            { label: scorpion.name, species: scorpion.species, confidence: 0.86, source: 'ImageAnalysis' },
            ...candidates.filter((c) => c.label !== scorpion.name),
          ].slice(0, 5);
          console.log(`🦂 Override applied: replaced ${candidates[1]?.label ?? 'unknown'} with Scorpion`);
        }
      }

      // Dark beetle override: House Fly winning on a clearly dark-beetle profile → Stag Beetle.
      // Guard: if profile also matches fly-like, trust the fly rerank — don't force beetle.
      if (
        globalDarkBeetleLikeProfile &&
        !globalBeeLikeProfile &&
        !globalScorpionLikeProfile &&
        !globalFlyLikeProfile &&
        candidates[0]?.label === 'House Fly'
      ) {
        const stag = SAMPLE_BUGS.find((b) => b.name === 'Stag Beetle');
        if (stag) {
          candidates = [
            { label: stag.name, species: stag.species, confidence: 0.84, source: 'ImageAnalysis' },
            ...candidates.filter((c) => c.label !== stag.name),
          ].slice(0, 5);
          console.log('🪲 Override applied: replaced House Fly with Stag Beetle');
        }
      }

      // Hawk Moth override: Hawk Moth winning on a dark beetle profile → Stag Beetle.
      if (
        globalDarkBeetleLikeProfile &&
        !globalBeeLikeProfile &&
        !globalScorpionLikeProfile &&
        !globalFlyLikeProfile &&
        (candidates[0]?.label === 'Hawk Moth' || candidates[0]?.label === 'Luna Moth' || candidates[0]?.label === 'Atlas Moth')
      ) {
        const stag = SAMPLE_BUGS.find((b) => b.name === 'Stag Beetle');
        if (stag) {
          candidates = [
            { label: stag.name, species: stag.species, confidence: 0.82, source: 'ImageAnalysis' },
            ...candidates.filter((c) => c.label !== stag.name),
          ].slice(0, 5);
          console.log(`🪲 Override applied: replaced ${candidates[1]?.label ?? 'moth'} with Stag Beetle`);
        }
      }

      // Bee override: butterfly/moth label winning on a clearly bee-like profile
      // (e.g. bee on a large orange flower where the flower colour dominates the stats).
      if (globalBeeLikeProfile && /butterfly|moth/i.test(candidates[0]?.label ?? '')) {
        const forcedBeeName = globalBeeLikeContrast ? 'Bumble Bee' : 'Honey Bee';
        const forcedBee = SAMPLE_BUGS.find((b) => b.name === forcedBeeName);
        if (forcedBee) {
          const prevLabel = candidates[0]?.label;
          candidates = [
            { label: forcedBee.name, species: forcedBee.species, confidence: 0.87, source: 'ImageAnalysis' },
            ...candidates.filter((c) => c.label !== forcedBee.name),
          ].slice(0, 5);
          console.log(`🐝 Override: replaced ${prevLabel} with ${forcedBeeName} on bee-like profile`);
        }
      }

      // Bee override for non-green flower backgrounds (e.g. purple/lavender petals).
      // When petals push dominant hue to ~280°, globalBeeLikeProfile (hue 18-75°) won't fire.
      // Use a hue-independent profile: high contrast + warmth + no blue wings.
      const highContrastWarmInsectProfile =
        profile.darkPixelRatio >= 0.10 &&
        profile.brightPixelRatio >= 0.12 &&
        profile.warmth > 0.10 &&
        profile.saturation >= 0.20 &&
        profile.brightness >= 0.30 &&
        !globalBlueWingedProfile;
      if (
        highContrastWarmInsectProfile &&
        /butterfly|moth/i.test(candidates[0]?.label ?? '') &&
        !globalAntLikeProfile
      ) {
        const forcedBee = SAMPLE_BUGS.find((b) => b.name === 'Honey Bee');
        if (forcedBee) {
          const prevLabel = candidates[0]?.label;
          candidates = [
            { label: forcedBee.name, species: forcedBee.species, confidence: 0.84, source: 'ImageAnalysis' },
            ...candidates.filter((c) => c.label !== forcedBee.name),
          ].slice(0, 5);
          console.log(`🐝 High-contrast override: replaced ${prevLabel} with Honey Bee (non-green background)`);
        }
      }

      // Dark-subject ant rescue: warm backgrounds can still push tiny black ants
      // into bee/butterfly classes. If darkness and contrast indicate a small dark
      // subject, prefer the strongest ant candidate.
      const darkSubjectAntRescueProfile =
        profile.darkPixelRatio >= 0.16 &&
        profile.brightness <= 0.70 &&
        profile.saturation <= 0.82 &&
        !globalBlueWingedProfile;

      if (
        darkSubjectAntRescueProfile &&
        /(bee|wasp|hornet|bumble|butterfly|moth)/i.test(candidates[0]?.label ?? '')
      ) {
        const antCandidate = candidates.find((c) => /\bant\b|formicidae|carpenter/i.test(c.label));
        if (antCandidate) {
          const prevLabel = candidates[0]?.label;
          candidates = [
            {
              ...antCandidate,
              confidence: Math.max(0.86, (antCandidate.confidence ?? 0) + 0.10),
              source: 'ImageAnalysis',
            },
            ...candidates.filter((c) => c.label !== antCandidate.label),
          ].slice(0, 5);
          console.log(`🐜 Dark-subject ant rescue: replaced ${prevLabel} with ${antCandidate.label}`);
        }
      }

      // Deterministic ultra-dark rescue: if a bee-like label still wins on a very dark
      // macro profile, force Black Garden Ant even when no ant made top-5.
      if (
        globalUltraDarkMacroProfile &&
        /(bee|wasp|hornet|bumble)/i.test(candidates[0]?.label ?? '')
      ) {
        const forcedAnt = SAMPLE_BUGS.find((b) => b.name === 'Black Garden Ant');
        if (forcedAnt) {
          const prevLabel = candidates[0]?.label;
          candidates = [
            {
              label: forcedAnt.name,
              species: forcedAnt.species,
              confidence: 0.88,
              source: 'ImageAnalysis',
            },
            ...candidates.filter((c) => c.label !== forcedAnt.name),
          ].slice(0, 5);
          console.log(`🐜 Ultra-dark override: replaced ${prevLabel} with Black Garden Ant`);
        }
      }

      // Final bee override for stubborn Fire Ant/Wolf Spider mislabels.
      if (globalBeeLikeProfile && (candidates[0]?.label === 'Fire Ant' || candidates[0]?.label === 'Wolf Spider')) {
        const previousTopLabel = candidates[0]?.label;
        const forcedBeeName = globalBeeLikeContrast ? 'Bumble Bee' : 'Honey Bee';
        const forcedBee = SAMPLE_BUGS.find((b) => b.name === forcedBeeName);
        if (forcedBee) {
          const forcedCandidate: IdentificationCandidate = {
            label: forcedBee.name,
            species: forcedBee.species,
            confidence: 0.87,
            source: 'ImageAnalysis',
          };

          candidates = [
            forcedCandidate,
            ...candidates.filter((c) => c.label !== forcedBee.name),
          ].slice(0, 5);

          console.log(`🎨 Override applied: replaced ${previousTopLabel} with ${forcedBee.name}`);
        }
      }

      // Deterministic fallback: if Fire Ant is still top but profile is not a strong
      // red-ant signature, force a bee label on warm/yellow insect profiles.
      const beeFallbackProfile =
        profile.hue >= 18 &&
        profile.hue <= 80 &&
        profile.brightness >= 0.20 &&
        profile.brightness <= 0.78 &&
        profile.saturation >= 0.18;

      if (candidates[0]?.label === 'Fire Ant' && !strongFireAntProfile && beeFallbackProfile) {
        const forcedBeeName = globalBeeLikeContrast ? 'Bumble Bee' : 'Honey Bee';
        const forcedBee = SAMPLE_BUGS.find((b) => b.name === forcedBeeName);
        if (forcedBee) {
          candidates = [
            {
              label: forcedBee.name,
              species: forcedBee.species,
              confidence: 0.86,
              source: 'ImageAnalysis',
            },
            ...candidates.filter((c) => c.label !== forcedBee.name),
          ].slice(0, 5);
          console.log(`🎨 Fallback override applied: replaced Fire Ant with ${forcedBee.name}`);
        }
      }

      // Final butterfly rescue: if an ant label still wins on a butterfly-like profile,
      // promote the strongest butterfly/moth candidate (e.g. Monarch Butterfly).
      const butterflyRescueProfile =
        profile.hue >= 16 &&
        profile.hue <= 55 &&
        profile.brightness >= 0.34 &&
        profile.brightness <= 0.82 &&
        profile.saturation >= 0.34 &&
        profile.darkPixelRatio >= 0.04 &&
        profile.brightPixelRatio >= 0.06;

      // Looser signature for orange monarch-like scenes where sky/background
      // can dilute saturation or brightness stats.
      const monarchOrangeProfile =
        profile.hue >= 10 &&
        profile.hue <= 60 &&
        profile.brightness >= 0.26 &&
        profile.brightness <= 0.90 &&
        profile.saturation >= 0.22 &&
        profile.darkPixelRatio >= 0.02 &&
        profile.brightPixelRatio >= 0.02;

      const redVelvetFalsePositiveProfile =
        profile.hue >= 10 &&
        profile.hue <= 65 &&
        profile.brightness >= 0.28 &&
        profile.brightness <= 0.88 &&
        profile.saturation >= 0.24 &&
        profile.darkPixelRatio >= 0.02 &&
        profile.brightPixelRatio >= 0.02;

      const strongRedVelvetAntProfile =
        profile.hue >= 0 &&
        profile.hue <= 24 &&
        profile.brightness >= 0.22 &&
        profile.brightness <= 0.56 &&
        profile.saturation >= 0.52 &&
        profile.darkPixelRatio >= 0.04 &&
        profile.darkPixelRatio <= 0.34;

      // True ladybug profile is strongly red, saturated, and usually less bright-background-heavy.
      const strongLadybugProfile =
        profile.hue >= 0 &&
        profile.hue <= 16 &&
        profile.brightness >= 0.24 &&
        profile.brightness <= 0.70 &&
        profile.saturation >= 0.52 &&
        profile.darkPixelRatio >= 0.03 &&
        profile.brightPixelRatio <= 0.22;

      const topLabel = candidates[0]?.label?.toLowerCase() ?? '';
      const topIsAntLabel = /\bant\b|formicidae|carpenter/.test(topLabel);
      const topButterflyCandidate = candidates.find((c) => /moth|butterfly/.test(c.label.toLowerCase()));

      if (topIsAntLabel && topButterflyCandidate && butterflyRescueProfile && !strongFireAntProfile && !globalBeeLikeProfile) {
        const antConfidence = candidates[0]?.confidence ?? 0;
        const butterflyConfidence = topButterflyCandidate.confidence ?? 0;

        if (butterflyConfidence >= antConfidence * 0.50) {
          candidates = [
            {
              ...topButterflyCandidate,
              confidence: Math.max(0.84, butterflyConfidence + 0.08),
              source: 'ImageAnalysis',
            },
            ...candidates.filter((c) => c.label !== topButterflyCandidate.label),
          ].slice(0, 5);

          console.log(`🎨 Butterfly rescue override: replaced ant top label with ${topButterflyCandidate.label}`);
        }
      }

      // Dark fly on warm substrate: very dark insect + warm background (e.g. bread/food) + low saturation.
      // After warmth fix, dark fly escapes beetle path but lands in ant territory — override to House Fly.
      if (
        topIsAntLabel &&
        profile.darkPixelRatio >= 0.22 &&
        profile.warmth > 0.18 &&
        profile.saturation <= 0.22 &&
        profile.brightness >= 0.25 &&
        profile.brightPixelRatio >= 0.08 &&
        !globalBeeLikeProfile
      ) {
        const houseFly = SAMPLE_BUGS.find((b) => b.name === 'House Fly');
        if (houseFly) {
          const prevLabel = candidates[0]?.label;
          candidates = [
            { label: houseFly.name, species: houseFly.species, confidence: 0.82, source: 'ImageAnalysis' },
            ...candidates.filter((c) => c.label !== houseFly.name),
          ].slice(0, 5);
          console.log(`🪰 Dark fly override: replaced ${prevLabel} with House Fly (warm substrate)`);
        }
      }

      // Deterministic Monarch rescue for common false positive:
      // butterfly image still classified as Red Velvet Ant.
      if (
        candidates[0]?.label === 'Red Velvet Ant' &&
        !strongRedVelvetAntProfile &&
        (butterflyRescueProfile || redVelvetFalsePositiveProfile) &&
        !strongFireAntProfile &&
        !globalBeeLikeProfile
      ) {
        const monarchFromCandidates = candidates.find((c) => c.label === 'Monarch Butterfly');
        const monarchFromCatalog = SAMPLE_BUGS.find((b) => b.name === 'Monarch Butterfly');
        const monarchCandidate = monarchFromCandidates ?? (monarchFromCatalog
          ? {
              label: monarchFromCatalog.name,
              species: monarchFromCatalog.species,
              confidence: 0.86,
              source: 'ImageAnalysis' as const,
            }
          : null);

        if (monarchCandidate) {
          candidates = [
            {
              ...monarchCandidate,
              confidence: Math.max(0.86, (monarchCandidate.confidence ?? 0) + 0.10),
              source: 'ImageAnalysis',
            },
            ...candidates.filter((c) => c.label !== monarchCandidate.label),
          ].slice(0, 5);

          console.log('🎨 Monarch rescue override: replaced Red Velvet Ant with Monarch Butterfly');
        }
      }

      // Deterministic Monarch rescue for Ladybug false positive.
      if (candidates[0]?.label === 'Ladybug' && (butterflyRescueProfile || monarchOrangeProfile) && !globalBeeLikeProfile) {
        const monarchFromCandidates = candidates.find((c) => c.label === 'Monarch Butterfly');
        const monarchFromCatalog = SAMPLE_BUGS.find((b) => b.name === 'Monarch Butterfly');
        const monarchCandidate = monarchFromCandidates ?? (monarchFromCatalog
          ? {
              label: monarchFromCatalog.name,
              species: monarchFromCatalog.species,
              confidence: 0.86,
              source: 'ImageAnalysis' as const,
            }
          : null);

        if (monarchCandidate) {
          candidates = [
            {
              ...monarchCandidate,
              confidence: Math.max(0.90, (monarchCandidate.confidence ?? 0) + 0.12),
              source: 'ImageAnalysis',
            },
            ...candidates.filter((c) => c.label !== monarchCandidate.label),
          ].slice(0, 5);

          console.log('🎨 Monarch rescue override: replaced Ladybug with Monarch Butterfly');
        }
      }

      // Absolute Ladybug safeguard: unless profile is strongly ladybug-red,
      // do not allow Ladybug to remain top; force Monarch Butterfly.
      // Guard: if bee-like, the bee reranks should have handled this — don't override with Monarch.
      if (candidates[0]?.label === 'Ladybug' && !strongLadybugProfile && !globalBeeLikeProfile) {
        const monarchFromCandidates = candidates.find((c) => c.label === 'Monarch Butterfly');
        const monarchFromCatalog = SAMPLE_BUGS.find((b) => b.name === 'Monarch Butterfly');
        const monarchCandidate = monarchFromCandidates ?? (monarchFromCatalog
          ? {
              label: monarchFromCatalog.name,
              species: monarchFromCatalog.species,
              confidence: 0.90,
              source: 'ImageAnalysis' as const,
            }
          : null);

        if (monarchCandidate) {
          candidates = [
            {
              ...monarchCandidate,
              confidence: Math.max(0.90, (monarchCandidate.confidence ?? 0) + 0.08),
              source: 'ImageAnalysis',
            },
            ...candidates.filter((c) => c.label !== monarchCandidate.label),
          ].slice(0, 5);

          console.log('🎨 Absolute safeguard: replaced Ladybug with Monarch Butterfly');
        }
      }

      // Absolute safeguard: do not allow Red Velvet Ant to remain top from
      // color-only local analysis unless the profile is strongly specific.
      if (candidates[0]?.label === 'Red Velvet Ant' && !strongRedVelvetAntProfile) {
        const preferredUltraDarkAnt =
          globalUltraDarkMacroProfile
            ? (candidates.find((c) => c.label === 'Black Garden Ant')
              ?? SAMPLE_BUGS.find((b) => b.name === 'Black Garden Ant')
                ? {
                    label: 'Black Garden Ant',
                    species: SAMPLE_BUGS.find((b) => b.name === 'Black Garden Ant')?.species ?? 'Lasius niger',
                    confidence: 0.88,
                    source: 'ImageAnalysis' as const,
                  }
                : null)
            : null;

        const nonAntCandidate =
          preferredUltraDarkAnt ||
          candidates.find((c) => c.label !== 'Red Velvet Ant' && !/\bant\b|formicidae|carpenter/i.test(c.label)) ||
          candidates.find((c) => c.label !== 'Red Velvet Ant');

        if (nonAntCandidate) {
          candidates = [
            {
              ...nonAntCandidate,
              confidence: Math.max(0.84, (nonAntCandidate.confidence ?? 0) + 0.10),
              source: 'ImageAnalysis',
            },
            ...candidates.filter((c) => c.label !== nonAntCandidate.label),
          ].slice(0, 5);

          console.log(`🎨 Absolute safeguard: replaced Red Velvet Ant with ${nonAntCandidate.label}`);
        }
      }

      // Final ultra-dark correction: avoid Black Cricket on very dark ant-like macro captures.
      if (globalUltraDarkMacroProfile && candidates[0]?.label === 'Black Cricket') {
        const blackAnt =
          candidates.find((c) => c.label === 'Black Garden Ant') ||
          (() => {
            const fromCatalog = SAMPLE_BUGS.find((b) => b.name === 'Black Garden Ant');
            return fromCatalog
              ? {
                  label: fromCatalog.name,
                  species: fromCatalog.species,
                  confidence: 0.88,
                  source: 'ImageAnalysis' as const,
                }
              : null;
          })();

        if (blackAnt) {
          candidates = [
            {
              ...blackAnt,
              confidence: Math.max(0.88, (blackAnt.confidence ?? 0) + 0.12),
              source: 'ImageAnalysis',
            },
            ...candidates.filter((c) => c.label !== blackAnt.label),
          ].slice(0, 5);

          console.log('🐜 Final ultra-dark correction: replaced Black Cricket with Black Garden Ant');
        }
      }

      console.log(`🎨 Top match: ${candidates[0].label} (${((candidates[0].confidence ?? 0) * 100).toFixed(0)}%)`);

      return {
        candidates,
        provider: 'ImageAnalysis',
        isFromAPI: false,
      };
    } catch (error) {
      console.warn('⚠️ Image analysis failed, using hash fallback:', error);
      return this.getFallbackIdentification(photoUri);
    }
  }

  /**
   * Score how well an image color profile matches a bug's expected color profile.
   * Returns 0-1 where 1 = perfect match.
   */
  private scoreBugMatch(image: ImageColorProfile, bug: SampleBugColorProfile): number {
    // Hue match (circular distance on 0-360 scale)
    const hueCenter = (bug.hueRange[0] + bug.hueRange[1]) / 2;
    const hueSpan = (bug.hueRange[1] - bug.hueRange[0]) / 2;
    let hueDist = Math.abs(image.hue - hueCenter);
    if (hueDist > 180) hueDist = 360 - hueDist; // Wrap-around
    // Score: 1.0 if within range, decreasing outside
    const hueScore = hueDist <= hueSpan ? 1.0 : Math.max(0, 1 - (hueDist - hueSpan) / 60);

    // Brightness match
    const briCenter = (bug.brightnessRange[0] + bug.brightnessRange[1]) / 2;
    const briSpan = (bug.brightnessRange[1] - bug.brightnessRange[0]) / 2;
    const briDist = Math.abs(image.brightness - briCenter);
    const briScore = briDist <= briSpan ? 1.0 : Math.max(0, 1 - (briDist - briSpan) / 0.3);

    // Saturation match
    const satCenter = (bug.saturationRange[0] + bug.saturationRange[1]) / 2;
    const satSpan = (bug.saturationRange[1] - bug.saturationRange[0]) / 2;
    const satDist = Math.abs(image.saturation - satCenter);
    const satScore = satDist <= satSpan ? 1.0 : Math.max(0, 1 - (satDist - satSpan) / 0.3);

    // If bug has a full hue range (0-360), hue doesn't matter — it matches
    // based on brightness/saturation only (e.g. black ants, white butterflies).
    const isAchromaticBug = (bug.hueRange[1] - bug.hueRange[0]) >= 350;
    const hueWeight = isAchromaticBug ? 0.05 : 0.40;

    // Weighted combination
    return hueScore * hueWeight + briScore * 0.35 + satScore * (1.0 - hueWeight - 0.35);
  }

  /**
   * Extract a color profile from an image by downsampling to a small grid
   * and computing HSB statistics from raw pixel bytes.
   */
  private async extractColorProfile(imageUri: string): Promise<ImageColorProfile> {
    // Create a tiny center-crop to focus on the subject
    // Use a gentle crop (10% margins) so more of the subject is captured
    const thumb = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        { resize: { width: 100, height: 100 } },
        { crop: { originX: 10, originY: 10, width: 80, height: 80 } },
        { resize: { width: 16, height: 16 } },
      ],
      { format: ImageManipulator.SaveFormat.PNG, compress: 1.0, base64: true }
    );

    if (!thumb.base64) {
      console.warn('⚠️ Could not get base64 for color analysis');
      return { hue: 0, brightness: 0.5, saturation: 0.3, darkPixelRatio: 0.2, brightPixelRatio: 0.2, secondaryHue: 180, warmth: 0 };
    }

    // Decode base64 to binary bytes
    const rawStr = atob(thumb.base64);
    const bytes = new Uint8Array(rawStr.length);
    for (let i = 0; i < rawStr.length; i++) bytes[i] = rawStr.charCodeAt(i);

    // Parse PNG and extract actual RGB pixels
    const pixels = this.decodePNGPixels(bytes, 16, 16);

    if (pixels.length === 0) {
      console.warn('⚠️ PNG pixel decode failed, using raw byte fallback');
      return this.analyzeRawBytes(rawStr);
    }

    const centerPixels = this.extractCenterPixels(pixels, 16, 16, 4);
    console.log(`🎨 Decoded ${pixels.length} actual pixels from PNG (center focus: ${centerPixels.length})`);
    return this.computeHSBStats(centerPixels.length > 0 ? centerPixels : pixels);
  }

  /**
   * Properly decode a PNG image's IDAT chunks to extract raw RGB pixel data.
   * Parses PNG chunk structure → concatenates IDAT data → inflates with pako → un-filters scanlines.
   */
  private decodePNGPixels(pngBytes: Uint8Array, expectedW: number, expectedH: number): Array<[number, number, number]> {
    try {
      // PNG signature is 8 bytes, then chunks follow
      // Each chunk: 4 bytes length (big-endian) + 4 bytes type + data + 4 bytes CRC

      // Read IHDR to get image dimensions and color type
      let offset = 8; // Skip PNG signature
      let width = 0, height = 0, bitDepth = 0, colorType = 0;
      const idatChunks: Uint8Array[] = [];

      while (offset < pngBytes.length - 4) {
        const chunkLen = (pngBytes[offset] << 24) | (pngBytes[offset + 1] << 16) | (pngBytes[offset + 2] << 8) | pngBytes[offset + 3];
        const chunkType = String.fromCharCode(pngBytes[offset + 4], pngBytes[offset + 5], pngBytes[offset + 6], pngBytes[offset + 7]);

        if (chunkType === 'IHDR') {
          width = (pngBytes[offset + 8] << 24) | (pngBytes[offset + 9] << 16) | (pngBytes[offset + 10] << 8) | pngBytes[offset + 11];
          height = (pngBytes[offset + 12] << 24) | (pngBytes[offset + 13] << 16) | (pngBytes[offset + 14] << 8) | pngBytes[offset + 15];
          bitDepth = pngBytes[offset + 16];
          colorType = pngBytes[offset + 17];
          console.log(`🎨 PNG: ${width}x${height}, bitDepth=${bitDepth}, colorType=${colorType}`);
        } else if (chunkType === 'IDAT') {
          idatChunks.push(pngBytes.slice(offset + 8, offset + 8 + chunkLen));
        } else if (chunkType === 'IEND') {
          break;
        }

        offset += 4 + 4 + chunkLen + 4; // length field + type + data + CRC
      }

      if (idatChunks.length === 0 || width === 0 || height === 0) {
        console.warn('⚠️ No IDAT chunks found or invalid dimensions');
        return [];
      }

      // Concatenate all IDAT chunks
      const totalLen = idatChunks.reduce((sum, c) => sum + c.length, 0);
      const compressedData = new Uint8Array(totalLen);
      let pos = 0;
      for (const chunk of idatChunks) {
        compressedData.set(chunk, pos);
        pos += chunk.length;
      }

      // Decompress with pako (zlib inflate)
      const rawData = pako.inflate(compressedData);

      // Determine bytes per pixel based on color type
      // colorType 2 = RGB (3 bytes), colorType 6 = RGBA (4 bytes), colorType 0 = Grayscale (1 byte), colorType 4 = Gray+Alpha (2 bytes)
      let bpp: number;
      switch (colorType) {
        case 0: bpp = 1; break; // Grayscale
        case 2: bpp = 3; break; // RGB
        case 4: bpp = 2; break; // Grayscale + Alpha
        case 6: bpp = 4; break; // RGBA
        default:
          console.warn(`⚠️ Unsupported PNG color type: ${colorType}`);
          return [];
      }

      // Each scanline: 1 filter byte + width * bpp
      const scanlineLen = 1 + width * bpp;
      const pixels: Array<[number, number, number]> = [];

      // Un-filter scanlines (support filter types 0-4)
      const decoded = new Uint8Array(height * width * bpp);
      for (let y = 0; y < height; y++) {
        const filterType = rawData[y * scanlineLen];
        const rowStart = y * scanlineLen + 1;
        const decodedRowStart = y * width * bpp;

        for (let x = 0; x < width * bpp; x++) {
          const raw = rawData[rowStart + x];
          const a = x >= bpp ? decoded[decodedRowStart + x - bpp] : 0; // left pixel
          const b = y > 0 ? decoded[(y - 1) * width * bpp + x] : 0; // above pixel
          const c = (x >= bpp && y > 0) ? decoded[(y - 1) * width * bpp + x - bpp] : 0; // above-left

          let val: number;
          switch (filterType) {
            case 0: val = raw; break; // None
            case 1: val = (raw + a) & 0xFF; break; // Sub
            case 2: val = (raw + b) & 0xFF; break; // Up
            case 3: val = (raw + Math.floor((a + b) / 2)) & 0xFF; break; // Average
            case 4: val = (raw + this.paethPredictor(a, b, c)) & 0xFF; break; // Paeth
            default: val = raw;
          }
          decoded[decodedRowStart + x] = val;
        }
      }

      // Extract RGB triplets from decoded pixel data
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * bpp;
          let r: number, g: number, b: number;
          switch (colorType) {
            case 0: // Grayscale
              r = g = b = decoded[idx];
              break;
            case 2: // RGB
              r = decoded[idx]; g = decoded[idx + 1]; b = decoded[idx + 2];
              break;
            case 4: // Grayscale + Alpha
              r = g = b = decoded[idx];
              break;
            case 6: // RGBA
              r = decoded[idx]; g = decoded[idx + 1]; b = decoded[idx + 2];
              break;
            default:
              r = g = b = 128;
          }
          pixels.push([r, g, b]);
        }
      }

      return pixels;
    } catch (error) {
      console.warn('⚠️ PNG decode error:', error);
      return [];
    }
  }

  /** Paeth predictor for PNG scanline un-filtering */
  private paethPredictor(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  /**
   * Extract center-region pixels from a flattened width*height pixel list.
   * Helps focus on the subject and reduce background influence.
   */
  private extractCenterPixels(
    pixels: Array<[number, number, number]>,
    width: number,
    height: number,
    margin: number
  ): Array<[number, number, number]> {
    if (pixels.length !== width * height) return pixels;

    const result: Array<[number, number, number]> = [];
    const minX = Math.max(0, margin);
    const minY = Math.max(0, margin);
    const maxX = Math.min(width - 1, width - margin - 1);
    const maxY = Math.min(height - 1, height - margin - 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        result.push(pixels[y * width + x]);
      }
    }

    return result;
  }

  /**
   * Compute HSB statistics from RGB pixel data.
   */
  private computeHSBStats(pixels: Array<[number, number, number]>): ImageColorProfile {
    // Preserve raw darkness signal before filtering, so tiny black subjects
    // (e.g. ants) are not erased by background cleanup.
    let rawDarkCount = 0;
    let rawBrightCount = 0;
    for (const [r, g, b] of pixels) {
      const max = Math.max(r, g, b) / 255;
      if (max < 0.15) rawDarkCount++;
      if (max > 0.85) rawBrightCount++;
    }

    // ── Step 1: Filter out likely background pixels ──────────────────
    // Remove near-white (bright + desaturated) and near-black (very dark)
    // pixels so the subject's actual color dominates the profile.
    const subjectPixels: Array<[number, number, number]> = [];
    for (const [r, g, b] of pixels) {
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const sat = max === 0 ? 0 : (max - min) / max;

      // Skip near-white background: very bright AND very low saturation
      if (max > 0.90 && sat < 0.10) continue;
      // Skip only ultra-black noise. Keep most dark pixels so black ants remain visible.
      if (max < 0.02 && sat < 0.08) continue;

      // Skip vivid green background (leaf/grass) — compute hue inline
      if (sat > 0.30 && max > 0.15) {
        const rn = r / 255, gn = g / 255, bn = b / 255;
        const delta = max - min;
        if (delta > 0.01) {
          let hpx = 0;
          if (max === rn)      hpx = 60 * (((gn - bn) / delta) % 6);
          else if (max === gn) hpx = 60 * ((bn - rn) / delta + 2);
          else                 hpx = 60 * ((rn - gn) / delta + 4);
          if (hpx < 0) hpx += 360;
          if (hpx >= 60 && hpx <= 165) continue; // yellow-green through cyan — likely leaf/grass background
        }
      }

      subjectPixels.push([r, g, b]);
    }

    // If we filtered out too many pixels (>80%), use all pixels instead
    // — the subject might genuinely be very bright or very dark.
    const usePixels = subjectPixels.length >= pixels.length * 0.20 ? subjectPixels : pixels;
    console.log(`🎨 Subject pixels: ${subjectPixels.length}/${pixels.length} (using ${usePixels.length})`);

    // ── Step 2: Compute HSB statistics from the filtered pixels ──────
    let totalH = 0, totalS = 0, totalB = 0;
    let darkCount = 0, brightCount = 0;
    const hueBuckets = new Float32Array(36); // 10° buckets
    let warmPixels = 0, coolPixels = 0;

    for (const [r, g, b] of usePixels) {
      const rn = r / 255, gn = g / 255, bn = b / 255;
      const max = Math.max(rn, gn, bn);
      const min = Math.min(rn, gn, bn);
      const delta = max - min;

      // Brightness
      const brightness = max;
      totalB += brightness;
      if (brightness < 0.15) darkCount++;
      if (brightness > 0.85) brightCount++;

      // Saturation
      const saturation = max === 0 ? 0 : delta / max;
      totalS += saturation;

      // Hue
      let hue = 0;
      if (delta > 0.01) {
        if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
        else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
        else hue = 60 * ((rn - gn) / delta + 4);
        if (hue < 0) hue += 360;
      }
      totalH += hue;

      // Bucket hue for finding dominant and secondary
      if (saturation > 0.1 && brightness > 0.1) {
        hueBuckets[Math.floor(hue / 10) % 36] += saturation; // Weight by saturation
      }

      // Warmth
      if (rn > bn + 0.05) warmPixels++;
      else if (bn > rn + 0.05) coolPixels++;
    }

    const n = usePixels.length || 1;
    const rawN = pixels.length || 1;
    const avgH = totalH / n;
    const avgS = totalS / n;
    const avgB = totalB / n;
    const filteredDarkRatio = darkCount / n;
    const rawDarkRatio = rawDarkCount / rawN;
    const filteredBrightRatio = brightCount / n;
    const rawBrightRatio = rawBrightCount / rawN;

    // Find dominant and secondary hue from buckets
    let maxBucket = 0, dominantHueBucket = 0;
    for (let i = 0; i < 36; i++) {
      if (hueBuckets[i] > maxBucket) {
        maxBucket = hueBuckets[i];
        dominantHueBucket = i;
      }
    }

    // Secondary hue: highest bucket at least 60° away from dominant
    let secondaryHueBucket = 0, secondaryMax = 0;
    for (let i = 0; i < 36; i++) {
      const dist = Math.min(Math.abs(i - dominantHueBucket), 36 - Math.abs(i - dominantHueBucket));
      if (dist >= 6 && hueBuckets[i] > secondaryMax) {
        secondaryMax = hueBuckets[i];
        secondaryHueBucket = i;
      }
    }

    const dominantHue = dominantHueBucket * 10 + 5;
    const secondaryHue = secondaryHueBucket * 10 + 5;

    // Use dominant hue instead of simple average for better accuracy
    const finalHue = maxBucket > 0 ? dominantHue : avgH;

    return {
      hue: finalHue,
      brightness: avgB,
      saturation: avgS,
      // Blend filtered and raw dark ratios to avoid losing tiny dark subjects.
      darkPixelRatio: Math.max(filteredDarkRatio, Math.min(1, rawDarkRatio * 1.15)),
      // Keep bright ratio conservative so bright backgrounds don't dominate.
      brightPixelRatio: Math.min(filteredBrightRatio, rawBrightRatio + 0.04),
      secondaryHue,
      warmth: (warmPixels - coolPixels) / n,
    };
  }

  /**
   * Fallback: analyze raw byte distribution when RGB extraction fails.
   */
  private analyzeRawBytes(rawBytes: string): ImageColorProfile {
    const start = Math.min(50, rawBytes.length);
    const len = rawBytes.length - start;
    let sum = 0, highBytes = 0, lowBytes = 0, midHigh = 0;

    for (let i = start; i < rawBytes.length; i++) {
      const b = rawBytes.charCodeAt(i);
      sum += b;
      if (b > 160) highBytes++;
      if (b < 80) lowBytes++;
      if (b >= 100 && b <= 200) midHigh++;
    }

    const n = Math.max(len, 1);
    const avg = sum / n;
    const brightness = avg / 255;
    const warmth = (highBytes - lowBytes) / n;
    const saturation = midHigh / n;

    // Estimate hue from warmth
    let hue: number;
    if (warmth > 0.2) hue = 30; // warm → yellow/orange
    else if (warmth < -0.15) hue = 220; // cool → blue
    else if (brightness < 0.25) hue = 0; // dark → achromatic
    else hue = 120; // neutral → green

    return {
      hue,
      brightness,
      saturation: Math.min(1, saturation),
      darkPixelRatio: lowBytes / n,
      brightPixelRatio: highBytes / n,
      secondaryHue: (hue + 180) % 360,
      warmth,
    };
  }

  /**
   * Public method for live scan: classify a photo and return top match.
   * Used when TFLite model is not available.
   */
  async classifyForLiveScan(photoUri: string): Promise<{ label: string; confidence: number } | null> {
    try {
      const result = await this.identifyWithImageAnalysis(photoUri);
      if (result.candidates.length > 0) {
        return {
          label: result.candidates[0].label,
          confidence: result.candidates[0].confidence ?? 0.5,
        };
      }
      return { label: 'Unknown Bug', confidence: 0 };
    } catch (error) {
      console.warn('⚠️ Live scan classification failed:', error);
      return { label: 'Unknown Bug', confidence: 0.1 };
    }
  }

  /**
   * iNaturalist API - Free species identification service
   */
  private async identifyWithiNaturalist(photoUri: string): Promise<BugIdentificationResult | null> {
    try {
      // Compress large gallery/camera images before upload to prevent timeouts
      let uploadUri = photoUri;
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          photoUri,
          [{ resize: { width: 800 } }],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 }
        );
        uploadUri = compressed.uri;
        console.log('🌿 Image compressed for upload');
      } catch {
        // If compression fails, fall back to original URI
      }

      const formData = new FormData();
      formData.append('image', {
        uri: uploadUri,
        type: 'image/jpeg',
        name: 'bug_photo.jpg',
      } as any);

      console.log('🌿 Sending photo to iNaturalist Computer Vision API...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let response: Response;
      try {
        response = await fetch(`${API_CONFIG.INATURALIST.BASE_URL}/computervision/score_image`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'BugLord/1.0 (github.com/realadamcarr/BugLord)',
          },
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        console.warn(`🌿 iNaturalist CV API error: HTTP ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      console.log(`🌿 iNaturalist CV raw top result: ${JSON.stringify(data?.results?.[0]?.taxon?.preferred_common_name ?? data?.results?.[0]?.taxon?.name ?? 'none')}`);
      return this.processINaturalistResponse(data);
    } catch (error) {
      console.warn('iNaturalist API error:', error);
      return null;
    }
  }

  /**
   * Google Vision API - Requires API key but very accurate
   */
  private async identifyWithGoogleVision(photoUri: string): Promise<BugIdentificationResult | null> {
    try {
      const base64Image = await this.imageToBase64(photoUri);
      
      const requestBody = {
        requests: [{
          image: { content: base64Image },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 10 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 5 }
          ]
        }]
      };

      const response = await fetch(
        `${API_CONFIG.GOOGLE_VISION.BASE_URL}/images:annotate?key=${API_CONFIG.GOOGLE_VISION.API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (response.ok) {
        return this.processGoogleVisionResponse(await response.json());
      }
      
      return null;
    } catch (error) {
      console.warn('Google Vision API error:', error);
      return null;
    }
  }

  /**
   * Parse iNaturalist Computer Vision API response.
   * Response shape: { results: [{ score, taxon: { name, preferred_common_name, iconic_taxon_name } }] }
   */
  private processINaturalistResponse(data: any): BugIdentificationResult | null {
    const results: any[] = data?.results;
    if (!Array.isArray(results) || results.length === 0) {
      console.warn('🌿 iNaturalist returned no results array');
      return null;
    }

    // Only include insect / arachnid taxa
    const ARTHROPOD_ICONIC = new Set(['insecta', 'arachnida', 'myriapoda', 'arthropoda']);
    const bugKeywordRe = /insect|bug|beetle|fly|bee|ant|butterfly|moth|cricket|spider|dragonfly|mantis|wasp|grasshopper|cicada|cockroach|damselfly|katydid/i;

    const insectResults = results.filter((r: any) => {
      const iconic = (r?.taxon?.iconic_taxon_name ?? '').toLowerCase();
      const cn: string = r?.taxon?.preferred_common_name ?? '';
      const sn: string = r?.taxon?.name ?? '';
      return ARTHROPOD_ICONIC.has(iconic) || bugKeywordRe.test(cn + ' ' + sn);
    });

    if (insectResults.length === 0) {
      console.warn('🌿 iNaturalist found no insects/arthropods in top results');
      return null;
    }

    const candidates: IdentificationCandidate[] = insectResults
      .slice(0, 5)
      .map((r: any) => {
        const taxon = r.taxon ?? {};
        const commonName: string = taxon.preferred_common_name ?? '';
        const scientificName: string = taxon.name ?? '';
        const score: number = r.score ?? r.combined_score ?? 0.5;
        const gameName = this.mapINaturalistTaxonToGameBug(commonName, scientificName);
        const label = gameName ?? (commonName ? this.formatBugName(commonName) : this.formatBugName(scientificName));
        console.log(`🌿 iNat: "${commonName}" (${scientificName}) score=${score.toFixed(3)} → "${label}"`);
        return {
          label,
          species: scientificName || `${commonName} sp.`,
          confidence: Math.min(score, 0.99),
          source: 'iNaturalist',
        } as IdentificationCandidate;
      })
      .filter((c: IdentificationCandidate) => (c.confidence ?? 0) > 0.04);

    if (candidates.length === 0) {
      console.warn('🌿 iNaturalist candidates all below confidence threshold');
      return null;
    }

    return { candidates, provider: 'iNaturalist', isFromAPI: true };
  }

  /**
   * Map iNaturalist common/scientific name to a game bug name from SAMPLE_BUGS.
   * Returns null if no game-bug match — caller will use the raw common name instead.
   */
  private mapINaturalistTaxonToGameBug(commonName: string, scientificName: string): string | null {
    const cn = commonName.toLowerCase();
    const sn = scientificName.toLowerCase();
    const m = (...keywords: string[]) => keywords.some(k => cn.includes(k) || sn.includes(k));

    // ── Exact / distinctive species first ──────────────────────────────────
    if (m('monarch'))                                    return 'Monarch Butterfly';
    if (m('blue morpho', 'morpho'))                      return 'Blue Morpho Butterfly';
    if (m('cabbage white', 'pieris'))                    return 'Cabbage White Butterfly';
    if (m('luna moth', 'actias luna'))                   return 'Luna Moth';
    if (m('atlas moth', 'attacus'))                      return 'Atlas Moth';
    if (m('hawk moth', 'sphingidae', 'manduca'))         return 'Hawk Moth';
    if (m('bumble', 'bombus'))                           return 'Bumble Bee';
    if (m('honey bee', 'apis mellifera', 'apis cerana')) return 'Honey Bee';
    if (m('paper wasp', 'polistes'))                     return 'Paper Wasp';
    if (m('fire ant', 'solenopsis invicta', 'solenopsis richteri')) return 'Fire Ant';
    if (m('black garden ant', 'lasius niger'))           return 'Black Garden Ant';
    if (m('red velvet ant', 'dasymutilla'))              return 'Red Velvet Ant';
    if (m('stag beetle', 'lucanus'))                     return 'Stag Beetle';
    if (m('hercules beetle', 'dynastes hercules'))       return 'Hercules Beetle';
    if (m('jewel beetle', 'chrysochroa', 'buprestidae'))return 'Jewel Beetle';
    if (m('golden silk', 'nephila', 'trichonephila'))    return 'Golden Silk Orb-Weaver';
    if (m('black widow', 'latrodectus'))                 return 'Black Widow';
    if (m('tarantula', 'theraphosidae'))                 return 'Tarantula';
    if (m('scorpion', 'scorpiones', 'buthidae', 'scorpionidae', 'androctonus', 'centruroides', 'pandinus', 'leiurus')) return 'Scorpion';
    if (m('jumping spider', 'salticidae'))               return 'Jumping Spider';
    if (m('wolf spider', 'lycosidae', 'hogna'))          return 'Wolf Spider';
    if (m('garden spider', 'araneus diadematus'))        return 'Garden Spider';
    if (m('blue dasher', 'pachydiplax'))                 return 'Blue Dasher Dragonfly';
    if (m('emperor dragonfly', 'anax imperator'))        return 'Emperor Dragonfly';
    if (m('azure damselfly', 'coenagrion'))              return 'Azure Damselfly';
    if (m('praying mantis', 'mantis religiosa', 'mantidae')) return 'Praying Mantis';
    if (m('katydid', 'tettigoniidae'))                   return 'Katydid';
    if (m('violet ground beetle', 'carabus violaceus'))  return 'Violet Ground Beetle';
    if (m('scarab', 'chrysina', 'scarabaeidae'))         return 'Golden Scarab';
    if (m('cicada', 'magicicada', 'cicadidae'))          return 'Cicada';
    if (m('cockroach', 'periplaneta', 'blattodea'))      return 'Cockroach';
    if (m('ground beetle', 'carabidae'))                 return 'Ground Beetle';
    if (m('stink bug', 'pentatom'))                      return 'Ground Beetle';
    if (m('ladybug', 'ladybird', 'coccinellidae'))       return 'Ladybug';
    if (m('firefly', 'lightning bug', 'lampyridae'))     return 'Ground Beetle';
    if (m('house fly', 'musca domestic'))                return 'House Fly';
    if (m('black cricket', 'gryllus'))                   return 'Black Cricket';

    // ── Generic class fallbacks ─────────────────────────────────────────────
    if (m('butterfly'))                                  return 'Monarch Butterfly';
    if (m('moth'))                                       return 'Hawk Moth';
    if (m('bee'))                                        return 'Honey Bee';
    if (m('wasp', 'yellow jacket', 'hornet', 'vespidae')) return 'Paper Wasp';
    if (m('ant', 'formicidae'))                          return 'Black Garden Ant';
    if (m('beetle', 'coleoptera'))                       return 'Ground Beetle';
    if (m('cricket', 'gryllidae'))                       return 'Black Cricket';
    if (m('grasshopper', 'locust', 'acrididae'))         return 'Grasshopper';
    if (m('dragonfly', 'libellulidae'))                  return 'Blue Dasher Dragonfly';
    if (m('damselfly', 'coenagrionidae'))                return 'Azure Damselfly';
    if (m('fly', 'diptera'))                             return 'House Fly';
    if (m('spider', 'araneae'))                          return 'Wolf Spider';
    if (m('mantis', 'mantodea'))                         return 'Praying Mantis';

    return null; // no match — caller will display raw iNaturalist name
  }

  /**
   * Process Google Vision API response
   */
  private processGoogleVisionResponse(data: any): BugIdentificationResult | null {
    const responses = data.responses?.[0];
    if (!responses) return null;

    const labels = responses.labelAnnotations || [];
    const insectLabels = labels.filter((label: any) => 
      this.isInsectRelated(label.description)
    );
    
    if (insectLabels.length > 0) {
      const candidates: IdentificationCandidate[] = insectLabels
        .slice(0, 5)
        .map((label: any) => ({
          label: this.formatBugName(label.description),
          species: `${label.description} sp.`,
          confidence: label.score,
          source: 'GoogleVision',
        }));
      return { candidates, provider: 'GoogleVision', isFromAPI: true };
    }
    
    return null;
  }

  /**
   * Check if a label is insect-related
   */
  private isInsectRelated(description: string): boolean {
    const insectKeywords = [
      'insect', 'bug', 'beetle', 'fly', 'bee', 'ant', 'butterfly', 
      'moth', 'cricket', 'grasshopper', 'dragonfly', 'spider', 
      'ladybug', 'wasp', 'mosquito', 'tick', 'flea', 'mantis',
      'cicada', 'cockroach', 'scorpion', 'caterpillar'
    ];
    return insectKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );
  }

  /**
   * Convert image URI to base64
   */
  private async imageToBase64(uri: string): Promise<string> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error('Failed to convert image to base64');
    }
  }

  /**
   * Format bug name from API response
   */
  private formatBugName(rawName: string): string {
    return rawName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Stable hash of a string → unsigned 32-bit integer.
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Fallback when image analysis itself fails — picks from SAMPLE_BUGS
   * using a stable hash of the URI so the same photo gives the same result.
   */
  private getFallbackIdentification(photoUri?: string): BugIdentificationResult {
    const seed = photoUri ? this.simpleHash(photoUri) : Math.floor(Date.now() / 10000);
    const idx = seed % SAMPLE_BUGS.length;
    const bug = SAMPLE_BUGS[idx];
    
    // Build candidate list
    const candidates: IdentificationCandidate[] = [{
      label: bug.name,
      species: bug.species,
      confidence: 0.55,
      source: 'Fallback',
    }];
    
    // Add 4 other candidates
    for (let i = 1; i <= 4; i++) {
      const other = SAMPLE_BUGS[(idx + i * 3) % SAMPLE_BUGS.length];
      if (other.name !== bug.name) {
        candidates.push({
          label: other.name,
          species: other.species,
          confidence: Math.max(0.05, 0.45 - i * 0.10),
          source: 'Fallback',
        });
      }
    }

    return { candidates, provider: 'Fallback', isFromAPI: false };
  }

  // ──────────────────────────────────────────────
  // Ant sub-classification (red vs black vs other)
  // ──────────────────────────────────────────────

  private static readonly ANT_SUBTYPES = {
    red: { label: 'Fire Ant', species: 'Solenopsis invicta', traits: ['Aggressive', 'Colony Builder', 'Venomous Sting'] },
    black: { label: 'Black Garden Ant', species: 'Lasius niger', traits: ['Colony Builder', 'Forager', 'Common'] },
    carpenter: { label: 'Carpenter Ant', species: 'Camponotus pennsylvanicus', traits: ['Wood Dweller', 'Large', 'Nocturnal'] },
    generic: { label: 'Ant', species: 'Formicidae', traits: ['Colony Builder', 'Forager'] },
  };

  /**
   * Refine ML candidates when the top prediction is "ant".
   */
  async refineAntPrediction(
    candidates: IdentificationCandidate[],
    imageUri: string
  ): Promise<IdentificationCandidate[]> {
    if (!candidates.length) return candidates;

    const top = candidates[0];
    if (top.label.toLowerCase() !== 'ant') return candidates;

    console.log('🐜 Top prediction is "ant" — analyzing color to determine sub-type...');

    try {
      const profile = await this.extractColorProfile(imageUri);
      
      let subtype: keyof typeof BugIdentificationService.ANT_SUBTYPES;

      if (profile.warmth > 0.15 && profile.hue < 30) {
        subtype = 'red';
      } else if (profile.brightness < 0.25) {
        subtype = profile.brightness < 0.15 ? 'carpenter' : 'black';
      } else {
        subtype = 'generic';
      }

      console.log(`🐜 Sub-classified as ${subtype.toUpperCase()} ant`);
      const info = BugIdentificationService.ANT_SUBTYPES[subtype];

      const refined: IdentificationCandidate[] = [
        {
          label: info.label,
          species: info.species,
          confidence: top.confidence,
          source: `${top.source} + Color Analysis`,
        },
        ...(subtype !== 'generic' ? [{
          label: 'Ant',
          species: 'Formicidae',
          confidence: (top.confidence ?? 0.5) * 0.8,
          source: top.source,
        }] : []),
        ...candidates.slice(1),
      ];

      return refined;
    } catch (error) {
      console.warn('⚠️ Ant color analysis failed (non-fatal):', error);
      return candidates;
    }
  }
}

// Export singleton instance
export const bugIdentificationService = new BugIdentificationService();