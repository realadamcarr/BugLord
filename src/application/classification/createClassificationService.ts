import { LegacyClassifierProvider } from '../../infrastructure/inference/LegacyClassifierProvider';
import { LocalClassifierProvider } from '../../infrastructure/inference/LocalClassifierProvider';
import { RemoteClassifierProvider } from '../../infrastructure/inference/RemoteClassifierProvider';
import { GbifMetadataProvider } from '../../infrastructure/metadata/GbifMetadataProvider';
import { ClassificationService } from './ClassificationService';

export const classificationService = new ClassificationService(
  new RemoteClassifierProvider(),
  new LocalClassifierProvider(),
  new LegacyClassifierProvider(),
  new GbifMetadataProvider(),
);
