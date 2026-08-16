// Simple script to copy the model using Node.js
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, 'assets', 'ml', 'insect_detector.tflite');
const dest = path.join(__dirname, 'assets', 'ml', 'model_ready.tflite');

console.log('📦 Copying trained model...');
console.log('Source:', source);
console.log('Dest:', dest);

try {
  const stats = fs.statSync(source);
  console.log(`📊 Source size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  
  fs.copyFileSync(source, dest);
  
  const destStats = fs.statSync(dest);
  console.log(`✅ Successfully copied! Dest size: ${(destStats.size / 1024 / 1024).toFixed(1)} MB`);
} catch (error) {
  console.error('❌ Copy failed:', error.message);
}