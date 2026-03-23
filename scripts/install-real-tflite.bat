@echo off
echo 🚀 Installing BugLord with Real TensorFlow Lite...

echo 📱 Installing APK...
"C:\Program Files\SideQuest\resources\app.asar.unpacked\build\platform-tools\adb.exe" install -r android\app\build\outputs\apk\debug\app-debug.apk

echo 📂 Creating ML directory...
"C:\Program Files\SideQuest\resources\app.asar.unpacked\build\platform-tools\adb.exe" shell mkdir -p /data/data/com.anonymous.buglord/files/ml/

echo 📁 Copying 12MB trained model...
"C:\Program Files\SideQuest\resources\app.asar.unpacked\build\platform-tools\adb.exe" push assets\ml\insect_detector.tflite /data/data/com.anonymous.buglord/files/ml/insect_detector.tflite

echo 📋 Copying labels...
"C:\Program Files\SideQuest\resources\app.asar.unpacked\build\platform-tools\adb.exe" push assets\ml\labels.json /data/data/com.anonymous.buglord/files/ml/labels.json

echo ✅ Installation complete! Connect device and run this script.
pause