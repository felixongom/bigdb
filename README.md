# Bigdb -- Complete Documentation

**Package:** `Bigdb`\
**Documented version:** `1.2.0`\
**Runtime:** Node.js 18+\
**Module formats:** CommonJS and ES modules\
**Storage:** Local JSON files\
**Runtime dependencies:** None intended

Bigdb is an independent JSON-file database library for Node.js. It
provides collections, CRUD operations, query operators, nested-field
queries, sorting, pagination, optional schemas, index metadata,
transactions, write coordination, and asynchronous iteration.

> **Important implementation limitations:** The current JSON-array
> storage architecture reads and parses collection data into memory for
> queries. `stream()` provides asynchronous iteration, but is not
> constant-memory streaming. Index metadata and unique constraints do
> not necessarily mean that query execution uses a fully indexed query
> planner. Transactions and file locks should be tested against the
> exact release and deployment environment. See [Performance and
> limitations](#performance-and-limitations).

## Table of contents

1.  [Features](#features)
2.  [Requirements](#requirements)
3.  [Installation](#installation)
4.  [Imports](#imports)
5.  [Creating databases and
    collections](#creating-databases-and-collections)
6.  [Storage modes](#storage-modes)
7.  [Documents, IDs, and timestamps](#documents-ids-and-timestamps)
8.  [Creating documents](#creating-documents)
9.  [Finding documents](#finding-documents)
10. [Query operators](#query-operators)
11. [Nested queries](#nested-queries)
12. [Query chaining](#query-chaining)
13. [Sorting](#sorting)
14. [Pagination](#pagination)
15. [Selecting fields](#selecting-fields)
16. [Counting and existence checks](#counting-and-existence-checks)
17. [Updating documents](#updating-documents)
18. [Deleting documents](#deleting-documents)
19. [Indexes](#indexes)
20. [Schemas and validation](#schemas-and-validation)
21. [Transactions](#transactions)
22. [Concurrent writes and file
    locking](#concurrent-writes-and-file-locking)
23. [Streaming and async iteration](#streaming-and-async-iteration)
24. [Configuration](#configuration)
25. [API reference](#api-reference)
26. [Return values](#return-values)
27. [Error handling](#error-handling)
28. [Complete examples](#complete-examples)
29. [Testing](#testing)
30. [Publishing to npm](#publishing-to-npm)
31. [Migrating older data](#migrating-older-data)
32. [Performance and limitations](#performance-and-limitations)
33. [Security and operations](#security-and-operations)
34. [Troubleshooting](#troubleshooting)
35. [License](#license)

## Features

The intended Bigdb 1.2.0 API includes:

-   Independent JSON-file persistence; no dependency on `bigdb`.
-   CommonJS and ES module entry points.
-   One file per collection by default, or one shared database file.
-   Single and bulk document creation.
-   Automatic integer `id`, `createdAt`, and `updatedAt` values.
-   Find by one ID or multiple IDs.
-   `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$ne`, `$or`, `$and`, and
    `$regex`.
-   Nested field paths such as `'author.address.city'`.
-   Sorting, limits, `.page()`, `.perpage()`, `.offset()`, and
    `.skip()`.
-   Field selection, count, and existence helpers.
-   `$set`, `$unset`, and `$inc` update operators.
-   Delete by one ID, multiple IDs, or a condition object.
-   Optional schema validation.
-   Index metadata and unique-index checks.
-   Callback-based transactions.
-   Write queues, lock directories, and temporary-file/rename writes.
-   Async iteration through `stream()`.
-   TypeScript declarations.

Verify each behavior against the source and tests of the actual release
before relying on it in a critical application.

## Requirements

-   Node.js 18 or later.
-   Permission to read and write the chosen database directory.
-   No separate database server.

Bigdb stores data on the machine running Node.js. Confirm that the
deployment filesystem is persistent before using it on serverless
platforms, containers, or ephemeral hosting.

## Installation

### From npm

After the package has been published:

``` bash
npm install Bigdb
```

### From a local extracted package

Extract the ZIP and place the package folder in or beside your app:

``` text
my-app/
├── app.js
├── package.json
└── Bigdb/
    ├── package.json
    ├── index.cjs
    ├── index.js
    └── index.d.ts
```

From the application root:

``` bash
npm install ./Bigdb
```

The dependency will resemble:

``` json
{
  "dependencies": {
    "Bigdb": "file:./Bigdb"
  }
}
```

Change the path to match your actual folders.

## Imports

### CommonJS

``` js
const { Bigdb } = require('Bigdb');

const Post = Bigdb('./Database', 'Posts');
```

### ES modules

In a project configured with `"type": "module"`:

``` js
import { Bigdb } from 'Bigdb';

const Post = Bigdb('./Database', 'Posts');
```

A default factory export may also be available:

``` js
import Bigdb from 'Bigdb';

const Post = Bigdb('./Database', 'Posts');
```

The factory is named `Bigdb` to preserve the requested API. The npm
package name is `Bigdb`; Bigdb is intended to work independently of
the `bigdb` package.

## Creating databases and collections

Signature:

``` js
Bigdb(directory, collectionName, storageModeOrOptions?, extraOptions?)
```

  ------------------------------------------------------------------------
  Argument                 Type                    Description
  ------------------------ ----------------------- -----------------------
  `directory`              string                  Database directory;
                                                   relative paths are
                                                   resolved from
                                                   `process.cwd()`.

  `collectionName`         string                  Collection name.

  `storageModeOrOptions`   boolean or object       Storage mode or
                                                   configuration object;
                                                   defaults to `false`.

  `extraOptions`           object                  Configuration when the
                                                   third argument is a
                                                   boolean.
  ------------------------------------------------------------------------

A collection is a named group of documents:

``` js
const User = Bigdb('./Database', 'Users');
const Post = Bigdb('./Database', 'Posts');
const Comment = Bigdb('./Database', 'Comments');
```

File creation may occur when the database is first accessed, not
necessarily when the factory is called.

## Storage modes

Use one storage mode consistently for collections in a database
directory.

### Separate file per collection (default)

``` js
const User = Bigdb('./Database', 'Users');
const Post = Bigdb('./Database', 'Posts');
```

Expected layout:

``` text
my-app/
└── Database/
    ├── Users.json
    └── Posts.json
```

The third argument defaults to `false`. Collection names are sanitized
for filenames; slash, backslash, and NUL characters are replaced with
underscores.

### Shared file for all collections

Pass `true` as the third argument for every collection in the shared
database:

``` js
const User = Bigdb('./Database', 'Users', true);
const Post = Bigdb('./Database', 'Posts', true);
```

Expected layout:

``` text
my-app/
└── Database/
    └── database.js
```

`database.js` contains formatted JSON data, not executable JavaScript.
Do not import or execute it as a JavaScript module. All collections
sharing this file must use the same directory and storage mode.

### Storage mode with options

``` js
const User = Bigdb('./Database', 'Users', true, {
  defaultPerPage: 12,
  lockTimeout: 30000,
  staleLock: 120000
});
```

### Options-object shorthand

``` js
const User = Bigdb('./Database', 'Users', {
  schema: {
    required: ['name']
  }
});
```

To select shared-file mode through the options object:

``` js
const User = Bigdb('./Database', 'Users', {
  singleFile: true,
  schema: {
    required: ['name']
  }
});
```

Do not mix storage modes in a directory and expect automatic migration.

## Documents, IDs, and timestamps

Documents are JavaScript objects. Bigdb is intended to assign an
integer `id` if one is not supplied and to add:

-   `createdAt`: ISO-8601 creation timestamp.
-   `updatedAt`: ISO-8601 update timestamp.

Example shape:

``` json
{
  "title": "My first post",
  "body": "Hello Bigdb",
  "id": 1,
  "createdAt": "2026-10-07T10:00:00.000Z",
  "updatedAt": "2026-10-07T10:00:00.000Z"
}
```

Timestamps are illustrative. The actual values are generated at runtime.
Numeric IDs should be used consistently. Duplicate IDs are intended to
be rejected. Prefer letting Bigdb assign IDs unless your application
has a clear reason to manage them.

## Creating documents

### One document

``` js
const post = await Post.create({
  title: 'Post title 1',
  body: 'I am Post 1'
});
```

Returns the created document.

### Multiple documents

``` js
const posts = await Post.create([
  { title: 'Post title 1', body: 'I am Post 1' },
  { title: 'Post title 2', body: 'I am Post 2' },
  { title: 'Post title 3', body: 'I am Post 3' }
]);
```

Returns an array in input order. Validation or persistence errors reject
the promise.

## Finding documents

### One ID

``` js
const post = await Post.findById(1);

if (post === null) {
  console.log('Post not found');
} else {
  console.log(post.title);
}
```

Returns a document or `null`.

### Multiple IDs

``` js
const posts = await Post.findById([1, 2, 56]);
```

Returns an array in requested ID order. Missing IDs are omitted.

### Query conditions

``` js
const posts = await Post.find({ title: 'Post title 1' }).get();
```

`find()` creates a query builder; `.get()` executes it.

### First matching document

``` js
const user = await User.findOne({ email: 'jane@example.com' });
```

Returns a document or `null`.

### All documents

``` js
const posts = await Post.find({}).get();
```

An empty condition object matches every document.

## Query operators

Conditions on different fields are combined with AND semantics unless a
logical operator is used.

### Equality

``` js
await User.find({ name: 'Jane' }).get();
await User.find({ age: { $eq: 20 } }).get();
```

### `$gt` --- greater than

``` js
await User.find({ age: { $gt: 18 } }).get();
```

### `$gte` --- greater than or equal to

``` js
await User.find({ age: { $gte: 18 } }).get();
```

### `$lt` --- less than

``` js
await User.find({ age: { $lt: 65 } }).get();
```

### `$lte` --- less than or equal to

``` js
await User.find({ age: { $lte: 65 } }).get();
```

### `$ne` --- not equal

``` js
await User.find({ status: { $ne: 'blocked' } }).get();
```

### `$in` --- matches a value in a list

``` js
await User.find({
  role: { $in: ['admin', 'editor'] }
}).get();
```

For array-valued fields, a match may occur if an array element matches
one of the supplied values.

### `$or` --- any condition matches

``` js
await User.find({
  $or: [
    { role: 'admin' },
    { points: { $gte: 100 } }
  ]
}).get();
```

Expects an array of condition objects.

### `$and` --- all conditions match

``` js
await User.find({
  $and: [
    { age: { $gte: 18 } },
    { active: true }
  ]
}).get();
```

Expects an array of condition objects.

### `$regex` --- regular-expression matching

``` js
await User.find({
  name: { $regex: '^Jane' }
}).get();
```

For flags, a JavaScript regular expression can be used:

``` js
await User.find({
  name: { $regex: /^jane/i }
}).get();
```

Regex expressions from untrusted users can be expensive. Validate or
restrict them.

### Additional convenience operators

The intended API may also support `$eq`, `$nin`, `$exists`, `$contains`,
`$startsWith`, and `$endsWith`. Examples:

``` js
await User.find({ role: { $nin: ['blocked', 'banned'] } }).get();
await User.find({ phone: { $exists: true } }).get();
await Post.find({ title: { $contains: 'Node.js' } }).get();
await User.find({ username: { $startsWith: 'felix' } }).get();
await User.find({ email: { $endsWith: '@example.com' } }).get();
```

Confirm less-common operators against the installed release's source and
tests before depending on them.

### Combining operators

Multiple operators on one field are combined:

``` js
await User.find({
  age: { $gte: 18, $lt: 30 }
}).get();
```

Conditions on different fields are also combined:

``` js
await User.find({
  active: true,
  age: { $gte: 18 }
}).get();
```

Logical operators can be combined with ordinary conditions:

``` js
await User.find({
  active: true,
  $or: [
    { role: 'admin' },
    { points: { $gte: 100 } }
  ]
}).get();
```

## Nested queries

Use dot notation to query nested objects:

``` js
await User.create({
  name: 'Jane Doe',
  profile: {
    age: 25,
    address: {
      city: 'Gulu',
      country: 'Uganda'
    }
  }
});

const users = await User.find({
  'profile.address.city': 'Gulu',
  'profile.age': { $gte: 18 }
}).get();
```

Nested paths are also intended for sorting, projection, indexing, and
update operators.

## Query chaining

``` js
const results = await Post
  .find({ published: true })
  .sort({ createdAt: 'desc' })
  .skip(10)
  .limit(10)
  .get();
```

Modifiers such as `.sort()`, `.limit()`, `.skip()`, `.offset()`,
`.page()`, `.perpage()`, `.select()`, and `.hint()` are intended to
return the query object for chaining.

Terminal methods include `.get()`, `.first()`, `.count()`, `.exists()`,
`.toArray()`, and `.stream()`.

## Sorting

### One field

``` js
const posts = await Post.find({}).sort('createdAt', 'desc').get();
```

### Multiple fields

``` js
const posts = await Post.find({}).sort({
  status: 'asc',
  createdAt: 'desc',
  title: 'asc'
}).get();
```

Directions: `'asc'`, `'desc'`, `1`, or `-1`.

### Nested field

``` js
const users = await User.find({})
  .sort({ 'profile.address.city': 'asc' })
  .get();
```

For predictable pagination, sort on consistent values and add a unique
tie-breaker such as `id` when necessary.

## Pagination

### Offset pagination: `.skip()` and `.offset()`

These methods are aliases:

``` js
const posts = await Post.find({})
  .sort({ id: 'asc' })
  .skip(20)
  .limit(10)
  .get();
```

Equivalent:

``` js
const posts = await Post.find({})
  .sort({ id: 'asc' })
  .offset(20)
  .limit(10)
  .get();
```

Without `.page()`, `.get()` returns an array.

### Page-based pagination: `.page()` and `.perpage()`

``` js
const pageResult = await Post.find({})
  .sort({ id: 'asc' })
  .page(1)
  .perpage(12)
  .get();
```

When `.page()` is used, `.get()` returns an object:

``` js
{
  num_records: 17,
  page: 1,
  par_page: 12,
  has_next: true,
  has_prev: false,
  next_page: 2,
  prev_page: null,
  num_pages: 2,
  position: 1,
  data: [
    {
      title: 'Post 1',
      id: 1,
      createdAt: '2024-01-08T10:26:27.158Z',
      updatedAt: '2024-01-08T10:26:27.158Z'
    }
    // Up to 11 more records
  ]
}
```

The document values are examples, not actual stored data.

  --------------------------------------------------------------------------
  Property                            Meaning
  ----------------------------------- --------------------------------------
  `num_records`                       Total documents matching the filter
                                      before pagination.

  `page`                              Current page number, starting at 1.

  `par_page`                          Number of documents per page. This key
                                      is intentionally spelled `par_page`.

  `has_next`                          Whether another page exists.

  `has_prev`                          Whether a previous page exists.

  `next_page`                         Next page number, or `null`.

  `prev_page`                         Previous page number, or `null` on the
                                      first page.

  `num_pages`                         Total pages, usually
                                      `Math.ceil(num_records / par_page)`.

  `position`                          One-based position of the first
                                      document in the filtered/sorted result
                                      set; an empty page should use `0`.

  `data`                            Array of documents for this page.
  --------------------------------------------------------------------------

Page size:

``` js
await Post.find({}).page(3).perpage(25).get();
```

The default page size is `defaultPerPage`, normally `12`. `.page()` and
`.perpage()` should receive positive integers. `.limit()` may also set
the page size when page-based pagination is active:

``` js
await Post.find({}).page(2).limit(12).get();
```

Return types differ:

``` js
const rows = await Post.find({}).limit(10).get(); // Array
const page = await Post.find({}).page(1).perpage(10).get(); // Object
console.log(page.data);
```

## Selecting fields

``` js
const users = await User.find({})
  .select(['name', 'profile.address.city'])
  .get();
```

A string form may be supported:

``` js
const users = await User.find({}).select('name email').get();
```

Nested paths are intended to be projected as nested objects. Confirm
exact projection behavior in the installed release; do not assume
exclusion projection is supported.

## Counting and existence checks

Count query matches:

``` js
const count = await Post.find({ published: true }).count();
```

Check whether a match exists:

``` js
const exists = await Post.find({ slug: 'hello-world' }).exists();
```

Count from the collection:

``` js
const count = await Post.countDocuments({ published: true });
```

## Updating documents

### Update by ID

``` js
const result = await Post.update(1, {
  title: 'Updated title'
});
```

### Update all matching documents

``` js
const result = await Post.update(
  { published: false },
  { published: true }
);
```

An update result is intended to resemble:

``` js
{
  matchedCount: 1,
  modifiedCount: 1,
  documents: [
    {
      id: 1,
      title: 'Updated title',
      createdAt: '...',
      updatedAt: '...'
    }
  ]
}
```

Where supported, pass `{ returnDocuments: false }` as the third argument
to omit returned documents:

``` js
await Post.update(
  { published: false },
  { published: true },
  { returnDocuments: false }
);
```

### `$set`

``` js
await Post.update(1, {
  $set: {
    title: 'A new title',
    'author.name': 'Jane'
  }
});
```

### `$inc`

``` js
await Post.update(1, {
  $inc: {
    views: 1,
    'stats.shares': 1
  }
});
```

Use numeric values and validate resulting data.

### `$unset`

``` js
await Post.update(1, {
  $unset: {
    temporaryField: true,
    'author.middleName': true
  }
});
```

### Combine update operators

``` js
await Post.update(1, {
  $set: { published: true },
  $inc: { views: 1 },
  $unset: { draftNote: true }
});
```

The intended behavior is to preserve `id` and `createdAt` while
refreshing `updatedAt`. Test schema and unique-index validation for
update paths used by your application. Prefer `$set` with dot notation
for nested updates; plain keys are generally top-level assignments.

## Deleting documents

### One ID

``` js
const result = await Post.delete(2);
```

### Multiple IDs

``` js
const result = await Post.delete([2, 4, 5]);
```

### Conditions

``` js
const result = await Post.delete({ published: false });
```

The result is intended to resemble:

``` js
{
  deletedCount: 2,
  documents: [
    // deleted documents
  ]
}
```

`remove()` is an alias:

``` js
await Post.remove(2);
```

### Drop a collection

``` js
const dropped = await Post.drop();
```

This is destructive. Back up data first and verify the installed
release's exact metadata-removal behavior.

## Indexes

### Create an index

``` js
await User.createIndex('email');
```

### Unique index

``` js
await User.createIndex('email', { unique: true });
```

A unique index is intended to reject inserts or updates that duplicate
an indexed value. Nested paths are supported by the API design:

``` js
await User.createIndex('profile.accountNumber', { unique: true });
```

### Drop an index

``` js
await User.dropIndex('email');
```

### Query hint

``` js
const users = await User.find({ email: 'jane@example.com' })
  .hint('email')
  .get();
```

**Important:** index metadata and unique-value checks are not the same
as a full indexed query engine. Do not assume `.hint()` accelerates
reads unless the installed implementation explicitly uses it. Unique
checks may scan documents.

## Schemas and validation

Schemas are optional. Without a schema, Bigdb does not enforce
application field types or required fields.

### Define a schema

``` js
const User = Bigdb('./Database', 'Users', {
  schema: {
    required: ['name', 'age'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 80 },
      age: { type: 'integer', min: 0, max: 120 },
      email: { type: 'string' },
      role: { type: 'string', enum: ['admin', 'editor', 'reader'] },
      profile: { type: 'object' },
      tags: { type: 'array' },
      active: { type: 'boolean' }
    }
  }
});
```

The implementation may accept `fields` as an alias for `properties`.

  Rule                        Meaning
  --------------------------- ---------------------------------------------
  `required`                  Array of required field names or dot paths.
  `properties` / `fields`     Field-specific validation rules.
  `type: 'string'`            Requires a string.
  `type: 'number'`            Requires a number.
  `type: 'integer'`           Requires an integer.
  `type: 'boolean'`           Requires a boolean.
  `type: 'object'`            Requires a plain object.
  `type: 'array'`             Requires an array.
  `type: 'null'`              Requires `null`.
  `type: 'any'`               Accepts any value.
  `min` / `max`               Numeric bounds.
  `minLength` / `maxLength`   String-length bounds.
  `enum`                      Restricts a field to listed values.

Nested required fields can use dot notation:

``` js
const User = Bigdb('./Database', 'Users', {
  schema: {
    required: ['name', 'profile.address.city'],
    properties: {
      name: { type: 'string' },
      'profile.address.city': { type: 'string' }
    }
  }
});
```

Handle validation errors:

``` js
try {
  await User.create({ age: 'twenty' });
} catch (error) {
  if (error.code === 'SCHEMA_VALIDATION') {
    console.error('Invalid document:', error.message);
  } else {
    throw error;
  }
}
```

This is a lightweight validator, not necessarily a full JSON Schema
implementation. Do not assume rules such as `pattern`, `format`, nested
`items`, or automatic coercion are supported unless the installed source
and tests confirm them.

## Transactions

### Single-collection transaction

``` js
await Post.transaction(async Posts => {
  await Posts.create({ title: 'First post' });
  await Posts.update(1, { title: 'Updated post' });
});
```

The transaction helper may expose fewer methods than a normal
collection; check the release source for its supported callback API.

### Multi-collection transaction

Use shared-file mode consistently:

``` js
const User = Bigdb('./Database', 'Users', true);
const Post = Bigdb('./Database', 'Posts', true);

await Bigdb.transaction('./Database', async tx => {
  const Users = tx.collection('Users');
  const Posts = tx.collection('Posts');

  const [user] = await Users.create([{ name: 'Jane' }]);

  await Posts.create({
    title: 'Jane’s first post',
    userId: user.id
  });
});
```

All participating collections must use the same directory and
shared-file storage. Keep transactions short and avoid unrelated network
calls inside them.

Transactions are not equivalent to a mature write-ahead log,
crash-recovery system, or distributed transaction protocol. Test
rollback, schema rules, and unique constraints with the exact version
you deploy.

## Concurrent writes and file locking

The design uses a per-file write queue, a lock directory, and
temporary-file/rename writes to reduce lost writes and partial-file
risks.

Configure locking:

``` js
const Post = Bigdb('./Database', 'Posts', false, {
  lockTimeout: 30000,
  staleLock: 120000
});
```

  ------------------------------------------------------------------------
  Option                                     Default Meaning
  --------------------- ---------------------------- ---------------------
  `lockTimeout`                           `30000` ms Maximum wait for a
                                                     lock before timing
                                                     out.

  `staleLock`                            `120000` ms Age after which a
                                                     lock may be treated
                                                     as stale.

  `defaultPerPage`                              `12` Default page size.

  `schema`                                      none Optional schema
                                                     rules.

  `singleFile`                               `false` Shared-file mode in
                                                     options-object
                                                     syntax.
  ------------------------------------------------------------------------

A lock timeout is not necessarily retried automatically. Lock behavior
depends on the filesystem. Test multi-process behavior on the actual
deployment, particularly with network filesystems, containers, or
multiple hosts. Age-based stale-lock cleanup is not a distributed
locking service.

## Streaming and async iteration

### Collection iteration

``` js
for await (const post of Post.stream()) {
  console.log(post);
}
```

### Filtered query iteration

``` js
for await (const post of Post.find({ published: true }).stream()) {
  console.log(post.title);
}
```

### Sorted and limited iteration

``` js
for await (const post of Post
  .find({ published: true })
  .sort({ id: 'asc' })
  .limit(100)
  .stream()) {
  console.log(post);
}
```

The async iterator yields documents one at a time to caller code. **The
current JSON-array engine still reads and parses the whole collection
before yielding records**, so this is not constant-memory streaming.
True large-dataset streaming would require an incremental format such as
NDJSON or segmented files.

## Configuration

Options can be supplied as the third argument or as the fourth argument
after a boolean storage mode:

``` js
const Post = Bigdb('./Database', 'Posts', false, {
  schema: { required: ['title'] },
  lockTimeout: 30000,
  staleLock: 120000,
  defaultPerPage: 25
});
```

  ------------------------------------------------------------------------
  Option             Type              Default           Description
  ------------------ ----------------- ----------------- -----------------
  `schema`           object            none              Document
                                                         validation rules.

  `lockTimeout`      number            `30000`           Lock wait timeout
                                                         in milliseconds.

  `staleLock`        number            `120000`          Age at which a
                                                         lock may be
                                                         considered stale.

  `defaultPerPage`   number            `12`              Default page
                                                         size.

  `singleFile`       boolean           `false`           Shared-file mode
                                                         when using the
                                                         options-object
                                                         form.
  ------------------------------------------------------------------------

## API reference

### Factory

`Bigdb(directory, collectionName, storageModeOrOptions?, extraOptions?)`

-   Third argument omitted or `false`: one JSON file per collection.
-   Third argument `true`: shared `database.js` file.
-   Third argument object: configuration; `singleFile: true` selects
    shared-file mode.
-   Fourth argument: configuration when the third argument is boolean.

The package may expose `Bigdb.open` as an alias and advanced exports
such as `Query`, `Collection`, `Transaction`, `matches`, and `getPath`.
Confirm exact exports in the installed `index.js`, `index.cjs`, and
`index.d.ts`.

`Bigdb.transaction(directory, callback, options?)` starts a shared-file
multi-collection transaction.

### Collection methods

  -----------------------------------------------------------------------------------------------
  Method                                    Intended return               Description
  ----------------------------------------- ----------------------------- -----------------------
  `create(document)`                        `Promise<Document>`           Insert one document.

  `create(documents[])`                     `Promise<Document[]>`         Insert multiple
                                                                          documents.

  `findById(id)`                            `Promise<Document \| null>`   Find one ID.

  `findById(ids[])`                         `Promise<Document[]>`         Find multiple IDs in
                                                                          requested order;
                                                                          missing IDs omitted.

  `find(conditions?)`                       Query builder                 Start a query.

  `findOne(conditions?)`                    `Promise<Document \| null>`   First match.

  `countDocuments(conditions?)`             `Promise<number>`             Count matching
                                                                          documents.

  `update(id, changes, options?)`           `Promise<UpdateResult>`       Update by ID.

  `update(conditions, changes, options?)`   `Promise<UpdateResult>`       Update matching
                                                                          documents.

  `delete(id)`                              `Promise<DeleteResult>`       Delete one ID.

  `delete(ids[])`                           `Promise<DeleteResult>`       Delete multiple IDs.

  `delete(conditions)`                      `Promise<DeleteResult>`       Delete matching
                                                                          documents.

  `remove(selector)`                        `Promise<DeleteResult>`       Alias for `delete()`.

  `drop()`                                  `Promise<boolean>`            Drop a collection.

  `createIndex(field, options?)`            Promise                       Register index metadata
                                                                          and optionally enforce
                                                                          uniqueness.

  `dropIndex(field)`                        `Promise<boolean>`            Drop index metadata.

  `transaction(callback)`                   Promise                       Run a transaction.

  `stream(options?)`                        Async iterable                Iterate collection
                                                                          documents.
  -----------------------------------------------------------------------------------------------

### Query-builder methods

  Method                         Description
  ------------------------------ ------------------------------------------------
  `sort(field, direction?)`      Sort by one field.
  `sort({ field: direction })`   Sort by multiple fields.
  `limit(n)`                     Limit result count.
  `skip(n)`                      Skip records.
  `offset(n)`                    Alias for `skip(n)`.
  `page(n)`                      Enable page-based pagination.
  `perpage(n)`                   Set page size.
  `select(fields)`               Select fields to return.
  `hint(field)`                  Set an index hint; may not accelerate queries.
  `get()`                        Execute; array unless `.page()` was called.
  `first()`                      First matching document or `null`.
  `count()`                      Count matches.
  `exists()`                     Boolean indicating whether a match exists.
  `toArray()`                    Return results as an array.
  `stream()`                     Async iterable of results.

## Return values

### Create

A single `create()` returns a document. Bulk `create()` returns an
array.

### Update

Intended shape:

``` js
{
  matchedCount: 1,
  modifiedCount: 1,
  documents: [/* updated documents */]
}
```

### Delete

Intended shape:

``` js
{
  deletedCount: 2,
  documents: [/* deleted documents */]
}
```

### Page

``` js
{
  num_records: 17,
  page: 1,
  par_page: 12,
  has_next: true,
  has_prev: false,
  next_page: 2,
  prev_page: null,
  num_pages: 2,
  position: 1,
  data: [/* documents */]
}
```

## Error handling

Use `try/catch` around awaited database operations:

``` js
try {
  const post = await Post.create({ title: 'Hello Bigdb' });
  console.log(post);
} catch (error) {
  switch (error.code) {
    case 'SCHEMA_VALIDATION':
      console.error('Schema validation failed:', error.message);
      break;
    case 'UNIQUE_INDEX_VIOLATION':
      console.error('A unique value already exists:', error.message);
      break;
    case 'Bigdb_LOCK_TIMEOUT':
      console.error('Could not acquire the database lock:', error.message);
      break;
    default:
      console.error('Bigdb operation failed:', error);
  }
}
```

Commonly referenced error codes:

  Code                       Meaning
  -------------------------- --------------------------------------------
  `SCHEMA_VALIDATION`        Document violates a configured schema.
  `UNIQUE_INDEX_VIOLATION`   Write violates a unique index.
  `Bigdb_LOCK_TIMEOUT`      Lock could not be acquired before timeout.

Invalid arguments may throw `TypeError`; unsupported query operators may
throw ordinary errors. Prefer `error.code` where available instead of
depending on message text.

## Complete examples

### Posts collection

``` js
const { Bigdb } = require('Bigdb');

const Post = Bigdb('./Database', 'Posts', {
  schema: {
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1 },
      body: { type: 'string' },
      views: { type: 'integer', min: 0 }
    }
  }
});

async function main() {
  const first = await Post.create({
    title: 'Getting started with Bigdb',
    body: 'A short introduction',
    views: 0,
    author: { name: 'Jane', age: 25 },
    published: true
  });

  await Post.create([
    { title: 'Query operators', body: 'Filtering data', views: 12, published: true },
    { title: 'Draft article', body: 'Not published yet', views: 2, published: false }
  ]);

  const byId = await Post.findById(first.id);

  const popular = await Post.find({
    published: true,
    views: { $gte: 10 }
  }).sort({ views: 'desc' }).get();

  const page = await Post.find({})
    .sort({ id: 'asc' })
    .page(1)
    .perpage(10)
    .get();

  await Post.update(first.id, {
    $inc: { views: 1 },
    $set: { 'author.name': 'Jane Doe' }
  });

  const deleted = await Post.delete([2, 3]);

  console.log({ byId, popular, page, deleted });
}

main().catch(console.error);
```

### Users with unique email addresses

``` js
const { Bigdb } = require('Bigdb');

const User = Bigdb('./Database', 'Users', {
  schema: {
    required: ['name', 'email'],
    properties: {
      name: { type: 'string', minLength: 2 },
      email: { type: 'string' },
      age: { type: 'integer', min: 0 }
    }
  }
});

async function main() {
  await User.createIndex('email', { unique: true });

  await User.create({
    name: 'Jane Doe',
    email: 'jane@example.com',
    age: 25
  });

  const users = await User.find({
    age: { $gte: 18 },
    email: { $endsWith: '@example.com' }
  }).sort({ name: 'asc' }).get();

  console.log(users);
}

main().catch(console.error);
```

### Shared-file transaction

``` js
const { Bigdb } = require('Bigdb');

const User = Bigdb('./Database', 'Users', true);
const Post = Bigdb('./Database', 'Posts', true);

async function createUserAndPost() {
  await Bigdb.transaction('./Database', async tx => {
    const Users = tx.collection('Users');
    const Posts = tx.collection('Posts');

    const [user] = await Users.create([{ name: 'Jane Doe' }]);

    await Posts.create({
      title: 'My first post',
      userId: user.id
    });
  });
}

createUserAndPost().catch(console.error);
```

## Testing

From the extracted package directory:

``` bash
npm install
npm test
```

Use the scripts listed in the actual `package.json`; script names may
vary between releases. Run tests before publishing changes or upgrading
production data.

## Publishing to npm

Before publishing, check package name availability, version, package
contents, license, README, and tests.

``` bash
npm login
npm test
npm pack --dry-run
npm publish
```

If the package name is taken, npm rejects publication. Increment
`version` in `package.json` for each new release; an already-published
version cannot be overwritten.

## Migrating older data

Older development builds may use a shared `database.json`. The
documented 1.2.0 layout uses separate `<Collection>.json` files by
default or `database.js` for shared-file mode.

1.  Stop all processes that write to the database.
2.  Back up the complete database directory.
3.  Identify the old storage format and the latest data file.
4.  Do not switch storage modes expecting automatic migration.
5.  Write a migration script to read old records and insert them into
    the new layout.
6.  Verify record counts, IDs, timestamps, counters, nested values, and
    unique fields.
7.  Keep the original backup until the application has been tested
    against the migrated data.

This documentation does not assume an automatic migration command
exists.

## Performance and limitations

-   Queries read and parse JSON collection data into memory.
-   Most filters are evaluated in memory.
-   Index metadata and unique checks do not guarantee indexed query
    acceleration.
-   `.hint()` should not be assumed to speed up a query unless the
    implementation uses it.
-   `stream()` currently iterates after loading the collection; it is
    not constant-memory streaming.
-   Pretty JSON is easier to inspect but larger than compact JSON.
-   Transactions are not equivalent to a mature write-ahead log or
    crash-recovery system.
-   Lock correctness depends on filesystem semantics and should be
    stress-tested.
-   Large JSON files can become slow and memory-intensive.

For very large datasets, high write throughput, multi-host deployments,
or complex query workloads, use a database designed for those needs or
redesign storage around an incremental format such as NDJSON or
segmented files.

## Security and operations

-   Keep database files outside public static directories.
-   Restrict filesystem permissions on database and lock files.
-   Do not pass arbitrary client-supplied query objects directly to
    Bigdb; whitelist fields and operators.
-   Validate user input and implement authorization in the application.
-   Treat user-supplied regular expressions carefully.
-   Back up files and test restoration.
-   Do not edit database files manually while the app is running.
-   Test simultaneous create/update/delete operations in the real
    deployment environment.
-   Keep collections in a database directory on a consistent storage
    mode.
-   Local files are not replicated automatically between servers or
    containers.
-   Passing unit tests does not prove crash safety or production
    readiness.

## Troubleshooting

### `Cannot find module 'Bigdb'`

Install from npm:

``` bash
npm install Bigdb
```

Or install your local package:

``` bash
npm install ./Bigdb
```

Restart the Node.js process after installation.

### CommonJS or ESM import errors

Use `require()` in CommonJS projects and `import` in ES module projects.
Check the package's `exports` field if Node.js cannot resolve an entry
point.

### Database files are in an unexpected directory

Relative paths are resolved from `process.cwd()`, which may differ from
the source file directory. Log `process.cwd()` or pass an absolute path.

### `.get()` returns an object instead of an array

This is expected when `.page()` is used:

``` js
const page = await Post.find({}).page(1).perpage(12).get();
console.log(page.data);
```

Without `.page()`, `.get()` returns an array.

### Duplicate key error

Check whether a unique index is configured and whether another document
already uses the value.

### Lock timeout

Check whether another process holds the lock, whether a process crashed,
and whether the filesystem supports the required lock-directory and
rename behavior. Do not remove locks blindly while another writer may be
active.

### Records appear missing after a storage-mode change

Bigdb does not automatically migrate between older shared JSON storage,
separate collection files, and shared `database.js`. Restore a backup or
run a verified migration script.

## License

The project is described as MIT-licensed. Include the actual `LICENSE`
file in the npm package and ensure it matches the license field in
`package.json`.
