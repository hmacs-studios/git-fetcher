import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hmacs.medmacs',
  appName: 'Medmacs',
  webDir: 'dist',
  plugins: {
    // 🎯 ADDED: Capgo Capacitor Updater Configuration
    CapacitorUpdater: {
      autoUpdate: false,
      appReadyTimeout: 30000,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      resetWhenUpdate: true,
      allowManualBundleError: true,
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '1072567800759-9gup2643t3svl9bbf5p9ic813n42h5fq.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      androidScaleType: "CENTER_CROP",
      backgroundColor: "#ffffff"
    },
    CapacitorHttp: {
      enabled: true,
    }
  },
  server: {
    androidScheme: 'https',
    hostname: 'com.hmacs.medmacs',
    allowNavigation: [
      'ipguat.apps.net.pk',
      'ipguat2.apps.net.pk',
      'ipg1.apps.net.pk',
      'ipg2.apps.net.pk',
      'com.hmacs.medmacs',
      'medmacs.app',
      '*.medmacs.app',
      'apps.net.pk',
      '*.apps.net.pk'
    ]
  }
};

export default config;
