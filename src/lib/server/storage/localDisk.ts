import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { env } from '$env/dynamic/private';
import type { AttachmentStorage } from './types';

const ROOT = env.UPLOADS_DIR || './uploads';

// `key` is always server-generated (see attachments.ts) — never derived from raw user input —
// so joining it under ROOT can't be used for path traversal.
function resolvePath(key: string): string {
	return join(ROOT, key);
}

export const localDiskStorage: AttachmentStorage = {
	async put(key, data) {
		const path = resolvePath(key);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, data);
	},
	async getReadStream(key) {
		const path = resolvePath(key);
		return Readable.toWeb(createReadStream(path)) as ReadableStream;
	},
	async delete(key) {
		const path = resolvePath(key);
		await unlink(path).catch(() => {});
	}
};
