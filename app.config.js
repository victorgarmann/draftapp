const fs = require('fs');
const os = require('os');
const path = require('path');

function resolveIosGoogleServicesFile() {
  const b64 = process.env.GOOGLE_SERVICES_INFO_PLIST_BASE64;
  if (b64) {
    const tmpPath = path.join(os.tmpdir(), 'GoogleService-Info.plist');
    fs.writeFileSync(tmpPath, Buffer.from(b64, 'base64'));
    return tmpPath;
  }
  return './GoogleService-Info.plist';
}

function resolveAndroidGoogleServicesFile() {
  const b64 = process.env.GOOGLE_SERVICES_JSON_BASE64;
  if (b64) {
    const tmpPath = path.join(os.tmpdir(), 'google-services.json');
    fs.writeFileSync(tmpPath, Buffer.from(b64, 'base64'));
    return tmpPath;
  }
  return './google-services.json';
}

module.exports = ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      googleServicesFile: resolveIosGoogleServicesFile(),
    },
    android: {
      ...config.android,
      googleServicesFile: resolveAndroidGoogleServicesFile(),
    },
  };
};
