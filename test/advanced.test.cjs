const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Bigdb } = require('../index.cjs');

async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'filedb-'));
  return { dir, db: path.join(dir, 'Database') };
}

test('operators, nested queries and pagination', async () => {
  const { db } = await setup();
  const User = Bigdb(db, 'Users');
  await User.create([
    { name:'Jane', age:20, profile:{ city:'Gulu' } },
    { name:'John', age:30, profile:{ city:'Kampala' } },
    { name:'Mary', age:40, profile:{ city:'Gulu' } }
  ]);
  assert.equal((await User.find({age:{$gt:20}}).count()), 2);
  assert.equal((await User.find({age:{$gte:20,$lte:30}}).count()), 2);
  assert.equal((await User.find({age:{$lt:30}}).count()), 1);
  assert.equal((await User.find({name:{$in:['Jane','Mary']}}).count()), 2);
  assert.equal((await User.find({name:{$ne:'Jane'}}).count()), 2);
  assert.equal((await User.find({name:{$regex:'^J'}}).count()), 2);
  assert.equal((await User.find({'profile.city':'Gulu'}).count()), 2);
  assert.equal((await User.find({$or:[{age:20},{age:40}]}).count()), 2);
  assert.equal((await User.find({$and:[{age:{$gte:20}},{'profile.city':'Gulu'}]}).count()), 2);
  const page2 = await User.find({}).sort({age:'desc'}).page(2).perpage(1).get();
  assert.deepEqual(page2.result.map(x=>x.name), ['John']);
  assert.deepEqual({num_records:page2.num_records,page:page2.page,par_page:page2.par_page,has_next:page2.has_next,has_prev:page2.has_prev,next_page:page2.next_page,prev_page:page2.prev_page,num_pages:page2.num_pages,position:page2.position}, {num_records:3,page:2,par_page:1,has_next:true,has_prev:true,next_page:3,prev_page:1,num_pages:3,position:2});
  assert.deepEqual((await User.find({}).offset(1).limit(1).get()).map(x=>x.name), ['John']);
});

test('schema, indexes and transaction rollback', async () => {
  const { db } = await setup();
  const User = Bigdb(db, 'Users', { schema:{required:['email'],properties:{email:{type:'string'},age:{type:'integer'}}} });
  await User.create({email:'a@example.com',age:20});
  await assert.rejects(() => User.create({age:10}), /Schema validation failed/);
  await User.createIndex('email',{unique:true});
  await assert.rejects(() => User.create({email:'a@example.com',age:30}), /Unique index violation/);
  await assert.rejects(() => User.transaction(async T => { await T.create({email:'b@example.com',age:30}); throw new Error('rollback'); }), /rollback/);
  assert.equal(await User.countDocuments({email:'b@example.com'}), 0);
});

test('stream exposes async iteration', async () => {
  const { db } = await setup();
  const Post = Bigdb(db,'Posts');
  await Post.create([{title:'a'},{title:'b'}]);
  const values=[];
  for await (const doc of Post.stream()) values.push(doc.title);
  assert.deepEqual(values,['a','b']);
});


test('delete accepts ID arrays and findById accepts ID arrays', async () => {
  const { db } = await setup();
  const Post = Bigdb(db, 'Posts');
  await Post.create([{ title: 'one' }, { title: 'two' }, { title: 'three' }, { title: 'four' }]);
  const found = await Post.findById([4, 1, 56, 2]);
  assert.deepEqual(found.map(x => x.id), [4, 1, 2]);
  const deleted = await Post.delete([2, 4, 5]);
  assert.equal(deleted.deletedCount, 2);
  assert.deepEqual((await Post.find({}).sort({id:'asc'}).get()).map(x => x.id), [1, 3]);
});

test('single-file mode uses database.js and stores pretty JSON', async () => {
  const { db } = await setup();
  const User = Bigdb(db, 'Users', true);
  const Post = Bigdb(db, 'Posts', true);
  await User.create({ name: 'Jane' });
  await Post.create({ title: 'Hello' });
  const file = path.join(db, 'database.js');
  const text = await fs.readFile(file, 'utf8');
  assert.match(text, /\n  \"collections\"/);
  assert.equal((await User.countDocuments()), 1);
  assert.equal((await Post.countDocuments()), 1);
  await assert.rejects(() => fs.stat(path.join(db, 'Users.json')), { code: 'ENOENT' });
});
