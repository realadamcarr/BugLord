import { ThemedText } from '@/components/ThemedText';
import { BUG_SPRITE } from '@/constants/bugSprites';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Bug, ConfirmationMethod, IdentificationCandidate, RARITY_CONFIG } from '@/types/Bug';
import React, { useEffect, useState } from 'react';
import {
    Alert,
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
  onRescan?: () => void;
  isNewCatch?: boolean;
  candidates?: IdentificationCandidate[];
}

export const BugInfoModal: React.FC<BugInfoModalProps> = ({
  visible,
  bug,
  onClose,
  onConfirm,
  onRescan,
  isNewCatch = false,
  candidates = []
}) => {
  const { theme } = useTheme();
  const { collection, releaseBug } = useBugCollection();
  const [nickname, setNickname] = useState('');
  const [showPartySwap, setShowPartySwap] = useState(false);
  const [selectedSwapBug, setSelectedSwapBug] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(candidates[0]?.label || null);
  const [manualMode, setManualMode] = useState(false);
  const [manualOrder, setManualOrder] = useState('');
  const [manualFamily, setManualFamily] = useState('');

  const styles = createStyles(theme);

  // Initialize nickname from bug when modal opens or bug changes
  useEffect(() => {
    if (bug && !isNewCatch) {
      setNickname(bug.nickname || '');
    } else {
      setNickname('');
    }
  }, [bug, isNewCatch, visible]);

  if (!bug) return null;

  const handleRelease = () => {
    Alert.alert(
      'Release Bug',
      'Are you sure you want to release this bug? It will be lost forever.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Release',
          style: 'destructive',
          onPress: () => {
            releaseBug(bug.id);
            onClose();
          },
        },
      ]
    );
  };

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

  const getRarityPercentage = (rarity: string): number => {
    const rarityValues = {
      'common': 20,
      'uncommon': 40,
      'rare': 60,
      'epic': 80,
      'legendary': 100
    };
    return rarityValues[rarity as keyof typeof rarityValues] || 20;
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
            {bug.category && BUG_SPRITE[bug.category] ? (
              <Image source={BUG_SPRITE[bug.category]} style={styles.bugPhoto} />
            ) : bug.photo ? (
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

          {/* Bug Stats Chart */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>📊 Stats</ThemedText>
            
            {/* Level */}
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Level</ThemedText>
              <View style={styles.statBarContainer}>
                <View style={[styles.statBar, { backgroundColor: theme.colors.border }]}>
                  <View 
                    style={[
                      styles.statBarFill, 
                      { 
                        width: `${Math.min(100, ((bug.level || 1) / 20) * 100)}%`,
                        backgroundColor: theme.colors.primary
                      }
                    ]} 
                  />
                </View>
                <ThemedText style={styles.statValue}>{bug.level || 1}</ThemedText>
              </View>
            </View>

            {/* XP Progress */}
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>XP Progress</ThemedText>
              <View style={styles.statBarContainer}>
                <View style={[styles.statBar, { backgroundColor: theme.colors.border }]}>
                  <View 
                    style={[
                      styles.statBarFill, 
                      { 
                        width: `${bug.maxXp && bug.maxXp > 0 ? ((bug.xp || 0) / bug.maxXp) * 100 : 0}%`,
                        backgroundColor: theme.colors.xpFill
                      }
                    ]} 
                  />
                </View>
                <ThemedText style={styles.statValue}>{bug.xp || 0}/{bug.maxXp || 100}</ThemedText>
              </View>
            </View>

            {/* HP (if available) */}
            {bug.maxHp && bug.maxHp > 0 && (
              <View style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Health</ThemedText>
                <View style={styles.statBarContainer}>
                  <View style={[styles.statBar, { backgroundColor: theme.colors.border }]}>
                    <View 
                      style={[
                        styles.statBarFill, 
                        { 
                          width: `${((bug.currentHp || bug.maxHp) / bug.maxHp) * 100}%`,
                          backgroundColor: theme.colors.error
                        }
                      ]} 
                    />
                  </View>
                  <ThemedText style={styles.statValue}>{bug.currentHp || bug.maxHp}/{bug.maxHp}</ThemedText>
                </View>
              </View>
            )}

            {/* Rarity */}
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Rarity</ThemedText>
              <View style={styles.statBarContainer}>
                <View style={[styles.statBar, { backgroundColor: theme.colors.border }]}>
                  <View 
                    style={[
                      styles.statBarFill, 
                      { 
                        width: `${getRarityPercentage(bug.rarity || 'common')}%`,
                        backgroundColor: RARITY_CONFIG[bug.rarity || 'common']?.color || '#666'
                      }
                    ]} 
                  />
                </View>
                <ThemedText style={styles.statValue}>{(bug.rarity || 'common').toUpperCase()}</ThemedText>
              </View>
            </View>

            {/* XP Value */}
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>XP Value</ThemedText>
              <View style={styles.statBarContainer}>
                <View style={[styles.statBar, { backgroundColor: theme.colors.border }]}>
                  <View 
                    style={[
                      styles.statBarFill, 
                      { 
                        width: `${Math.min(100, ((bug.xpValue || 10) / 120) * 100)}%`,
                        backgroundColor: theme.colors.warning
                      }
                    ]} 
                  />
                </View>
                <ThemedText style={styles.statValue}>{bug.xpValue || 10} XP</ThemedText>
              </View>
            </View>
          </View>

          {/* Battle Stats */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>⚔️ Battle Stats</ThemedText>

            {/* Attack */}
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Attack</ThemedText>
              <View style={styles.statBarContainer}>
                <View style={[styles.statBar, { backgroundColor: theme.colors.border }]}>
                  <View
                    style={[
                      styles.statBarFill,
                      {
                        width: `${Math.min(100, ((bug.attack || 0) / 40) * 100)}%`,
                        backgroundColor: '#E74C3C',
                      },
                    ]}
                  />
                </View>
                <ThemedText style={styles.statValue}>{bug.attack || 0}</ThemedText>
              </View>
            </View>

            {/* Defense */}
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Defense</ThemedText>
              <View style={styles.statBarContainer}>
                <View style={[styles.statBar, { backgroundColor: theme.colors.border }]}>
                  <View
                    style={[
                      styles.statBarFill,
                      {
                        width: `${Math.min(100, ((bug.defense || 0) / 35) * 100)}%`,
                        backgroundColor: '#3498DB',
                      },
                    ]}
                  />
                </View>
                <ThemedText style={styles.statValue}>{bug.defense || 0}</ThemedText>
              </View>
            </View>

            {/* Speed */}
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Speed</ThemedText>
              <View style={styles.statBarContainer}>
                <View style={[styles.statBar, { backgroundColor: theme.colors.border }]}>
                  <View
                    style={[
                      styles.statBarFill,
                      {
                        width: `${Math.min(100, ((bug.speed || 0) / 35) * 100)}%`,
                        backgroundColor: '#2ECC71',
                      },
                    ]}
                  />
                </View>
                <ThemedText style={styles.statValue}>{bug.speed || 0}</ThemedText>
              </View>
            </View>
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
                    {partyBug.category && BUG_SPRITE[partyBug.category] ? (
                      <Image source={BUG_SPRITE[partyBug.category]} style={styles.partyBugIcon} />
                    ) : partyBug.photo ? (
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
                {onRescan && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rescanButton]}
                    onPress={onRescan}
                  >
                    <ThemedText style={styles.rescanButtonText}>🔄 Rescan Bug</ThemedText>
                  </TouchableOpacity>
                )}
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
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleRelease}
              >
                <ThemedText style={[styles.secondaryButtonText, { color: theme.colors.error }]}>Release</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleConfirm}
              >
                <ThemedText style={styles.primaryButtonText}>Save Changes</ThemedText>
              </TouchableOpacity>
            </>
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
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    position: 'absolute',
    left: 0,
    zIndex: 1,
    padding: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: '900',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  bugIcon: {
    width: 120,
    height: 120,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  bugPhoto: {
    width: 200,
    height: 200,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  placeholderIcon: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  placeholderEmoji: {
    fontSize: 52,
  },
  rarityBadge: {
    position: 'absolute',
    top: -8,
    right: screenWidth / 2 - 60,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bugName: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  bugSpecies: {
    fontSize: 14,
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  bugDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  section: {
    marginBottom: 20,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 14,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  personalityText: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  factBullet: {
    color: theme.colors.warning,
    fontSize: 14,
    fontWeight: '900',
    marginRight: 8,
    marginTop: 1,
  },
  factText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
  nicknameInput: {
    borderWidth: 2,
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: theme.colors.surface,
  },
  swapDescription: {
    fontSize: 13,
    marginBottom: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  partyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  partyBugCard: {
    width: '48%',
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  selectedPartyBug: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}18`,
  },
  partyBugIcon: {
    width: 46,
    height: 46,
    marginBottom: 6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  partyBugEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  partyBugName: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    backgroundColor: theme.colors.background,
    borderTopWidth: 3,
    borderTopColor: theme.colors.border,
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 3,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderColor: `${theme.colors.primary}80`,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.border,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rescanButton: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.warning,
    flexBasis: '100%',
  },
  rescanButtonText: {
    color: theme.colors.warning,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  selectedCandidate: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}18`,
  },
  candidateLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  candidateConfidence: {
    fontSize: 11,
    marginRight: 6,
    fontWeight: '700',
    color: theme.colors.warning,
  },
  candidateSource: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statBarContainer: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBar: {
    flex: 1,
    height: 10,
    borderRadius: 4,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statBarFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 2,
  },
  statValue: {
    fontSize: 10,
    fontWeight: '800',
    minWidth: 56,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
});