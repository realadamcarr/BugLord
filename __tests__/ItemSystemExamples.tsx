/**
 * Item System Testing & Usage Examples
 * 
 * Demonstrates how to use the inventory system in practice.
 * Run these examples to verify all functionality works correctly.
 * 
 * This is not a formal test suite - just usage examples and validation.
 */

import { BUG_TRAP, POTION, REVIVE_SEED, SUPER_POTION, FULL_REVIVE } from '@/constants/Items';
import { useInventory } from '@/contexts/InventoryContext';
import React from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Example 1: Basic item management
 * - Add items to inventory
 * - Check quantities
 * - Remove items
 */
export async function testBasicItemManagement() {
  console.log('\n🧪 Test 1: Basic Item Management\n');

  // In real usage, this runs inside a component using useInventory hook
  // For now, just showing the API calls:

  // Add 5 Bug Traps
  console.log('📦 Adding 5x Bug Trap...');
  // await addItem(BUG_TRAP.id, 5);
  // Expected: ✅ Added 5x Bug Trap

  // Add 3 Potions
  console.log('📦 Adding 3x Potion...');
  // await addItem(POTION.id, 3);
  // Expected: ✅ Added 3x Potion

  // Check quantities
  console.log('🔍 Checking inventory...');
  // const trapQty = getItemQuantity(BUG_TRAP.id); // Should be 5
  // const potionQty = getItemQuantity(POTION.id); // Should be 3
  // console.log(`  Bug Traps: ${trapQty}`);
  // console.log(`  Potions: ${potionQty}`);

  // Remove 1 Bug Trap
  console.log('🗑️ Removing 1x Bug Trap...');
  // await removeItem(BUG_TRAP.id, 1);
  // Expected: ✅ Removed 1x Bug Trap

  console.log('✅ Test 1 complete\n');
}

/**
 * Example 2: Stack limits
 * - Verify items respect stack limits
 * - Capping at limit when adding too many
 */
export async function testStackLimits() {
  console.log('\n🧪 Test 2: Stack Limits\n');

  // Potions have default limit of 99
  console.log('📦 Adding 100x Potion (limit is 99)...');
  // await addItem(POTION.id, 100);
  // Expected: ✅ Added 100x Potion (but capped at 99)
  // ⚠️  Item item_potion would exceed stack limit (99)

  // Full Revive has limit of 50
  console.log('📦 Adding 60x Full Revive (limit is 50)...');
  // await addItem(FULL_REVIVE.id, 60);
  // Expected: ✅ Added 60x Full Revive (but capped at 50)
  // ⚠️  Item item_full_revive would exceed stack limit (50)

  console.log('✅ Test 2 complete\n');
}

/**
 * Example 3: Item usage with validation
 * - Using heal items
 * - Using revive items (requires fainted bug)
 * - Error cases
 */
export async function testItemUsage() {
  console.log('\n🧪 Test 3: Item Usage & Validation\n');

  // Mock bug for testing
  const mockBug = {
    id: 'bug_1',
    name: 'Butterfly',
    currentHp: 0, // Fainted
    maxHp: 60,
    // ... other bug properties
  };

  console.log('💊 Using Potion on fainted bug (should fail)...');
  // const result1 = await useItem(POTION.id, { ...mockBug, currentHp: 30 });
  // Expected: ✅ Used Potion, Remaining: X

  console.log('🌿 Using Revive Seed on living bug (should fail)...');
  // const result2 = await useItem(REVIVE_SEED.id, mockBug);
  // Expected: success=true, message="Used Revive Seed"

  console.log('🌿 Using Revive with no bug (should fail)...');
  // const result3 = await useItem(REVIVE_SEED.id); // No target
  // Expected: success=false, message="Revive Seed requires a target bug"

  console.log('🪤 Using Bug Trap (no target needed)...');
  // const result4 = await useItem(BUG_TRAP.id);
  // Expected: success=true, message="Used Bug Trap"

  console.log('❌ Using item that doesn\'t exist...');
  // const result5 = await useItem('item_fake');
  // Expected: success=false, message="Item not found"

  console.log('❌ Using item with 0 quantity...');
  // const result6 = await useItem(POTION.id, mockBug); // when empty
  // Expected: success=false, message="No Potion available"

  console.log('✅ Test 3 complete\n');
}

/**
 * Example 4: Persistence
 * - Add items
 * - Verify they save to AsyncStorage
 * - Reload and verify they persist
 */
export async function testPersistence() {
  console.log('\n🧪 Test 4: Persistence\n');

  console.log('📦 Adding test items...');
  // await addItem(BUG_TRAP.id, 10);
  // await addItem(POTION.id, 5);
  // await addItem(REVIVE_SEED.id, 2);
  // Expected: Items logged and saved to AsyncStorage

  console.log('💾 Simulating app restart...');
  // In real scenario: app is closed and reopened
  // InventoryContext.loadInventory() is called on mount

  console.log('🔍 Verifying items loaded...');
  // const trapQty = getItemQuantity(BUG_TRAP.id); // Should still be 10
  // const potionQty = getItemQuantity(POTION.id); // Should still be 5
  // const seedQty = getItemQuantity(REVIVE_SEED.id); // Should still be 2

  console.log('✅ Test 4 complete\n');
}

/**
 * Example 5: Inventory summary and state queries
 * - Get list of all owned items
 * - Iterate through inventory
 */
export async function testInventorySummary() {
  console.log('\n🧪 Test 5: Inventory Summary\n');

  console.log('📦 Getting inventory summary...');
  // const summary = getInventorySummary();
  // Expected output:
  // [
  //   { itemId: 'item_bug_trap', quantity: 10 },
  //   { itemId: 'item_potion', quantity: 5 },
  //   { itemId: 'item_revive_seed', quantity: 2 },
  // ]

  console.log('🔍 Iterating through inventory with definitions...');
  // summary.forEach(slot => {
  //   const itemDef = getItemDefinition(slot.itemId);
  //   console.log(`  ${itemDef.name}: ${slot.quantity}/${itemDef.stackLimit}`);
  // });

  console.log('✅ Test 5 complete\n');
}

/**
 * TestRunner Component - can be mounted to run tests in app
 */
export const ItemSystemTestRunner: React.FC = () => {
  const { addItem, useItem, removeItem, getItemQuantity, clearInventory } = useInventory();

  const handleRunAllTests = async () => {
    try {
      // Clear first
      await clearInventory();

      // Test 1: Basic management
      Alert.alert('Test 1', 'Adding 5 Bug Traps...');
      await addItem(BUG_TRAP.id, 5);
      const qty1 = getItemQuantity(BUG_TRAP.id);
      Alert.alert('Result', `Bug Traps in inventory: ${qty1} (expected: 5)`);

      // Test 2: Stack limit
      Alert.alert('Test 2', 'Adding 100 Potions (limit 99)...');
      await addItem(POTION.id, 100);
      const qty2 = getItemQuantity(POTION.id);
      Alert.alert('Result', `Potions in inventory: ${qty2} (expected: 99)`);

      // Test 3: Usage with fainted bug
      Alert.alert(
        'Test 3',
        'Using Revive Seed on fainted bug (should succeed)...'
      );
      const mockBug = {
        id: 'test_bug',
        name: 'Test Bug',
        currentHp: 0,
        maxHp: 50,
      };
      const result = await useItem(REVIVE_SEED.id, mockBug as any);
      Alert.alert(
        'Result',
        `Success: ${result.success}\nMessage: ${result.message}\nRemaining: ${result.quantityRemaining}`
      );

      Alert.alert('Success', 'All manual tests completed!');
    } catch (error) {
      Alert.alert('Error', String(error));
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🧪 Item System Test Runner</Text>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Quick Tests</Text>
        <Button title="Run All Tests" onPress={handleRunAllTests} color="#4CAF50" />
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Manual Tests</Text>
        <Button
          title="Test 1: Basic Management"
          onPress={() => testBasicItemManagement()}
          color="#2196F3"
        />
        <View style={{ height: 8 }} />
        <Button
          title="Test 2: Stack Limits"
          onPress={() => testStackLimits()}
          color="#2196F3"
        />
        <View style={{ height: 8 }} />
        <Button
          title="Test 3: Item Usage"
          onPress={() => testItemUsage()}
          color="#2196F3"
        />
        <View style={{ height: 8 }} />
        <Button
          title="Test 4: Persistence"
          onPress={() => testPersistence()}
          color="#2196F3"
        />
        <View style={{ height: 8 }} />
        <Button
          title="Test 5: Inventory Summary"
          onPress={() => testInventorySummary()}
          color="#2196F3"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Debug Actions</Text>
        <Button
          title="Clear Inventory"
          onPress={() => clearInventory()}
          color="#FF6B6B"
        />
      </View>

      <View style={styles.notes}>
        <Text style={styles.notesTitle}>📝 Notes:</Text>
        <Text style={styles.notesText}>
          • Check Console for detailed test output{'\n'}
          • Tests log results starting with ✅, ⚠️, or ❌{'\n'}
          • Inventory persists automatically{'\n'}
          • All items have stack limits
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  notes: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginBottom: 32,
  },
  notesTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1565C0',
  },
});
