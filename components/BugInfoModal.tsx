import { ThemedText } from '@/components/ThemedText';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Bug, ConfirmationMethod, IdentificationCandidate, RARITY_CONFIG } from '@/types/Bug';
import React, { useState } from 'react';
import {
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface BugInfoModalProps {
  visible: boolean;
  bug: Bug | null;
  onClose: () => void;
  onConfirm: (options: { nickname?: string; addToParty?: boolean; replaceBugId?: string; confirmedLabel?: string; confirmationMethod?: ConfirmationMethod; }) => void;
  isNewCatch?: boolean;
  candidates?: IdentificationCandidate[];
}

export const BugInfoModal: React.FC<BugInfoModalProps> = ({
  visible,
  bug,
  onClose,
  onConfirm,
  isNewCatch = false,
  candidates = []
}) => {
  const { theme } = useTheme();
  const { collection } = useBugCollection();
  const [nickname, setNickname] = useState('');
  const [showPartySwap, setShowPartySwap] = useState(false);
  const [selectedSwapBug, setSelectedSwapBug] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(candidates[0]?.label || null);
  const [manualMode, setManualMode] = useState(false);
  const [manualOrder, setManualOrder] = useState('');
  const [manualFamily, setManualFamily] = useState('');

  const styles = createStyles(theme);

  if (!bug) return null;

  const hasPartySpace = collection.party.some(slot => slot === null);
  const partyBugs = collection.party.filter(Boolean) as Bug[];

  const generateBugPersonality = (bug: Bug): string => {
    const personalities = {
      common: [
        'Friendly and curious, always eager to explore new areas.',
        'Calm and steady, a reliable companion on any adventure.',
        'Energetic and playful, loves to discover new things.',
        'Gentle and peaceful, brings a sense of tranquility.',
        'Social and outgoing, gets along well with other bugs.'
      ],
      uncommon: [
        'Intelligent and observant, notices details others miss.',
        'Brave and confident, never backs down from a challenge.',
        'Mysterious and elusive, has an air of ancient wisdom.',
        'Creative and artistic, sees beauty in unexpected places.',
        'Independent and strong-willed, marches to its own beat.'
      ],
      rare: [
        'Majestic and proud, commands respect from other creatures.',
        'Wise and thoughtful, possesses deep knowledge of nature.',
        'Fierce and protective, fiercely loyal to its companions.',
        'Graceful and elegant, moves with natural sophistication.',
        'Enigmatic and complex, has layers of hidden personality.'
      ],
      epic: [
        'Legendary presence that inspires awe in all who encounter it.',
        'Ancient wisdom flows through every action and decision.',
        'Possesses an otherworldly connection to natural forces.',
        'Commands the elements with graceful, effortless power.',
        'Radiates an aura of mystique and untold stories.'
      ],
      legendary: [
        'A being of pure wonder, existing beyond normal comprehension.',
        'Embodies the very essence of nature\'s most profound mysteries.',
        'Transcends ordinary existence with cosmic significance.',
        'Holds secrets of the universe within its ancient soul.',
        'A living legend whose presence changes the world around it.'
      ]
    };

    const rarityPersonalities = personalities[bug.rarity] || personalities.common;
    const index = (bug.name.length + bug.species.length) % rarityPersonalities.length;
    return rarityPersonalities[index];
  };

  const generateBugFacts = (bug: Bug): string[] => {
    const facts = [
      `Lives primarily in ${bug.biome} environments`,
      `Classified as a ${bug.rarity} species`,
      `Typically grows to ${bug.size} size`,
      `Known for traits: ${bug.traits.slice(0, 2).join(', ')}`,
      `Provides ${bug.xpValue} XP when trained`
    ];

    // Add rarity-specific facts
    if (bug.rarity === 'legendary') {
      facts.push('Extremely rare - less than 0.1% encounter rate');
    } else if (bug.rarity === 'epic') {
      facts.push('Highly sought after by collectors worldwide');
    } else if (bug.rarity === 'rare') {
      facts.push('Uncommon species with unique characteristics');
    }

    return facts;
  };

  const handleConfirm = () => {
    let confirmedLabel: string | undefined = selectedLabel || undefined;
    let confirmationMethod: ConfirmationMethod | undefined = 'AI_PICK';
    if (manualMode) {
      confirmedLabel = manualOrder ? `${manualOrder}${manualFamily ? ' - ' + manualFamily : ''}` : 'Unknown bug';
      confirmationMethod = manualOrder ? 'MANUAL' : 'UNKNOWN';
    }

    const base = { nickname: nickname || undefined, confirmedLabel, confirmationMethod };

    if (showPartySwap && selectedSwapBug) {
      onConfirm({ ...base, addToParty: true, replaceBugId: selectedSwapBug });
    } else if (hasPartySpace || !isNewCatch) {
      onConfirm({ ...base, addToParty: true });
    } else {
      onConfirm({ ...base, addToParty: false });
    }
  };

  const handleAddToParty = () => {
    if (hasPartySpace) {
      onConfirm({ nickname: nickname || undefined, addToParty: true });
    } else {
      setShowPartySwap(true);
    }
  };

  const handleAddToCollection = () => {
    onConfirm({ nickname: nickname || undefined, addToParty: false });
  };

  const bugFacts = generateBugFacts(bug);
  const bugPersonality = generateBugPersonality(bug);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>
              {isNewCatch ? '🎉 New Discovery!' : '🔍 Bug Info'}
            </ThemedText>
          </View>

          {/* Bug Image */}
          <View style={styles.imageContainer}>
            {bug.photo ? (
              <Image source={{ uri: bug.photo }} style={styles.bugPhoto} />
            ) : bug.pixelArt ? (
              <Image source={{ uri: bug.pixelArt }} style={styles.bugIcon} />
            ) : (
              <View style={styles.placeholderIcon}>
                <Text style={styles.placeholderEmoji}>🐛</Text>
              </View>
            )}
            <Text style={[styles.rarityBadge, { backgroundColor: RARITY_CONFIG[bug.rarity].color }]}>
              {bug.rarity.toUpperCase()}
            </Text>
          </View>

          {/* Bug Info */}
          <View style={styles.infoSection}>
            <ThemedText style={styles.bugName}>{bug.name}</ThemedText>
            <ThemedText style={styles.bugSpecies}>{bug.species}</ThemedText>
            <ThemedText style={styles.bugDescription}>{bug.description}</ThemedText>
          </View>

          {/* Candidates Selection */}
          {isNewCatch && candidates.length > 0 && !showPartySwap && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>🤖 AI Suggestions</ThemedText>
              {candidates.map((c) => (
                <TouchableOpacity
                  key={c.label}
                  style={[styles.candidateRow, selectedLabel === c.label && styles.selectedCandidate]}
                  onPress={() => { setSelectedLabel(c.label); setManualMode(false); }}
                >
                  <ThemedText style={styles.candidateLabel}>{c.label}</ThemedText>
                  <Text style={styles.candidateConfidence}>
                    {typeof c.confidence === 'number' ? `${Math.round(c.confidence * 100)}%` : ''}
                  </Text>
                  <Text style={styles.candidateSource}>{c.source}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.candidateRow, manualMode && styles.selectedCandidate]}
                onPress={() => { setManualMode(true); setSelectedLabel(null); }}
              >
                <ThemedText style={styles.candidateLabel}>None of these</ThemedText>
                <Text style={styles.candidateSource}>Manual</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Manual Taxonomy */}
          {manualMode && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>📝 Manual Classification</ThemedText>
              <TextInput
                style={[styles.nicknameInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Order (e.g., Coleoptera)"
                placeholderTextColor={theme.colors.text + '80'}
                value={manualOrder}
                onChangeText={setManualOrder}
              />
              <View style={{ height: 12 }} />
              <TextInput
                style={[styles.nicknameInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Family (optional)"
                placeholderTextColor={theme.colors.text + '80'}
                value={manualFamily}
                onChangeText={setManualFamily}
              />
            </View>
          )}

          {/* Personality */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>🎭 Personality</ThemedText>
            <ThemedText style={styles.personalityText}>{bugPersonality}</ThemedText>
          </View>

          {/* Facts */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>📚 Bug Facts</ThemedText>
            {bugFacts.map((fact, index) => (
              <View key={index} style={styles.factItem}>
                <Text style={styles.factBullet}>•</Text>
                <ThemedText style={styles.factText}>{fact}</ThemedText>
              </View>
            ))}
          </View>

          {/* Nickname Input */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              {isNewCatch ? '🏷️ Give it a nickname' : '✏️ Change nickname'}
            </ThemedText>
            <TextInput
              style={[styles.nicknameInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder={bug.nickname || "Enter a nickname..."}
              placeholderTextColor={theme.colors.text + '80'}
              value={nickname}
              onChangeText={setNickname}
              maxLength={20}
            />
          </View>

          {/* Party Swap Section */}
          {showPartySwap && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>🔄 Replace Party Member</ThemedText>
              <ThemedText style={styles.swapDescription}>
                Your party is full! Select a bug to replace:
              </ThemedText>
              <View style={styles.partyGrid}>
                {partyBugs.map((partyBug) => (
                  <TouchableOpacity
                    key={partyBug.id}
                    style={[
                      styles.partyBugCard,
                      selectedSwapBug === partyBug.id && styles.selectedPartyBug
                    ]}
                    onPress={() => setSelectedSwapBug(partyBug.id)}
                  >
                    {partyBug.photo ? (
                      <Image source={{ uri: partyBug.photo }} style={styles.partyBugIcon} />
                    ) : partyBug.pixelArt ? (
                      <Image source={{ uri: partyBug.pixelArt }} style={styles.partyBugIcon} />
                    ) : (
                      <Text style={styles.partyBugEmoji}>🐛</Text>
                    )}
                    <ThemedText style={styles.partyBugName} numberOfLines={1}>
                      {partyBug.nickname || partyBug.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {isNewCatch ? (
            showPartySwap ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton]}
                  onPress={() => setShowPartySwap(false)}
                >
                  <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.primaryButton,
                    (!selectedSwapBug) && styles.disabledButton
                  ]}
                  onPress={handleConfirm}
                  disabled={!selectedSwapBug}
                >
                  <ThemedText style={styles.primaryButtonText}>
                    Replace & Add to Party
                  </ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton]}
                  onPress={handleAddToCollection}
                >
                  <ThemedText style={styles.secondaryButtonText}>Add to Collection</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton]}
                  onPress={handleAddToParty}
                >
                  <ThemedText style={styles.primaryButtonText}>
                    {hasPartySpace ? 'Add to Party' : 'Replace Party Member'}
                  </ThemedText>
                </TouchableOpacity>
              </>
            )
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton, { flex: 1 }]}
              onPress={handleConfirm}
            >
              <ThemedText style={styles.primaryButtonText}>Save Changes</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Space for action buttons
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    left: 0,
    zIndex: 1,
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: theme.colors.text,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  bugIcon: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  bugPhoto: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  placeholderIcon: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 60,
  },
  rarityBadge: {
    position: 'absolute',
    top: -8,
    right: screenWidth / 2 - 60,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  bugName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bugSpecies: {
    fontSize: 18,
    fontStyle: 'italic',
    opacity: 0.8,
    marginBottom: 12,
  },
  bugDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  personalityText: {
    fontSize: 16,
    lineHeight: 22,
    fontStyle: 'italic',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  factBullet: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 2,
  },
  factText: {
    fontSize: 16,
    flex: 1,
    lineHeight: 22,
  },
  nicknameInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
  },
  swapDescription: {
    fontSize: 16,
    marginBottom: 16,
    opacity: 0.8,
  },
  partyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  partyBugCard: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPartyBug: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '20',
  },
  partyBugIcon: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  partyBugEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  partyBugName: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCandidate: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '20',
  },
  candidateLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  candidateConfidence: {
    fontSize: 12,
    marginRight: 8,
    opacity: 0.8,
  },
  candidateSource: {
    fontSize: 12,
    opacity: 0.7,
  },
});