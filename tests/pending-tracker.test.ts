/**
 * pending-tracker.test.ts
 *
 * Tests for the PendingTracker optimistic message deduplication engine.
 */

/// <reference types="jest" />

import { PendingTracker } from '../src/pending-tracker';
import type { Attachment } from '../src/types';

describe('PendingTracker', () => {
    let tracker: PendingTracker;

    beforeEach(() => {
        tracker = new PendingTracker();
    });

    describe('createTempId', () => {
        it('should generate unique temp IDs', () => {
            const id1 = tracker.createTempId();
            const id2 = tracker.createTempId();
            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^pending-send-\d+-\d+$/);
        });

        it('should increment sequence counter', () => {
            tracker.createTempId();
            tracker.createTempId();
            const id3 = tracker.createTempId();
            expect(id3).toMatch(/-3$/);
        });
    });

    describe('register and findUnresolved', () => {
        it('should register a pending send and find it by content', () => {
            const tempId = tracker.createTempId();
            const sentAt = new Date().toISOString();
            const content = 'Hello world';
            const attachments: Attachment[] = [];

            tracker.register(tempId, sentAt, content, attachments);

            const found = tracker.findUnresolved(content, attachments, sentAt);
            expect(found).not.toBeNull();
            expect(found!.tempId).toBe(tempId);
            expect(found!.status).toBe('active');
        });

        it('should find by exact attachment fingerprint', () => {
            const tempId = tracker.createTempId();
            const sentAt = new Date().toISOString();
            const attachments: Attachment[] = [
                { url: 'test.pdf', fileName: 'test.pdf', contentType: 'application/pdf', kind: 'pdf' }
            ];

            tracker.register(tempId, sentAt, 'Test', attachments);

            const found = tracker.findUnresolved('Test', attachments, sentAt);
            expect(found).not.toBeNull();

            // Different filename with same content type should still match via loose fingerprint
            // when in the time window
            const differentAttachments: Attachment[] = [
                { url: 'other.pdf', fileName: 'other.pdf', contentType: 'application/pdf', kind: 'pdf' }
            ];
            const notFound = tracker.findUnresolved('Test', differentAttachments, new Date(Date.now() + 20000).toISOString());
            expect(notFound).toBeNull();
        });

        it('should match within time window', () => {
            const tempId = tracker.createTempId();
            const now = Date.now();
            const sentAt = new Date(now).toISOString();
            const justInsideWindow = new Date(now + 14000).toISOString();
            const outsideWindow = new Date(now + 16000).toISOString();

            tracker.register(tempId, sentAt, 'Test', []);

            expect(tracker.findUnresolved('Test', [], justInsideWindow)).not.toBeNull();
            expect(tracker.findUnresolved('Test', [], outsideWindow)).toBeNull();
        });
    });

    describe('findByTempId', () => {
        it('should find entry by temp ID', () => {
            const tempId = tracker.createTempId();
            tracker.register(tempId, new Date().toISOString(), 'Test', []);

            const found = tracker.findByTempId(tempId);
            expect(found).not.toBeNull();
            expect(found!.tempId).toBe(tempId);
        });

        it('should return null for unknown temp ID', () => {
            expect(tracker.findByTempId('unknown-id')).toBeNull();
        });
    });

    describe('resolve', () => {
        it('should mark entry as resolved', () => {
            const tempId = tracker.createTempId();
            tracker.register(tempId, new Date().toISOString(), 'Test', []);

            const entry = tracker.findByTempId(tempId)!;
            expect(tracker.resolve(entry)).toBe(true);

            const resolved = tracker.findByTempId(tempId);
            expect(resolved!.status).toBe('resolved');
            expect(resolved!.resolvedAt).toBeGreaterThan(0);
        });

        it('should prevent duplicate resolution', () => {
            const tempId = tracker.createTempId();
            tracker.register(tempId, new Date().toISOString(), 'Test', []);

            const entry = tracker.findByTempId(tempId)!;
            tracker.resolve(entry);

            // Second resolve should return false
            expect(tracker.resolve(entry)).toBe(false);
        });

        it('should not resolve non-active entries', () => {
            const tempId = tracker.createTempId();
            tracker.register(tempId, new Date().toISOString(), 'Test', []);

            const entry = tracker.findByTempId(tempId)!;
            tracker.markFailed(tempId);

            expect(tracker.resolve(entry)).toBe(false);
        });
    });

    describe('findResolved', () => {
        it('should find resolved entries', () => {
            const tempId = tracker.createTempId();
            const sentAt = new Date().toISOString();
            tracker.register(tempId, sentAt, 'Test', []);

            const entry = tracker.findUnresolved('Test', [], sentAt)!;
            tracker.resolve(entry);

            expect(tracker.findResolved('Test', [], sentAt)).not.toBeNull();
            expect(tracker.findUnresolved('Test', [], sentAt)).toBeNull();
        });
    });

    describe('markFailed', () => {
        it('should mark entry as failed', () => {
            const tempId = tracker.createTempId();
            const sentAt = new Date().toISOString();
            tracker.register(tempId, sentAt, 'Test', []);

            expect(tracker.markFailed(tempId)).toBe(true);

            // Entry should be pruned after marking as failed
            const entry = tracker.findByTempId(tempId);
            expect(entry).toBeNull();
        });

        it('should not mark already resolved entry as failed', () => {
            const tempId = tracker.createTempId();
            tracker.register(tempId, new Date().toISOString(), 'Test', []);

            const entry = tracker.findByTempId(tempId)!;
            tracker.resolve(entry);

            expect(tracker.markFailed(tempId)).toBe(false);
        });
    });

    describe('loose fingerprint matching', () => {
        it('should fall back to loose fingerprint when exact match fails', () => {
            const tempId = tracker.createTempId();
            const sentAt = new Date().toISOString();
            const attachments: Attachment[] = [
                { url: 'original.pdf', fileName: 'original.pdf', contentType: 'application/pdf', kind: 'pdf' }
            ];

            tracker.register(tempId, sentAt, 'Test', attachments);

            // Same content type and kind, different filename (server may rename)
            const serverAttachments: Attachment[] = [
                { url: 'renamed.pdf', fileName: 'renamed.pdf', contentType: 'application/pdf', kind: 'pdf' }
            ];

            const found = tracker.findUnresolved('Test', serverAttachments, sentAt);
            expect(found).not.toBeNull();
        });
    });

    describe('edge cases', () => {
        it('should handle empty content', () => {
            const tempId = tracker.createTempId();
            tracker.register(tempId, new Date().toISOString(), '', []);

            const found = tracker.findUnresolved('', [], new Date().toISOString());
            expect(found).not.toBeNull();
        });

        it('should handle null/undefined attachments', () => {
            const tempId = tracker.createTempId();
            tracker.register(tempId, new Date().toISOString(), 'Test', null as unknown as Attachment[]);

            const found = tracker.findUnresolved('Test', [], new Date().toISOString());
            expect(found).not.toBeNull();
        });

        it('should handle whitespace trimming', () => {
            const tempId = tracker.createTempId();
            tracker.register(tempId, new Date().toISOString(), '  Test  ', []);

            const found = tracker.findUnresolved('Test', [], new Date().toISOString());
            expect(found).not.toBeNull();
        });
    });
});
