import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ca.nivratelecom.app',
  appName: 'Nivra Telecom',
  webDir: 'dist',
  server: {
    url: 'https://15339968-8359-42a0-b60e-042f582b4ea7.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
