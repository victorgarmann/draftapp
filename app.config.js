const { withInfoPlist } = require('@expo/config-plugins');

// app.config.js overrides app.json — used to inject the GoogleService-Info.plist
// path from an EAS file environment variable at build time.
module.exports = ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
    },
  };
};
