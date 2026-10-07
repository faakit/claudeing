import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.tinyacre.farm',
  appName: 'Tiny Acre',
  webDir: 'dist',
  backgroundColor: '#1b1530',
  server: {
    // https scheme keeps IndexedDB/service-worker behaviour identical to the hosted web build.
    androidScheme: 'https',
  },
  ios: {
    // The page handles notches itself with env(safe-area-inset-*) (see index.html).
    contentInset: 'never',
    // Keep the WebView from rubber-banding past the game.
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // We hide it ourselves once the first scene is on screen, so there is no white/black flash.
      launchAutoHide: false,
      backgroundColor: '#1b1530',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1c2c',
    },
  },
};

export default config;
