const fs = require('fs');
const os = require('os');
const path = require('path');

// On EAS builds, GoogleService-Info.plist is stored as a base64 env var
// and decoded to a temp file at build time.
function resolveGoogleServicesFile() {
  const b64 = process.env.GOOGLE_SERVICES_INFO_PLIST_BASE64;
  if (b64) {
    const tmpPath = path.join(os.tmpdir(), 'GoogleService-Info.plist');
    fs.writeFileSync(tmpPath, Buffer.from(b64, 'base64'));
    return tmpPath;
  }
  // Local development fallback
  return './GoogleService-Info.plist';
}

module.exports = ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      googleServicesFile: resolveGoogleServicesFile(),
    },
  };
};
