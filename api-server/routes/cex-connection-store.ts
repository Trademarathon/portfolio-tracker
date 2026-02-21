/**
 * In-memory store for CEX connection keys (secure proxy).
 * Keys are used only server-side for place-order; frontend sends connectionId only after register.
 */
const connectionStore = new Map<
  string,
  { exchangeId: string; apiKey: string; secret: string }
>();

export function getStoredConnection(connectionId: string) {
  return connectionStore.get(connectionId);
}

export function setStoredConnection(
  connectionId: string,
  data: { exchangeId: string; apiKey: string; secret: string }
) {
  connectionStore.set(connectionId, data);
}
