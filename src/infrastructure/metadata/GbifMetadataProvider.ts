import { getSpeciesSuggestionsForBugType } from '../../services/gbifService';
import type { SpeciesMetadataProvider } from './SpeciesMetadataProvider';

export class GbifMetadataProvider implements SpeciesMetadataProvider {
  getSuggestions(category: Parameters<SpeciesMetadataProvider['getSuggestions']>[0]) {
    return getSpeciesSuggestionsForBugType(category);
  }
}
