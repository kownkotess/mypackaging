import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bellestore.mypackaging',
  appName: 'MyPackaging',
  webDir: 'build',
  server: {
    // Point to your Firebase hosting URL for live updates
    url: 'https://mypackagingbybellestore.web.app',
    cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'light', // Light text/icons (white) for status bar - visible on dark background
      backgroundColor: '#80004D24', // Semi-transparent green (80 = 50% opacity in hex)
      overlaysWebView: true // Allow app to extend under status bar with translucent overlay
    }
  }
};

export default config;
