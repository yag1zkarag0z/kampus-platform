import "server-only";

import {
  createMediaStorage,
  isManagedStorageKey,
  type MediaStorage,
  type StoredObject,
  type StoredObjectMetadata,
} from "./storage-core";

export {
  isManagedStorageKey,
  type MediaStorage,
  type StoredObject,
  type StoredObjectMetadata,
};

const globalForMediaStorage = globalThis as typeof globalThis & {
  __kampusMediaStorage?: MediaStorage;
};

export function getMediaStorage() {
  if (globalForMediaStorage.__kampusMediaStorage) {
    return globalForMediaStorage.__kampusMediaStorage;
  }

  const storage = createMediaStorage();

  globalForMediaStorage.__kampusMediaStorage = storage;
  return storage;
}
