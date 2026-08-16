import type { BugCategory } from '../../../constants/bugSprites';
import type { GbifSpeciesSuggestion } from '../../services/gbifService';

export interface SpeciesMetadataProvider {
  getSuggestions(category: BugCategory): Promise<GbifSpeciesSuggestion[]>;
}
