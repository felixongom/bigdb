## Bigdb.

Bigdb is a javascript backend library for persisting data in a json file as a database.
It store it's data locally on the server just like sqlite would do, but instead it store its data in a json file.
Bigdb METHODS are similar to that of mongoose (mongodb) and can perform both read and write operation.
It can help alot when building a small application, but for larger project, i would advise going for sql databases or mongodb

##### Usage.
Install with npm i bigdb
```js
conts {Bigdb} = require('bigdb)
```
To create new document, for example Post, cal the method Bigdb() 
- Your first parameter is the path where you database will leave, can be null as well 
- Second paramter is the name of the collection and
- Optionally you can pass true or false (boolean) to the third parameter of the constructor.This spacifies wheather you want to keep your collection in one file or ecach file for each collection.

    true - each file for each collection. 
    false - one file called database.json. 

Call  Bigdb and pass nessecary parameter.
```js
const Posts = Bigdb(null, 'Posts') 
//will create Db/database.json at the root of your app

//OR

const Post =  Bigdb('Database', 'Posts') 
//will create Database/database.json at the root of your app

//OR

const Post =  Bigdb(null, 'Posts' true)
//will create Db/Posts.json at the root of your app

//OR

const Post = await Bigdb('/Database/folder', 'Posts') 
//will create /Database/folder/Post.json at the root of you app


let result = await Post.create({title:'Post title 1',body:'i am Post 1'}) //single
let result = await Post.create([{title:'Post title 1',body:'i am Post 1'}, <...>]) //bulk
//this creates new documens in the database
```

The above code will create a corresponding path at the root of your app if it does not exist,
    - "Posts" is the name of the collection, if we had passed users it would create a users collection  in the database 

 Then it will return something like this;
```js
{
  id: 1,
  title:'Post title 1',
  body:'i am Post 1',
  createdAt: '2024-01-08T09:39:09.976Z',
  updatedAt: '2024-01-08T09:39:09.976Z'
}

```
**Its that simple**

It auto asign createdAt, updatedAt and id to it as it saves to database.
The id  is an autoincreamenting id.

***As i told you earlier that the methods are similar to mongodb methods***, All queries are case insensitive, uppercase letter are the same as lowercase letter ('dog' === 'doG' === 'DOG'). 

We also have many more methods like;

##### **.findById(id)**
```js
await Post.findById(1)
```
It returns the document with id 1 from Posts collection.

##### **.findOne()**
```js
await Post.findOne({name:{$has:'john'}})
```
It returns the first document that matches the query

##### **.find()**
This takes in two optonal parameter,
- First paramerter is the query
- Second parameter is attribute you don't want to appear in the result 
Every query that has .find() ends with .get() .eg
```js
await Post.find().get()
await Post.find({name:'jane doe', age:20}).get()
await Users.find({name:'jane doe', age:20}, {password:false, salary:false}).get()
```
It returns an array of all the documents that matches the query from the collection.
```js
[
    {
        id: 1,
        title:'Post title1',
        body:'i am Post 1',
        createdAt: '2024-01-08T09:39:09.976Z',
        updatedAt: '2024-01-08T09:39:09.976Z'
    },
    {
        id: 2,
        title:'Post title2',
        body:'i am Post 2',
        createdAt: '2024-01-08T09:39:09.976Z',
        updatedAt: '2024-01-08T09:39:09.976Z'
    },
]
```
Also you can request for  particular kind of data like
```js
await Post.find({views:2}).get()
await Post.find({views:2, title:{$has:'Post'}}).get()
```
We also have the **.sort()**,  **.skip()** and **.limit()**
```js
await Post.find().sort({id:1}).get() 
//1 for ascending  and -1 for for descending
await Post.find().skip(2).get() 
//skips the first two match

await Post.find().limit(5).get() 
//it retuns 5 documents

await Post.find().sort({id:-1}).limit(5).skip(2).get() 
/*it retuns 5 documents sorted in 
descending order basing on id 
*/
```
**The .sort(), .limit() and .skip() have ***no orders*** in which they are called** like in mongodb.

```js
await Post.find().sort({id:-1}).limit(5).get() 
await Post.find().limit(5).sort({id:-1}).get() 
await Post.find().limit(5)skip(3).get() 
//the result for the above are the same
```

##### **.update()**

```js
await Post.update(2, {title:'updated title'})
/*update the title of document with id 2 
to 'updated title' and returns the updated document
*/
```

##### **.findOneAndUpdate()**

```js
await Post.findOneAndUpdate({views:10}, {title:'updated title'})
/*update the title of the first match
 to 'updated title'.
*/
```

##### **.findAndUpdate()**

```js
await Post.findAndUpdate({views:10}, {title:'updated title'})
/*update the title of all the matches to 'updated title'
*/
```

***Update has criteria like;***
**$inc**
```js
await Post.update(3, {$inc:{views:1}})
//
await Post.findAndUpdate({views:2}, {$inc:{views:5}})
/* inceasing views  by spacified value
*/
```
**$mul**
```js
await Post.update(3, {$mul:{views:1}})
//
await Post.findAndUpdate({views:2}, {$mul:{views:5}})
/* multiplies views by spacified value.
*/
```

**$push**
```js
await Product.update(3, {$push:{price:100, <...>}})
//
await Post.findAndUpdate({id:{$gte:10}}, {$push:{views:5, <...>}})
/* adding new value to an array attribute the matches 
spacified criteria
*/
```

**$pull**
```js
await Product.update(3, {$pull:{price:100}})
//
/* remove the first occurence of 100 frrom price array
*/
```

**$pullAll**
```js
await Product.update(3, {$pullAll:{price:100}})
//
await Post.findAndUpdate({id:{$gte:10}}, {$pullAll:{price:[100, 250]}})
/* remove all the prices sprcified from the price array for
elements that spacified criteria
*/
```


##### **.delete()**

```js
await Post.delete(2)
// deletes document with id 2

await Post.delete([2, 4, 5])
// deletes document with ids of 2 ,4 ,5

```

##### **.findOneAndDelete()**

```js
await Post.findOneAndDelete({title:{$has:'updated'}})
/*
deletes first match of the query
*/
```

##### **.findAndDelete()**

```js
await Post.findAndDelete({title:{$has:'updated'}})
/*
deletes all the matches of the query
*/
```

##### **.last()**

```js
await Post.last() 
//
await Post.last({title:{$search:'updated'}})
/*
both returns the last match of the query
*/
```

##### **.countDocuments()**

```js
await Post.countDocuments() //1000
//
await Post.countDocuments({title:{$search:'updated'}}) //25
/*
counts the number of documents that matches the query
*/
```

##### **.paginate()**
This takes in two optonal parameter,
- First paramerter is the query.
- Second parameter is attribute you don't want to appear in the result.

This method has .get() at the end. This returns the data together with some metedata, call the get at the end
```js
await Post.paginate().get()
await Post.paginate({}).get()
//defaults to page 1 and count of 12

await Post.paginate().page(2).get() 
//returns page 2 and count of 12

await Post.paginate().page(2).count(5).get()
//returns page 2 and count of 5 

await Post.paginate({age:10}, {title:false}).page(2).count(5).get()
//returns page 2 and count of 5 

```
The result look like this.
```js
{
  page: 1,
  par_page: 12,
  has_next: false,
  has_prev: false,
  next_page: 2,
  prev_page: null,
  num_pages: 1,
  result: [
    {
      Post: "Post1",
      id: 1,
      createdAt: "2024-01-08T10:26:27.158Z",
      updatedAt: "2024-01-08T10:26:27.158Z"
    },
    {
      Post: "Post2",
      id: 2,
      createdAt: "2024-01-08T10:26:28.629Z",
      updatedAt: "2024-01-08T10:26:28.629Z"
    }
  ] 
}
```

**Some of the different ways of filtering or querying for specific kind of data are;**

***$lt***
```js
await people.find({age:{$lt:18}}).get()
//returns people whose age is less than 18
```

***$lte***
```js
await people.find({age:{$lte:18}}).get()
//returns people whose age is less than or equal to 18
```

***$gt***
```js
await people.find({age:{$gt:18}}).get()
//returns people whose age is greater than to 18
```
***$gte***
```js
await people.find({age:{$gte:18}}).get()
//returns people whose age is greater than or equal to 18
```

***$eq***
```js
await pawait eople.find({age:{$eq:18}}).get()
//returns people whose age is equal to 18
```

***$neq***
```js
await people.find({age:{$neq:18}}).get()
//returns people whose age is not equal to 18
```
***$bt***
```js
await people.find({age:{$bt:[5,10]}}).get()
//returns people whose age is between 5 and 10
```
***$nbt***
```js
await people.find({age:{$nbt:[5, 10]}}).get()
//returns people whose age is not between 5 and 10
```

***$has***
```js
await people.find({country:{$has:'ug'}}).get()
//people whose country has ug in their name
```

***$hasNo***
```js
await people.find({country:{$hasNo:'ug'}}).get()
//people whose country has no ug in their name
```

***$sw***
```js
await food.find({name:{$sw:'ap'}}).get()
//foods whose name starts with ap 
```

***$ew***
```js
await food.find({name:{$ew:'ilk'}}).get()
//foods whose name end with ilk
```

***$nsw***
```js
await food.find({name:{$nsw:'ap'}}).get()
//foods whose name is not starting with ap 
```

***$new***
```js
await food.find({name:{$ew:'ilk'}}).get()
//foods whose name is not ending with ilk
```

***$in***
```js
await food.find({prices:{$in:5}}).get()
//for array fields
//foods whose prices list has 5
```

***$nin***
```js
await food.find({prices:{$nin:5}}).get()
//for array fields
//foods whose prices list has no 5
```
***$all***
```js
await food.find({prices:{$all:[5, 10]}}).get()
//for array fields
//foods whose prices matches all the value supplied as array 
```

***$or***
```js
await user.find({$or:{firstname:'tom', lastname:{$has:'jo'}}}).get()
//users whose firstname is tom or lastname has jo in it

await food.find({$or:{name:'pizze', price:{$lt:20}}}).get()
//foods whose name is pizza or price is less than 20
```

***$and***
```js
await user.find({$and:{firstname:'tom', lastname:{$has:'jo'}}}).get()
//users whose firstname is tom and lastname has jo in it

await food.find({$or:{name:'pizze', price:{$lt:20}}}).get()
//foods whose name is pizza and price is less than 20
```

You can have queries like;
```js
await user.find({
    country:'canada',
    first_name:{$has:'ni'},
    last_name:{$has:'jo'},
    age:{$gte:20},
}).get();
//returns array
```
##### NB:
-Both .paginate() and .find() methods require you to call a get method at the end to return the data.

Both .paginate() and .find() takes in second optional parameter which spacifies which attribute you want back or not, all attributes will be return by default
```js
await user.find({},{password:true, create_at:false})
await user.find({country:'USA'},{password:false, name:false})
//returns results without password attribute
```

#### THANKS, from ***Bigdb team***









