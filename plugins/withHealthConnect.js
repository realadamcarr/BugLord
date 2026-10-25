/**
 * Health Connect wiring that `npx expo prebuild --clean` would otherwise drop:
 * - registers react-native-health-connect's permission delegate in
 *   MainActivity (without it requestPermission crashes, so Walk Mode can
 *   never read step history on Android)
 * - adds the Android 14+ VIEW_PERMISSION_USAGE activity-alias Health Connect
 *   requires before it will show the permission screen
 */
const { withAndroidManifest, withMainActivity } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';

function withPermissionUsageAlias(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    app['activity-alias'] = app['activity-alias'] ?? [];
    const exists = app['activity-alias'].some(
      (a) => a.$['android:name'] === 'ViewPermissionUsageActivity',
    );
    if (!exists) {
      app['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
          },
        ],
      });
    }
    return cfg;
  });
}

module.exports = function withHealthConnect(config) {
  config = withPermissionUsageAlias(config);
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes(IMPORT)) {
      src = src.replace(/^(package [^\n]+\n)/, `$1\n${IMPORT}\n`);
    }
    src = mergeContents({
      src,
      tag: 'health-connect-permission-delegate',
      newSrc: '    HealthConnectPermissionDelegate.setPermissionDelegate(this)',
      anchor: /super\.onCreate\(/,
      offset: 1,
      comment: '//',
    }).contents;
    cfg.modResults.contents = src;
    return cfg;
  });
};
