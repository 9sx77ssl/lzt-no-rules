import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db.js';

function withDb(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'no-rules-db-'));
  const db = openDatabase({ path: join(dir, 'test.db') });
  try {
    fn(db);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

const user = {
  id: 1,
  username: 'tester',
  usernameHtml: '<span class="styleUserNickname" style="color:#aabbcc">tester</span>',
  color: '#aabbcc',
  avatar: 'https://nztcdn.com/avatar/s/1/1.webp',
};

test('stores users, sessions, messages and history', () => {
  withDb((db) => {
    const stored = db.upsertUser(user);
    assert.equal(stored.username, 'tester');
    assert.equal(db.getUser(1).color, '#aabbcc');

    db.createSession({
      tokenHash: 'hash',
      userId: 1,
      createdAt: 1000,
      expiresAt: 2000,
      maxPerUser: 10,
    });
    assert.equal(db.getSession('hash').user.username, 'tester');
    db.touchSession('hash', 1500);
    assert.equal(db.getSession('hash').lastUsedAt, 1500);

    const first = db.insertMessage({
      user: stored,
      html: '<p>one</p>',
      text: 'one',
      clientId: 'client-1',
      createdAt: 1000,
      meta: { images: 0 },
    });
    assert.equal(first.duplicate, false);
    assert.equal(first.message.text, 'one');

    const duplicate = db.insertMessage({
      user: stored,
      html: '<p>one</p>',
      text: 'one',
      clientId: 'client-1',
      createdAt: 1100,
      meta: { images: 0 },
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.message.id, first.message.id);

    const second = db.insertMessage({
      user: stored,
      html: '<p>two</p>',
      text: 'two',
      clientId: 'client-2',
      createdAt: 1200,
      reply: { id: first.message.id, user: { id: 1, username: 'tester' }, text: 'one' },
      meta: { images: 0 },
    });
    assert.equal(second.message.reply.id, first.message.id);

    const page = db.getHistory({ limit: 1 });
    assert.equal(page.messages.length, 1);
    assert.equal(page.messages[0].id, second.message.id);
    assert.equal(page.hasMore, true);

    const older = db.getHistory({ before: second.message.id, limit: 1 });
    assert.equal(older.messages[0].id, first.message.id);

    const after = db.getHistory({ after: first.message.id, limit: 10 });
    assert.equal(after.messages[0].id, second.message.id);

    const edited = db.updateMessage({
      id: first.message.id,
      html: '<p>one edited</p>',
      text: 'one edited',
      meta: { images: 0 },
    });
    assert.equal(edited.text, 'one edited');
    assert.ok(edited.editedAt);

    const deleted = db.deleteMessage({ id: first.message.id, deletedBy: 1 });
    assert.equal(deleted.deleted, true);
    assert.equal(deleted.html, '');
    assert.equal(db.getHistory({ limit: 10 }).messages.find((m) => m.id === first.message.id).deleted, true);
  });
});
