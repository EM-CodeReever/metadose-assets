import { localDiskStorage } from './localDisk';
import type { AttachmentStorage } from './types';

/** Only 'local' is implemented for v1; callers depend on the interface, not this backend. */
export function getStorage(): AttachmentStorage {
	return localDiskStorage;
}

export type { AttachmentStorage };
