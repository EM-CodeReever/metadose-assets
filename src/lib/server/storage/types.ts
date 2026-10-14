export interface AttachmentStorage {
	put(key: string, data: Buffer): Promise<void>;
	getReadStream(key: string): Promise<ReadableStream>;
	delete(key: string): Promise<void>;
}
