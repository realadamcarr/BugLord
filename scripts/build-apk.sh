#!/bin/bash
# BugLord APK Build Script
# Run these commands one by one in your terminal

echo "Building BugLord APK..."
echo "Step 1: Login to EAS"
eas login

echo "Step 2: Configure build"
eas build:configure

echo "Step 3: Start APK build"
eas build --platform android --profile preview

echo "Build started! Check your Expo dashboard for progress."
echo "Download link will be provided when complete."
