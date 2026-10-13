import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quietspiritstudio.tinyacre',
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
    // Android edge-to-edge (forced from API 35): the page draws under the system bars and keeps its controls clear
    // with env(safe-area-inset-*) (index.html #frame). On WebView 140+ with viewport-fit=cover the insets pass
    // through to env(); on older WebViews Capacitor pads the WebView itself and env() reads 0. 'css' also injects
    // --safe-area-inset-* variables. MainActivity hides the bars (immersive), so normally only the cutout counts.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
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
