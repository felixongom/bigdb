'use strict';

const fs = require('node:fs/promises');
const fss = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
// 
const FORMAT_VERSION = 2;
const DEFAULT_LOCK_TIMEOUT = 30_000;
const DEFAULT_STALE_LOCK = 120_000;
const writeQueues = new Map();
const caches = new Map();
const indexes = new Map();

function resolveDatabaseFile(directory, collectionName, singleFile = false) {
  if (typeof directory !== 'string' || !directory.trim()) throw new TypeError('Bigdb(directory, collection): directory must be a non-empty string.');
  const root = path.resolve(process.cwd(), directory);
  if (singleFile) return path.join(root, 'database.json');
  if (typeof collectionName !== 'string' || !collectionName.trim()) throw new TypeError('A collection name is required for per-collection storage.');
  const safeName = collectionName.trim().replace(/[\\/\0]/g, '_');
  return path.join(root, `${safeName}.json`);
}
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function getPath(obj, dotted) {
  if (dotted === '' || dotted == null) return obj;
  return String(dotted).split('.').reduce((v, k) => v == null ? undefined : v[k], obj);
}
function setPath(obj, dotted, value) {
  const parts = String(dotted).split('.'); let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
  cur[parts.at(-1)] = value; return obj;
}
function unsetPath(obj, dotted) {
  const parts = String(dotted).split('.'); let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) { if (!cur || typeof cur !== 'object') return; cur = cur[parts[i]]; }
  if (cur && typeof cur === 'object') delete cur[parts.at(-1)];
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date); }
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function compareValues(actual, expected) {
  if (isPlainObject(expected)) {
    for (const [op, operand] of Object.entries(expected)) {
      switch (op) {
        case '$eq': if (!same(actual, operand)) return false; break;
        case '$ne': if (same(actual, operand)) return false; break;
        case '$gt': if (!(actual > operand)) return false; break;
        case '$gte': if (!(actual >= operand)) return false; break;
        case '$lt': if (!(actual < operand)) return false; break;
        case '$lte': if (!(actual <= operand)) return false; break;
        case '$in': if (!Array.isArray(operand) || !operand.some(x => same(actual, x) || (Array.isArray(actual) && actual.some(a => same(a, x))))) return false; break;
        case '$nin': if (Array.isArray(operand) && operand.some(x => same(actual, x) || (Array.isArray(actual) && actual.some(a => same(a, x))))) return false; break;
        case '$regex': {
          let re = operand instanceof RegExp ? operand : new RegExp(String(operand));
          if (typeof actual !== 'string' || !re.test(actual)) return false; break;
        }
        case '$exists': if ((actual !== undefined) !== Boolean(operand)) return false; break;
        case '$contains': if (typeof actual === 'string' ? !actual.includes(String(operand)) : !Array.isArray(actual) || !actual.some(x => same(x, operand))) return false; break;
        case '$startsWith': if (typeof actual !== 'string' || !actual.startsWith(String(operand))) return false; break;
        case '$endsWith': if (typeof actual !== 'string' || !actual.endsWith(String(operand))) return false; break;
        default: throw new Error(`Unsupported query operator: ${op}`);
      }
    }
    return true;
  }
  if (Array.isArray(actual) && !Array.isArray(expected)) return actual.some(x => same(x, expected));
  return same(actual, expected);
}
function matches(document, conditions = {}) {
  if (!isPlainObject(conditions)) throw new TypeError('Query conditions must be an object.');
  for (const [key, expected] of Object.entries(conditions)) {
    if (key === '$or') { if (!Array.isArray(expected) || !expected.some(c => matches(document, c))) return false; }
    else if (key === '$and') { if (!Array.isArray(expected) || !expected.every(c => matches(document, c))) return false; }
    else if (!compareValues(getPath(document, key), expected)) return false;
  }
  return true;
}

function validateSchema(document, schema) {
  if (!schema) return;
  const errors = [];
  if (Array.isArray(schema.required)) for (const field of schema.required) if (getPath(document, field) === undefined) errors.push(`${field} is required`);
  const props = schema.properties || schema.fields || {};
  for (const [field, rule] of Object.entries(props)) {
    const value = getPath(document, field); if (value === undefined || !rule) continue;
    const type = rule.type;
    const ok = type === undefined || type === 'any' || (type === 'string' && typeof value === 'string') || (type === 'number' && typeof value === 'number') || (type === 'integer' && Number.isInteger(value)) || (type === 'boolean' && typeof value === 'boolean') || (type === 'object' && isPlainObject(value)) || (type === 'array' && Array.isArray(value)) || (type === 'null' && value === null);
    if (!ok) errors.push(`${field} must be ${type}`);
    if (ok && typeof value === 'string' && rule.minLength != null && value.length < rule.minLength) errors.push(`${field} is shorter than minLength`);
    if (ok && typeof value === 'string' && rule.maxLength != null && value.length > rule.maxLength) errors.push(`${field} is longer than maxLength`);
    if (ok && typeof value === 'number' && rule.min != null && value < rule.min) errors.push(`${field} is below min`);
    if (ok && typeof value === 'number' && rule.max != null && value > rule.max) errors.push(`${field} is above max`);
    if (ok && rule.enum && !rule.enum.some(x => same(x, value))) errors.push(`${field} is not an allowed value`);
  }
  if (errors.length) { const e = new Error(`Schema validation failed: ${errors.join('; ')}`); e.code = 'SCHEMA_VALIDATION'; throw e; }
}

async function ensureDatabase(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try { await fs.access(file); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    const initial = JSON.stringify({ version: FORMAT_VERSION, collections: {}, counters: {}, indexes: {} }) + '\n';
    try { await fs.writeFile(file, initial, { flag: 'wx' }); } catch (x) { if (x.code !== 'EEXIST') throw x; }
  }
}
async function readDatabase(file, fresh = false) {
  await ensureDatabase(file);
  const stat = await fs.stat(file);
  const cached = caches.get(file);
  if (!fresh && cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return clone(cached.data);
  let parsed; try { parsed = JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { throw new Error(`Cannot parse database JSON at ${file}: ${e.message}`); }
  if (!parsed || typeof parsed !== 'object' || !parsed.collections) throw new Error(`Invalid FileDB data in ${file}.`);
  parsed.version ||= FORMAT_VERSION; parsed.counters ||= {}; parsed.indexes ||= {};
  caches.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, data: parsed });
  return clone(parsed);
}
async function writeDatabase(file, data) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  try { await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); await fs.rename(tmp, file); caches.delete(file); }
  catch (e) { await fs.rm(tmp, { force: true }).catch(() => {}); throw e; }
}
async function acquireLock(file, timeout = DEFAULT_LOCK_TIMEOUT, stale = DEFAULT_STALE_LOCK) {
  const lock = `${file}.lock`; const start = Date.now();
  while (true) {
    try { await fs.mkdir(lock); await fs.writeFile(path.join(lock, 'owner'), JSON.stringify({ pid: process.pid, time: Date.now() })); return async () => fs.rm(lock, { recursive: true, force: true }); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { const s = await fs.stat(lock); if (Date.now() - s.mtimeMs > stale) await fs.rm(lock, { recursive: true, force: true }); } catch {}
      if (Date.now() - start >= timeout) { const err = new Error(`FileDB lock timeout for ${file}`); err.code = 'FILEDB_LOCK_TIMEOUT'; throw err; }
      await new Promise(r => setTimeout(r, 25 + Math.floor(Math.random() * 50)));
    }
  }
}
function serializeWrite(file, task) {
  const prev = writeQueues.get(file) || Promise.resolve();
  const current = prev.catch(() => {}).then(task);
  writeQueues.set(file, current);
  return current.finally(() => { if (writeQueues.get(file) === current) writeQueues.delete(file); });
}
async function withLock(file, task, options = {}) {
  return serializeWrite(file, async () => { await ensureDatabase(file); const release = await acquireLock(file, options.lockTimeout, options.staleLock); try { return await task(); } finally { await release(); } });
}
function normalizeSort(spec, direction = 'asc') {
  if (typeof spec === 'string') return [[spec, direction]];
  if (!isPlainObject(spec)) return [];
  return Object.entries(spec);
}
function validateUniqueIndexes(db, collectionName) {
  const definitions = db.indexes?.[collectionName] || {};
  const docs = db.collections?.[collectionName] || [];
  for (const [field, definition] of Object.entries(definitions)) {
    if (!definition.unique) continue;
    const seen = new Map();
    for (const doc of docs) {
      const value = getPath(doc, field);
      if (value === undefined) continue;
      const key = JSON.stringify(value);
      if (seen.has(key) && String(seen.get(key)) !== String(doc.id)) {
        const err = new Error(`Unique index violation for "${field}": duplicate value.`);
        err.code = 'UNIQUE_INDEX_VIOLATION';
        throw err;
      }
      seen.set(key, doc.id);
    }
  }
}

function project(doc, fields) {
  if (!fields) return clone(doc);
  const out = {}; for (const f of fields) { const v = getPath(doc, f); if (v !== undefined) setPath(out, f, v); }
  if (!fields.includes('id') && doc.id !== undefined) out.id = doc.id;
  return out;
}

class Query {
  constructor(collection, conditions = {}) {
    this.collection = collection; this.conditions = conditions; this.sortSpec = [];
    this.limitValue = null; this.skipValue = 0; this.pageValue = null;
    this.perPageValue = null; this.selectFields = null; this.indexHint = null;
  }
  sort(spec, direction = 'asc') { this.sortSpec = normalizeSort(spec, direction).map(([f,d]) => [f, d === -1 || String(d).toLowerCase() === 'desc' ? -1 : 1]); return this; }
  limit(n) { if (!Number.isInteger(n) || n < 0) throw new TypeError('limit() expects a non-negative integer.'); this.limitValue = n; if (this.pageValue !== null) this.perPageValue = n; return this; }
  skip(n) { if (!Number.isInteger(n) || n < 0) throw new TypeError('skip() expects a non-negative integer.'); this.skipValue = n; return this; }
  offset(n) { return this.skip(n); }
  perpage(n) { if (!Number.isInteger(n) || n < 1) throw new TypeError('perpage() expects a positive integer.'); this.perPageValue = n; this.limitValue = n; return this; }
  page(n) { if (!Number.isInteger(n) || n < 1) throw new TypeError('page() expects a positive integer.'); this.pageValue = n; return this; }
  select(fields) { this.selectFields = Array.isArray(fields) ? fields : String(fields).split(/[ ,]+/).filter(Boolean); return this; }
  hint(field) { this.indexHint = field; return this; }
  async _all() {
    let docs = await this.collection._readDocuments();
    docs = docs.filter(d => matches(d, this.conditions));
    if (this.sortSpec.length) docs.sort((a,b) => { for (const [f,dir] of this.sortSpec) { const x=getPath(a,f), y=getPath(b,f); if (same(x,y)) continue; if(x===undefined)return -dir;if(y===undefined)return dir;return x<y?-dir:dir; } return 0; });
    return docs;
  }
  async _execute() {
    let docs = await this._all();
    const skip = this.pageValue !== null
      ? (this.pageValue - 1) * (this.perPageValue ?? this.limitValue ?? this.collection._options.defaultPerPage ?? 12)
      : this.skipValue;
    if (skip) docs = docs.slice(skip);
    const limit = this.pageValue !== null
      ? (this.perPageValue ?? this.limitValue ?? this.collection._options.defaultPerPage ?? 12)
      : this.limitValue;
    if (limit !== null && limit !== undefined) docs = docs.slice(0, limit);
    return docs.map(d => project(d, this.selectFields));
  }
  async get() {
    if (this.pageValue === null) return clone(await this._execute());
    const all = await this._all();
    const page = this.pageValue;
    const par_page = this.perPageValue ?? this.limitValue ?? this.collection._options.defaultPerPage ?? 12;
    const num_records = all.length;
    const num_pages = Math.ceil(num_records / par_page);
    const start = (page - 1) * par_page;
    const result = all.slice(start, start + par_page).map(d => project(d, this.selectFields));
    return clone({
      num_records, page, par_page,
      has_next: page < num_pages,
      has_prev: page > 1 && page <= num_pages + 1,
      next_page: page < num_pages ? page + 1 : null,
      prev_page: page > 1 ? page - 1 : null,
      num_pages,
      position: result.length ? start + 1 : 0,
      data:result
    });
  }
  async first() { return (await this.collection._readDocuments()).filter(d => matches(d, this.conditions)).sort((a,b) => { for (const [f,dir] of this.sortSpec) { const x=getPath(a,f), y=getPath(b,f); if(same(x,y))continue; if(x===undefined)return -dir;if(y===undefined)return dir;return x<y?-dir:dir; } return 0; }).slice(0,1).map(d=>project(d,this.selectFields))[0] || null; }
  async count() { return (await this._all()).length; }
  async exists() { return !!(await this.first()); }
  async *stream(options = {}) { for (const doc of await this._execute()) yield clone(doc); }
  async toArray() { const value = await this.get(); return this.pageValue === null ? value : value.result; }
}

class Collection {
  constructor(file, name, options = {}) { this._file=file; this.name=name; this._options=options; this.schema=options.schema; }
  async _readDocuments() { const db=await readDatabase(this._file); const docs=db.collections[this.name]||[]; if(!Array.isArray(docs)) throw new Error(`Collection "${this.name}" is invalid.`); return docs; }
  _prepareDocument(input, nextId) { const d=clone(input); if(d.id===undefined||d.id===null)d.id=nextId; validateSchema(d,this.schema); return d; }
  async create(input) {
    const many=Array.isArray(input), arr=many?input:[input]; if(!arr.every(isPlainObject))throw new TypeError('create() expects object or array of objects.');
    return withLock(this._file, async()=>{ const db=await readDatabase(this._file,true); db.collections[this.name] ||= []; db.counters[this.name] ||= 0; let next=Math.max(Number(db.counters[this.name])||0,...db.collections[this.name].map(d=>Number(d.id)||0))+1; const now=new Date().toISOString(); const ids=new Set(db.collections[this.name].map(d=>String(d.id))); const created=[]; for(const inputDoc of arr){ const d=this._prepareDocument(inputDoc,next); if(ids.has(String(d.id)))throw new Error(`A document with id "${d.id}" already exists.`); ids.add(String(d.id)); if(typeof d.id==='number'&&d.id>=next)next=d.id+1; d.createdAt ??= now; d.updatedAt ??= now; created.push(d); } db.collections[this.name].push(...created); validateUniqueIndexes(db, this.name); db.counters[this.name]=Math.max(next-1,...db.collections[this.name].map(d=>Number(d.id)||0)); await writeDatabase(this._file,db); return clone(many?created:created[0]); },this._options);
  }
  async findById(id){ if (Array.isArray(id)) { if (!id.length) return []; const docs = await new Query(this, { id: { $in: id } }).get(); const byId = new Map(docs.map(d => [String(d.id), d])); return id.map(value => byId.get(String(value))).filter(Boolean); } return new Query(this,{id}).first(); }
  find(c={}){return new Query(this,c);}
  async findOne(c={}){return new Query(this,c).first();}
  async countDocuments(c={}){return new Query(this,c).count();}
  async update(selector, changes, options={}) {
    if(!isPlainObject(changes))throw new TypeError('update() expects an object.'); const cond=(typeof selector==='number'||typeof selector==='string')?{id:selector}:selector;
    return withLock(this._file,async()=>{const db=await readDatabase(this._file,true);db.collections[this.name] ||= [];const out=[];db.collections[this.name]=db.collections[this.name].map(doc=>{if(!matches(doc,cond))return doc;const next=clone(doc);for(const[k,v]of Object.entries(changes)){if(k.startsWith('$')){if(k==='$set')for(const[a,b]of Object.entries(v))setPath(next,a,b);if(k==='$unset')for(const a of Object.keys(v))unsetPath(next,a);if(k==='$inc')for(const[a,b]of Object.entries(v))setPath(next,a,(getPath(next,a)||0)+b);}else next[k]=v;}next.id=doc.id;next.createdAt=doc.createdAt;next.updatedAt=new Date().toISOString();validateSchema(next,this.schema);out.push(next);return next;});if(out.length){ validateUniqueIndexes(db, this.name); await writeDatabase(this._file,db); }return {matchedCount:out.length,modifiedCount:out.length,documents:clone(options.returnDocuments===false?[]:out)};},this._options);
  }
  async delete(selector){const cond=Array.isArray(selector)?{id:{$in:selector}}:((typeof selector==='number'||typeof selector==='string')?{id:selector}:selector);return withLock(this._file,async()=>{const db=await readDatabase(this._file,true);db.collections[this.name] ||= [];const removed=[];db.collections[this.name]=db.collections[this.name].filter(d=>{if(matches(d,cond)){removed.push(d);return false;}return true;});if(removed.length)await writeDatabase(this._file,db);return{deletedCount:removed.length,documents:clone(removed)};},this._options);}
  remove(s){return this.delete(s);}
  async drop(){return withLock(this._file,async()=>{const db=await readDatabase(this._file,true);const existed=Object.hasOwn(db.collections,this.name);delete db.collections[this.name];delete db.counters[this.name];delete db.indexes[this.name];if(existed)await writeDatabase(this._file,db);return existed;},this._options);}
  async createIndex(field, options={}) { if(typeof field!=='string'||!field)throw new TypeError('createIndex() expects a field.'); const db=await readDatabase(this._file,true);db.indexes[this.name] ||= {};db.indexes[this.name][field]={unique:!!options.unique};validateUniqueIndexes(db,this.name);await writeDatabase(this._file,db);const key=`${this._file}:${this.name}:${field}`;indexes.set(key,new Map((db.collections[this.name]||[]).map(d=>[JSON.stringify(getPath(d,field)),d.id])));return {field,unique:!!options.unique}; }
  async dropIndex(field){const db=await readDatabase(this._file,true);if(db.indexes[this.name])delete db.indexes[this.name][field];await writeDatabase(this._file,db);indexes.delete(`${this._file}:${this.name}:${field}`);return true;}
  async transaction(fn){return Bigdb.transactionFile(this._file,async tx=>fn(tx.collection(this.name)));}
  stream(options={}) { return new Query(this,options.where||{}).stream(options); }
}

class Transaction {
  constructor(file){this.file=file;this._db=null;this._dirty=false;}
  collection(name,options={}){return new TxCollection(this,name,options);}
  async commit(){if(this._dirty)await writeDatabase(this.file,this._db);}
  rollback(){this._dirty=false;}
}
class TxCollection {
  constructor(tx,name,options={}){this.tx=tx;this.name=name;this.options=options;}
  async _ensure(){this.tx._db ||= await readDatabase(this.tx.file,true);this.tx._db.collections[this.name] ||= [];this.tx._db.counters ||= {};}
  async create(input){await this._ensure();const c=new Collection(this.tx.file,this.name,this.options);const arr=Array.isArray(input)?input:[input];let next=Math.max(Number(this.tx._db.counters[this.name])||0,...this.tx._db.collections[this.name].map(d=>Number(d.id)||0))+1;const out=arr.map(x=>{const d=clone(x);if(d.id==null)d.id=next++;d.createdAt??=new Date().toISOString();d.updatedAt??=d.createdAt;validateSchema(d,this.options.schema);return d;});this.tx._db.collections[this.name].push(...out);this.tx._db.counters[this.name]=next-1;this.tx._dirty=true;return clone(Array.isArray(input)?out:out[0]);}
  async find(c={}){await this._ensure();return clone(this.tx._db.collections[this.name].filter(d=>matches(d,c)));}
  async update(selector,changes){await this._ensure();const cond=typeof selector==='number'||typeof selector==='string'?{id:selector}:selector;let n=0;for(const d of this.tx._db.collections[this.name])if(matches(d,cond)){Object.assign(d,clone(changes));d.updatedAt=new Date().toISOString();n++;}this.tx._dirty=true;return{matchedCount:n,modifiedCount:n};}
  async delete(selector){await this._ensure();const cond=typeof selector==='number'||typeof selector==='string'?{id:selector}:selector;const before=this.tx._db.collections[this.name].length;this.tx._db.collections[this.name]=this.tx._db.collections[this.name].filter(d=>!matches(d,cond));const n=before-this.tx._db.collections[this.name].length;this.tx._dirty=true;return{deletedCount:n};}
}

async function transactionFile(file, fn, options={}) { return withLock(file,async()=>{const tx=new Transaction(file);try{const result=await fn(tx);await tx.commit();return result;}catch(e){tx.rollback();throw e;}},options); }

function Bigdb(directory, collectionName, storageModeOrOptions = false, extraOptions = {}) {
  if(typeof collectionName!=='string'||!collectionName.trim()) throw new TypeError('Bigdb(directory, collection): collection must be a non-empty string.');
  let singleFile = false, options = {};
  if (typeof storageModeOrOptions === 'boolean') { singleFile = storageModeOrOptions; options = extraOptions || {}; }
  else if (isPlainObject(storageModeOrOptions)) { options = storageModeOrOptions; singleFile = !!options.singleFile; }
  else throw new TypeError('The third argument must be a boolean or an options object.');
  return new Collection(resolveDatabaseFile(directory, collectionName, singleFile), collectionName.trim(), { ...options, singleFile, directory: path.resolve(process.cwd(), directory) });
}
// Multi-collection transactions use the shared-file layout. Pass true as the third argument to Bigdb for that layout.
Bigdb.transaction = (directory, fn, options={}) => transactionFile(resolveDatabaseFile(directory, undefined, true),fn,options);
Bigdb.transactionFile = transactionFile;
Bigdb.open = Bigdb;

module.exports={Bigdb,Query,Collection,Transaction,matches,getPath};
