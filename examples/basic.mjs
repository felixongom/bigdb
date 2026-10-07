import { Bigdb } from '../index.js';

const Post = Bigdb('./data/Database', 'Posts');

const post = await Post.create({
  title: 'Post title 1',
  body: 'I am Post 1'
});

const morePosts = await Post.create([
  { title: 'Post title 2', body: 'I am Post 2' },
  { title: 'Post title 3', body: 'I am Post 3' }
]);

const found = await Post.findById(post.id);
const results = await Post.find({ title: { $contains: 'Post title' } })
  .sort({ id: 'desc' })
  .limit(10)
  .get();

console.log({ post, morePosts, found, results });
