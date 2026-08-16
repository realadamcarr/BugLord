"""Evaluate the trained BugLord ML model."""
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import ImageFile
from tensorflow.keras.preprocessing.image import ImageDataGenerator

ImageFile.LOAD_TRUNCATED_IMAGES = True

MODEL_DIR = Path('models/20260211_232929')
DATASET = Path('dataset_merged')

# Load the best Keras model
model = tf.keras.models.load_model(str(MODEL_DIR / 'best_model.h5'))

# Create validation generator (same 20% split as training)
full_gen = ImageDataGenerator(rescale=1./255, validation_split=0.2)
val_gen = full_gen.flow_from_directory(
    DATASET, target_size=(224, 224), batch_size=32,
    class_mode='categorical', shuffle=False,
    subset='validation', seed=42
)

print(f'\nValidation samples: {val_gen.samples}')
print(f'Classes: {list(val_gen.class_indices.keys())}')

# Evaluate overall
results = model.evaluate(val_gen, verbose=0)
print('\n' + '=' * 60)
print('OVERALL RESULTS')
print('=' * 60)
for name, val in zip(model.metrics_names, results):
    print(f'  {name}: {val:.4f}')

# Per-class predictions
val_gen.reset()
y_pred_probs = model.predict(val_gen, verbose=0)
y_pred = np.argmax(y_pred_probs, axis=1)
y_true = val_gen.classes
class_names = list(val_gen.class_indices.keys())

# Confusion matrix
print('\n' + '=' * 60)
print('CONFUSION MATRIX')
print('=' * 60)
print('Predicted →')
header = ''.ljust(12) + ''.join([c[:8].ljust(10) for c in class_names])
print(header)
print('-' * len(header))

n_classes = len(class_names)
cm = np.zeros((n_classes, n_classes), dtype=int)
for t, p in zip(y_true, y_pred):
    cm[t][p] += 1

for i, row in enumerate(cm):
    print(class_names[i][:11].ljust(12) + ''.join([str(v).ljust(10) for v in row]))

# Per-class metrics
print('\n' + '=' * 60)
print('PER-CLASS METRICS')
print('=' * 60)

for i, cls in enumerate(class_names):
    mask = y_true == i
    cls_total = mask.sum()
    cls_correct = (y_pred[mask] == i).sum()
    acc = cls_correct / cls_total if cls_total > 0 else 0

    tp = ((y_pred == i) & (y_true == i)).sum()
    fp = ((y_pred == i) & (y_true != i)).sum()
    fn = ((y_pred != i) & (y_true == i)).sum()
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    print(f'  {cls:12s}  acc={acc:.1%}  prec={precision:.1%}  recall={recall:.1%}  f1={f1:.1%}  ({cls_correct}/{cls_total})')

# Training history summary
with open(MODEL_DIR / 'training_history.json') as f:
    hist = json.load(f)

total_epochs = len(hist['accuracy'])
best_val_epoch = int(np.argmax(hist['val_accuracy'])) + 1
best_val_acc = max(hist['val_accuracy'])
final_train_acc = hist['accuracy'][-1]
final_val_acc = hist['val_accuracy'][-1]

print('\n' + '=' * 60)
print('TRAINING SUMMARY')
print('=' * 60)
print(f'  Total epochs trained: {total_epochs}')
print(f'  Phase 1 (head-only, LR=0.001): epochs 1-10')
print(f'  Phase 2 (fine-tune, LR=0.0001): epochs 11-{total_epochs}')
print(f'  Best val_accuracy: {best_val_acc:.1%} (epoch {best_val_epoch})')
print(f'  Final train_accuracy: {final_train_acc:.1%}')
print(f'  Final val_accuracy: {final_val_acc:.1%}')
print(f'  Train/Val gap: {(final_train_acc - final_val_acc):.1%}')
print(f'  Best val_loss: {min(hist["val_loss"]):.4f}')

# Confidence distribution
mean_conf = np.max(y_pred_probs, axis=1).mean()
low_conf = (np.max(y_pred_probs, axis=1) < 0.5).sum()
high_conf = (np.max(y_pred_probs, axis=1) > 0.8).sum()
total = len(y_pred)

print(f'\n  Confidence stats:')
print(f'    Mean confidence: {mean_conf:.1%}')
print(f'    Low confidence (<50%): {low_conf}/{total} ({low_conf/total:.1%})')
print(f'    High confidence (>80%): {high_conf}/{total} ({high_conf/total:.1%})')

# Compare to old model
print('\n' + '=' * 60)
print('COMPARISON TO PREVIOUS MODEL')
print('=' * 60)
old_val = 0.47
train_at_best = hist['accuracy'][best_val_epoch - 1]
print(f'  Old model: ~47% val accuracy, 86% train (severe overfit)')
print(f'  New model: {best_val_acc:.1%} val accuracy, {train_at_best:.1%} train')
improvement = (best_val_acc - old_val) * 100
print(f'  Improvement: +{improvement:.1f} percentage points on validation')
gap_old = 0.86 - 0.47
gap_new = final_train_acc - final_val_acc
print(f'  Overfit gap: {gap_old:.1%} (old) → {gap_new:.1%} (new)')

# TFLite model size
tflite_path = MODEL_DIR / 'model.tflite'
size_mb = tflite_path.stat().st_size / (1024 * 1024)
print(f'\n  TFLite model size: {size_mb:.2f} MB')
print(f'  Labels: {class_names}')

# Verdict
print('\n' + '=' * 60)
if best_val_acc >= 0.85:
    print('🏆 VERDICT: EXCELLENT — Ready for production deployment!')
elif best_val_acc >= 0.75:
    print('✅ VERDICT: GOOD — Significant improvement, ready to deploy.')
elif best_val_acc >= 0.60:
    print('⚠️  VERDICT: FAIR — Better than before, but more data would help.')
else:
    print('❌ VERDICT: POOR — More data and tuning needed.')
print('=' * 60)
