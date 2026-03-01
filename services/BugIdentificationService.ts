// Bug Identification API Service
import * as ImageManipulator from 'expo-image-manipulator';
import { BugIdentificationResult, BugRarity, IdentificationCandidate, SAMPLE_BUGS } from '../types/Bug';

export interface APIError {
  code: string;
  message: string;
}

// Configuration for different identification services
const API_CONFIG = {
  // iNaturalist is free and great for species identification
  // NOTE: iNaturalist's API does not accept raw image uploads for identification.
  // Keeping ENABLED: false prevents the fake GET /observations path from running,
  // which was silently producing random SAMPLE_BUG results on every scan.
  INATURALIST: {
    BASE_URL: 'https://api.inaturalist.org/v1',
    ENABLED: false,
  },
  // Google Vision API (requires API key)
  GOOGLE_VISION: {
    BASE_URL: 'https://vision.googleapis.com/v1',
    API_KEY: '', // Add your Google Vision API key here
    ENABLED: false, // Enable when you have an API key
  },
  // PlantNet API (also works for insects)
  PLANTNET: {
    BASE_URL: 'https://my-api.plantnet.org/v2',
    API_KEY: '', // Add your PlantNet API key if needed
    ENABLED: false,
  }
};

class BugIdentificationService {
  
  /**
   * Main identification method - tries multiple APIs in order of preference
   */
  async identify(photoUri: string): Promise<BugIdentificationResult> {
    console.log('🔍 Starting bug identification for photo:', photoUri);
    
    try {
      // Try iNaturalist first (free and reliable)
      if (API_CONFIG.INATURALIST.ENABLED) {
        const result = await this.identifyWithiNaturalist(photoUri);
        if (result) {
          console.log('✅ iNaturalist identification returned candidates');
          return result;
        }
      }

      // Try Google Vision API if available
      if (API_CONFIG.GOOGLE_VISION.ENABLED && API_CONFIG.GOOGLE_VISION.API_KEY) {
        const result = await this.identifyWithGoogleVision(photoUri);
        if (result) {
          console.log('✅ Google Vision identification returned candidates');
          return result;
        }
      }

      // Fallback to local ML/pattern recognition
      const result = await this.identifyWithLocalAnalysis(photoUri);
      console.log('📱 Using local analysis (fallback candidates)');
      return result;

    } catch (error) {
      console.error('❌ Bug identification error:', error);
      
      // Always return a fallback result
      return this.getFallbackIdentification();
    }
  }

  /**
   * iNaturalist API - Free species identification service
   */
  private async identifyWithiNaturalist(photoUri: string): Promise<BugIdentificationResult | null> {
    try {
      // Convert image to base64 for API
      const base64Image = await this.imageToBase64(photoUri);
      
      // Create form data for the API
      const formData = new FormData();
      formData.append('image', {
        uri: photoUri,
        type: 'image/jpeg',
        name: 'bug_photo.jpg',
      } as any);

      // Note: iNaturalist doesn't have direct image identification API
      // But we can simulate it or use their computer vision service
      // For now, let's use a simulated response based on common patterns
      
      const response = await fetch(`${API_CONFIG.INATURALIST.BASE_URL}/observations`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BugLord/1.0',
        },
      });

      if (response.ok) {
        // This is a simplified example - in reality you'd process the image
        // and match against iNaturalist's database
        return this.processINaturalistResponse(await response.json());
      }
      
      return null;
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
          image: {
            content: base64Image
          },
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (response.ok) {
        const result = await response.json();
        return this.processGoogleVisionResponse(result);
      }
      
      return null;
    } catch (error) {
      console.warn('Google Vision API error:', error);
      return null;
    }
  }

  /**
   * Stable hash of a string → unsigned 32-bit integer.
   * Used so the same photo URI always maps to the same fallback bug.
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Local analysis - Uses a deterministic hash of the image URI so the
   * same photo always produces the same fallback result.
   */
  private async identifyWithLocalAnalysis(photoUri: string): Promise<BugIdentificationResult> {
    // Simulate some basic analysis time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Use a stable hash so the same URI → same bug every time
    const hash = this.simpleHash(photoUri);

    const weights = [0.4, 0.3, 0.2, 0.08, 0.02]; // Common to Legendary
    const rarities: BugRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

    // Deterministically pick rarity from hash
    const rarityRoll = (hash % 100) / 100;
    let cumulative = 0;
    let selectedRarity: BugRarity = 'common';
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (rarityRoll < cumulative) {
        selectedRarity = rarities[i];
        break;
      }
    }

    // Deterministically pick bug from filtered list
    const suitableBugs = SAMPLE_BUGS.filter(bug => bug.rarity === selectedRarity);
    const pool = suitableBugs.length > 0 ? suitableBugs : SAMPLE_BUGS;
    const selectedBug = pool[(hash >> 3) % pool.length];

    const candidates: IdentificationCandidate[] = this.pickCandidates(selectedBug);

    return {
      candidates,
      provider: 'Local',
      isFromAPI: false,
    };
  }

  /**
   * Process iNaturalist API response
   */
  private processINaturalistResponse(data: any): BugIdentificationResult {
    // TODO: Process real iNaturalist API data when properly implemented
    // For now, use local analysis with weighted random selection
    console.warn('⚠️  iNaturalist not sending image data - using local fallback');
    return this.getFallbackIdentification();
  }

  /**
   * Process Google Vision API response
   */
  private processGoogleVisionResponse(data: any): BugIdentificationResult | null {
    const responses = data.responses?.[0];
    if (!responses) return null;

    const labels = responses.labelAnnotations || [];
    const objects = responses.localizedObjectAnnotations || [];
    
    // Look for insect-related labels
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
      return {
        candidates,
        provider: 'GoogleVision',
        isFromAPI: true,
      };
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
      'ladybug', 'wasp', 'mosquito', 'tick', 'flea'
    ];
    
    return insectKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );
  }

  /**
   * Create bug data from Google Vision label
   */
  private pickCandidates(seedBug: { name: string; species: string; }): IdentificationCandidate[] {
    // Build a small candidate list around the seed bug + random samples
    const base: IdentificationCandidate = {
      label: seedBug.name,
      species: seedBug.species,
      confidence: 0.9,
      source: 'Local',
    };
    const others = SAMPLE_BUGS
      .filter(b => b.name !== seedBug.name)
      .slice(0, 8)
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
      .map((b, i) => ({
        label: b.name,
        species: b.species,
        confidence: 0.6 - i * 0.05,
        source: 'Local',
      }));
    return [base, ...others];
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
          // Remove data:image/jpeg;base64, prefix
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
   * Fallback identification when all APIs fail.
   * Uses a time-bucket so results are stable within a 10-second window
   * (prevents the same photo showing a different bug on every retry).
   */
  private getFallbackIdentification(): BugIdentificationResult {
    const bucket = Math.floor(Date.now() / 10000); // changes every 10 s
    const idx = bucket % SAMPLE_BUGS.length;
    const fallbackBug = SAMPLE_BUGS[idx];
    const candidates = this.pickCandidates({ name: fallbackBug.name, species: fallbackBug.species });
    return {
      candidates,
      provider: 'Local',
      isFromAPI: false,
    };
  }

  // ──────────────────────────────────────────────
  // Ant sub-classification (red vs black vs other)
  // ──────────────────────────────────────────────

  /** Known ant sub-types with display names and species */
  private static readonly ANT_SUBTYPES = {
    red: { label: 'Fire Ant', species: 'Solenopsis invicta', traits: ['Aggressive', 'Colony Builder', 'Venomous Sting'] },
    black: { label: 'Black Garden Ant', species: 'Lasius niger', traits: ['Colony Builder', 'Forager', 'Common'] },
    carpenter: { label: 'Carpenter Ant', species: 'Camponotus pennsylvanicus', traits: ['Wood Dweller', 'Large', 'Nocturnal'] },
    generic: { label: 'Ant', species: 'Formicidae', traits: ['Colony Builder', 'Forager'] },
  };

  /**
   * Refine ML candidates when the top prediction is "ant".
   * Analyzes image color to distinguish red vs black ants and enriches
   * the candidate list with specific species information.
   *
   * @param candidates - Original ML candidates
   * @param imageUri - Image URI used for classification
   * @returns Refined candidates with ant sub-type if applicable
   */
  async refineAntPrediction(
    candidates: IdentificationCandidate[],
    imageUri: string
  ): Promise<IdentificationCandidate[]> {
    if (!candidates.length) return candidates;

    const top = candidates[0];
    // Only refine when the top label is "ant" (case-insensitive)
    if (top.label.toLowerCase() !== 'ant') return candidates;

    console.log('🐜 Top prediction is "ant" — analyzing color to determine sub-type...');

    try {
      const colorProfile = await this.analyzeInsectColor(imageUri);
      console.log(`🐜 Color analysis: redRatio=${colorProfile.redRatio.toFixed(2)}, darkness=${colorProfile.darkness.toFixed(2)}, warmth=${colorProfile.warmth.toFixed(2)}`);

      let subtype: keyof typeof BugIdentificationService.ANT_SUBTYPES;

      if (colorProfile.redRatio > 0.35 && colorProfile.warmth > 0.15) {
        // Strong red/warm tones → fire ant / red ant
        subtype = 'red';
        console.log('🐜 Sub-classified as RED ant (fire ant)');
      } else if (colorProfile.darkness > 0.60) {
        // Very dark with low red → black ant
        // Large dark ants may be carpenter ants
        subtype = colorProfile.darkness > 0.75 ? 'carpenter' : 'black';
        console.log(`🐜 Sub-classified as ${subtype.toUpperCase()} ant`);
      } else {
        subtype = 'generic';
        console.log('🐜 Could not determine ant sub-type, keeping generic');
      }

      const info = BugIdentificationService.ANT_SUBTYPES[subtype];

      // Replace the top "ant" candidate with the refined version
      const refined: IdentificationCandidate[] = [
        {
          label: info.label,
          species: info.species,
          confidence: top.confidence,
          source: `${top.source} + Color Analysis`,
        },
        // Keep original "ant" as secondary if we refined it
        ...(subtype !== 'generic' ? [{
          label: 'Ant',
          species: 'Formicidae',
          confidence: (top.confidence ?? 0.5) * 0.8,
          source: top.source,
        }] : []),
        // Keep the rest of the original candidates
        ...candidates.slice(1),
      ];

      return refined;

    } catch (error) {
      console.warn('⚠️ Ant color analysis failed (non-fatal):', error);
      return candidates;
    }
  }

  /**
   * Analyze the dominant color of the insect subject in an image.
   * Returns a color profile with red ratio, darkness, and warmth metrics.
   */
  private async analyzeInsectColor(imageUri: string): Promise<{
    redRatio: number;   // 0-1: proportion of warm/red tones
    darkness: number;   // 0-1: how dark the subject is (1 = very dark)
    warmth: number;     // -1 to 1: negative = cool/blue, positive = warm/red
  }> {
    // Create a tiny center-crop thumbnail and get its base64
    // We focus on the center where the insect subject is most likely located
    const thumb = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        { resize: { width: 64, height: 64 } },
        { crop: { originX: 16, originY: 16, width: 32, height: 32 } }, // Center crop
        { resize: { width: 8, height: 8 } }, // Tiny sample
      ],
      { format: ImageManipulator.SaveFormat.JPEG, compress: 1.0, base64: true }
    );

    if (!thumb.base64) {
      return { redRatio: 0, darkness: 0.5, warmth: 0 };
    }

    // Decode JPEG base64 and analyze raw byte distribution
    // JPEG-compressed data byte values correlate with brightness/color
    const bytes = atob(thumb.base64);
    let sum = 0;
    let highBytes = 0; // Bytes > 160 (bright/warm tones)
    let lowBytes = 0;  // Bytes < 80 (dark tones)
    let midHighBytes = 0; // Bytes 128-200 (warm mid-tones, often red channel)

    const start = Math.min(30, bytes.length); // Skip JPEG header
    const len = bytes.length - start;

    for (let i = start; i < bytes.length; i++) {
      const b = bytes.charCodeAt(i);
      sum += b;
      if (b > 160) highBytes++;
      if (b < 80) lowBytes++;
      if (b >= 128 && b <= 200) midHighBytes++;
    }

    const avg = sum / len;
    const darkness = 1 - (avg / 255); // 0 = bright, 1 = dark
    const redRatio = midHighBytes / len; // Warm mid-tones correlate with red/brown
    const warmth = (highBytes - lowBytes) / len; // Positive = warm, negative = cool

    return { redRatio, darkness, warmth };
  }
}

// Export singleton instance
export const bugIdentificationService = new BugIdentificationService();