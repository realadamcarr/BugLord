# Item System - Complete Setup Guide

## 🎯 What's Included

This is the complete **MVP item system** for BugLord's Hive Mode. It provides:

- **5 Pre-defined Items**: Bug Trap, Potion, Super Potion, Revive Seed, Full Revive
- **Type-Safe Inventory**: Centralized state management with async persistence
- **Validation Layer**: Prevents invalid item usage
- **Extensible Design**: Easy to add new items, types, and features
- **No Hive Mode Logic Yet**: Foundation only — ready for battles, quests, shops

---

## 📦 Files Created

### Core System (Required)
```
types/Item.ts                          (70 lines)
  → ItemDefinition, ItemEffect, InventorySlot interfaces
  
constants/Items.ts                     (120 lines)
  → 5 MVP items + ITEM_CATALOG + helper functions
  
contexts/InventoryContext.tsx          (330 lines)
  → State management + persistence + validation
```

### UI & Testing
```
app/inventory.tsx                      (300 lines)
  → Simple inventory screen (grid + details)
  
__tests__/ItemSystemExamples.tsx       (280 lines)
  → 5 test scenarios + manual test runner
```

### Documentation
```
ITEM_SYSTEM.md                         (400+ lines)
  → Comprehensive architecture + API reference
  
ITEM_SYSTEM_QUICK_REF.md               (250+ lines)
  → Quick lookup + common patterns
  
HIVE_MODE_ITEM_INTEGRATION.md          (NEW)
  → Step-by-step wiring guide for battles
  
ITEM_SYSTEM_SETUP.md                   (THIS FILE)
  → Onboarding checklist
```

### Modified Files
```
app/_layout.tsx
  → Added InventoryProvider wrapper
  → Added Stack.Screen for /inventory route
```

---

## ✅ Setup Checklist

### 1. **Verify Provider is Installed**
```bash
# In app/_layout.tsx, you should see:
import { InventoryProvider } from '@/contexts/InventoryContext';

<RootLayoutNav>
  <BugCollectionProvider>
    <InventoryProvider>
      {/* app content */}
    </InventoryProvider>
  </BugCollectionProvider>
</RootLayoutNav>
```

- [ ] InventoryProvider imported
- [ ] InventoryProvider wraps entire app tree
- [ ] Stack.Screen for "/inventory" exists

### 2. **Test Basic Functionality**
Open the app and test these scenarios:

```bash
# (1) Navigate to inventory screen
# Expected: Empty grid (no items yet)

# (2) Open test runner (if available)
# Expected: Can run 5 test scenarios

# (3) Add items manually via debug console
# npm run web → Open DevTools → Experiment with inventory
```

- [ ] Inventory screen loads without errors
- [ ] Can navigate to `/inventory` route
- [ ] No console errors on startup

### 3. **Verify Persistence**
```javascript
// In browser DevTools console:

// Check AsyncStorage
JSON.parse(localStorage.getItem('bug_collection_data')).inventory

// Should return:
// InventorySlot[] - array of owned items
```

- [ ] AsyncStorage key exists: `bug_collection_data`
- [ ] Inventory structure is correct
- [ ] Data persists after page refresh

### 4. **Add Starting Items**
When you implement player initialization, seed initial items:

```typescript
// In BugCollectionContext or player setup:
const { addItem } = useInventory();

// Give player starting items
await addItem('item_potion', 5);        // 5 potions
await addItem('item_bug_trap', 10);     // 10 traps
```

- [ ] Decide on starting item quantities
- [ ] Wire into player initialization
- [ ] Test with fresh app start

---

## 🔄 Usage Pattern (For Components)

### Basic Usage
```typescript
import { useInventory } from '@/contexts/InventoryContext';

export function MyComponent() {
  const { 
    addItem, 
    useItem, 
    getItemQuantity,
    getInventorySummary 
  } = useInventory();

  // Check if player has item
  const hasPotion = getItemQuantity('item_potion') > 0;

  // Use item (with validation)
  const result = await useItem('item_potion', targetBug);
  if (result.success) {
    console.log('Item used!', result.message);
  } else {
    console.log('Failed:', result.message);
  }

  // Add items
  await addItem('item_bug_trap', 1);

  // Get all items
  const allItems = getInventorySummary();
}
```

### Trap Items
```typescript
// Traps don't require a target
const result = await useItem('item_bug_trap');

// Result includes catch rate bonus in message
// "🪤 Bug Trap prepared! Next catch attempt: +25%"
```

### Heal Items
```typescript
// Heals require living bug target
const result = await useItem('item_potion', playerBug);

// Fails if:
// - playerBug is fainted (currentHp <= 0)
// - playerBug is undefined/null
```

### Revive Items
```typescript
// Revives require fainted bug target
const result = await useItem('item_revive_seed', playerBug);

// Fails if:
// - playerBug is alive (currentHp > 0)
// - playerBug is undefined/null

// On success: restores 50% HP (Revive Seed) or 100% HP (Full Revive)
```

---

## 🎮 Wiring into Hive Mode

### Quick Start
See `HIVE_MODE_ITEM_INTEGRATION.md` for complete guide.

### Essential Steps

**1. Import Items & Hook**
```typescript
import { useInventory } from '@/contexts/InventoryContext';
import { POTION, REVIVE_SEED, BUG_TRAP } from '@/constants/Items';

const { useItem, getItemQuantity } = useInventory();
```

**2. Show Item Buttons During Battle**
```typescript
// Only show if player has the item
{getItemQuantity(POTION.id) > 0 && (
  <Button 
    title={`Use Potion (${getItemQuantity(POTION.id)})`}
    onPress={() => useItemInBattle('item_potion', playerBug)}
  />
)}
```

**3. Handle Item Effects**
```typescript
const result = await useItem('item_potion', playerBug);

if (result.success) {
  // Apply effect (restore HP)
  playerBug.currentHp = Math.min(
    playerBug.currentHp + 25,
    playerBug.maxHp
  );
  
  // Show message to player
  battleLog.push(`+25 HP! (${result.message})`);
}
```

**4. Trap Logic (For Catch)**
```typescript
// When player attempts to catch:
const trapActive = battleState.activeTrap === true;
let catchChance = 0.3; // 30% base

if (trapActive) {
  catchChance += 0.25; // Add trap bonus (+25%)
}

if (Math.random() < catchChance) {
  // Catch succeeded!
}

// Reset trap after attempt
battleState.activeTrap = false;
```

---

## 📊 MVP Items at a Glance

| Item | Type | Effect | Stack |
|------|------|--------|-------|
| **Bug Trap** | Trap | +25% catch rate | 99 |
| **Potion** | Heal | +25 HP | 99 |
| **Super Potion** | Heal | +50 HP | 99 |
| **Revive Seed** | Revive | 50% HP | 99 |
| **Full Revive** | Revive | 100% HP | 50 |

---

## 🧪 Testing & Debug

### Manual Test Runner
The test runner component lets you validate the system:

```typescript
// In __tests__/ItemSystemExamples.tsx
// 5 scenarios:
✓ Basic item management (add/check/remove)
✓ Stack limits (99 max for normal, 50 for rare)
✓ Item usage validation (heal on living, revive on fainted)
✓ AsyncStorage persistence (save/load)
✓ Inventory summary queries
```

### Console Debug Commands
```javascript
// Check inventory state
console.log(JSON.parse(localStorage.getItem('bug_collection_data')));

// Test item use (copy into browser console)
const inventory = JSON.parse(localStorage.getItem('bug_collection_data'));
console.log('Current items:', inventory.slots);
```

### Common Issues

**❌ Item doesn't use**
- Check: Does player have item? (`getItemQuantity(itemId) > 0`)
- Check: Is target bug valid?
- Check: Heal/Revive type validation (bug state requirements)

**❌ AsyncStorage not persisting**
- Check: Is InventoryProvider in root layout?
- Check: Browser DevTools → Application → LocalStorage
- Check: Console for storage errors

**❌ New items don't appear**
- Check: Added to ITEM_CATALOG in `constants/Items.ts`?
- Check: ItemId matches in useItem call?
- Check: Added to ITEM_CATALOG object (not just array)?

---

## 🚀 Next Steps

### Immediate (This Sprint)
1. ✅ Item system foundation complete
2. **TODO**: Wire items into Hive Mode battles
3. **TODO**: Give player starting items on game init
4. **TODO**: Test item persistence across app restarts

### Soon (Next Sprint)
- Implement shop/vendor system (build on item catalog)
- Add quest reward system (give items as quest rewards)
- Create drop tables for wild bugs
- Add cosmetic item rarity display

### Future (Roadmap)
- Equipment system
- Item crafting/combining
- Status effect items (burn, freeze, poison)
- Item durations (temporary effects)
- Rarity-based item cosmetics

---

## 📖 Documentation Files

- **`ITEM_SYSTEM.md`** - Complete architecture + API reference
- **`ITEM_SYSTEM_QUICK_REF.md`** - Quick lookup + patterns
- **`HIVE_MODE_ITEM_INTEGRATION.md`** - Battle integration guide
- **`ITEM_SYSTEM_SETUP.md`** - This file (onboarding)

---

## 💡 Pro Tips

1. **Always validate before use**: `useItem()` returns a result object with success status
2. **Check inventory before showing buttons**: Use `getItemQuantity(itemId) > 0`
3. **Type-specific validation is automatic**: Can't heal a fainted bug, can't revive a living one
4. **Stack limits prevent overload**: Adding 100 items when limit is 99 will store only 99
5. **Persistence is automatic**: Every mutation (add/use/remove) saves to AsyncStorage
6. **Extensibility is built-in**: See ITEM_SYSTEM.md for adding new item types/items

---

## 🆘 Support

If something breaks:

1. Check console for error messages
2. Review validation rules in `contexts/InventoryContext.tsx`
3. See `HIVE_MODE_ITEM_INTEGRATION.md` for battle wiring
4. Verify InventoryProvider is in root layout
5. Clear browser storage and restart app

---

**Status**: ✅ Ready for Hive Mode integration
**Last Updated**: Feature branch `feature/bugdex` commit `ccab7ba`
