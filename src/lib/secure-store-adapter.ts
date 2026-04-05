import * as SecureStore from 'expo-secure-store';

// SecureStore has a ~2KB per-item limit on iOS. Large values (JWT tokens, session JSON)
// are split into 1800-char chunks stored under key__0, key__1, … with key__n holding
// the chunk count. Non-chunked items are stored directly under the key.
const CHUNK_SIZE = 1800;

async function getItem(key: string): Promise<string | null> {
  try {
    const countStr = await SecureStore.getItemAsync(`${key}__n`);
    if (countStr === null) {
      return await SecureStore.getItemAsync(key);
    }
    const count = parseInt(countStr, 10);
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}__${i}`))
    );
    if (chunks.some((c) => c === null)) return null;
    return chunks.join('');
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(`${key}__n`).catch(() => {});
    } else {
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }
      await Promise.all([
        SecureStore.setItemAsync(`${key}__n`, String(chunks.length)),
        ...chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}__${i}`, chunk)),
      ]);
      await SecureStore.deleteItemAsync(key).catch(() => {});
    }
  } catch {
    // Silently fail — auth state will be lost but app won't crash
  }
}

async function removeItem(key: string): Promise<void> {
  try {
    const countStr = await SecureStore.getItemAsync(`${key}__n`);
    if (countStr !== null) {
      const count = parseInt(countStr, 10);
      await Promise.all([
        SecureStore.deleteItemAsync(`${key}__n`),
        ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`)),
      ]);
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  } catch {
    // Silently fail
  }
}

const secureStoreAdapter = { getItem, setItem, removeItem };
export default secureStoreAdapter;
