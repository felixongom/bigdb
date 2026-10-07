const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Bigdb } = require('../index.cjs');

async function tempDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'filedb-test-'));
}

test('creates database file and inserts one and many documents', async () => {
  const root = await tempDirectory();
  const posts = Bigdb(root, 'Posts');
  const one = await posts.create({ title: 'one' });
  const many = await posts.create([{ title: 'two' }, { title: 'three' }]);
  assert.equal(one.id, 1);
  assert.equal(many.length, 2);
  assert.equal(many[0].id, 2);
  assert.equal((await fs.stat(path.join(root, 'Posts.json'))).isFile(), true);
  const saved = await fs.readFile(path.join(root, 'Posts.json'), 'utf8');
  assert.match(saved, /\n  \"collections\"/);
  assert.equal((await posts.findById(3)).title, 'three');
});

test('queries, operators, sorting, skip, limit and projection work', async () => {
  const root = await tempDirectory();
  const users = Bigdb(root, 'Users');
  await users.create([{ name: 'Jane', age: 20 }, { name: 'Jane', age: 30 }, { name: 'Sam', age: 15 }]);
  const result = await users.find({ name: 'Jane', age: { $gte: 20 } }).sort({ age: 'desc' }).skip(0).limit(1).select(['name', 'age']).get();
  assert.deepEqual(result, [{ name: 'Jane', age: 30, id: 2 }]);
  assert.equal(await users.countDocuments({ age: { $lt: 18 } }), 1);
  assert.equal(await users.find({ $or: [{ name: 'Sam' }, { age: 30 }] }).count(), 2);
});

test('updates and deletes documents', async () => {
  const root = await tempDirectory();
  const posts = Bigdb(root, 'Posts');
  await posts.create([{ title: 'a', active: false }, { title: 'b', active: false }]);
  const updated = await posts.update({ active: false }, { active: true });
  assert.equal(updated.matchedCount, 2);
  const deleted = await posts.delete(1);
  assert.equal(deleted.deletedCount, 1);
  assert.equal(await posts.findById(1), null);
  assert.equal(await posts.countDocuments(), 1);
});

test('supports ESM named and default imports', async () => {
  const mod = await import('../index.js');
  assert.equal(typeof mod.Bigdb, 'function');
  assert.equal(typeof mod.default, 'function');
});
