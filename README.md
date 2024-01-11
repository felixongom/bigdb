## Litedb.

Litedb is a javascript backen library for persisting data just like a database.
It store it's data locally on the server just like sqlite3 would do, but instead it store its data in a json file.
Litedb is similar to mongodb and can can perform both read and write operation.
It can help alot when building a small application, but for larger project, i would advise going for sql databases or mongodb

##### Usage.
Install with npm i litebd
```js
conts {Litedb} = require('litedb)
```
To create new document, for example post, you first parameter as thr name of the collection and optionally you can pass true or false (boolean) to the second agument of the constructor.This spacifies wheather you want to kep your collection in one file or ecach file for each collection.

    true - ecach file for each collection. 
    false - one file. 

```js
const post = new Litedb('posts') 
//will create Db/db.json at the root of you app

//OR

const post = new Litedb('posts' true)
//will create Db/posts.json at the root of you app

let result = post.create({title:'post title 1',body:'i am post 1'}).save()
let result = post.create([{title:'post title 1',body:'i am post 1'}]).save()
//writes the database
```

The above code will create a Db/db.json or Db/posts.json at the root of your app and it does not exist,
    - "posts" is the name of the collection, if we had passed users it would create a users collection in the database 

 Then it will return something like this;
```js
{
  id: 1,
  title:'post title 1',
  body:'i am post 1',
  views:2,
  createdAt: '2024-01-08T09:39:09.976Z',
  updatedAt: '2024-01-08T09:39:09.976Z'
}

```
**Its that simple**

It auto asign createdAt, updatedAt and id to it as it saves to database.
The id  is an autoincreamenting id.

***As i told you earlier that the methods are similar to mongodb methods***, All queries ara case insensitive, uppercase letter are the same as lowercase letter ('a' is the same as 'A' ). 
We also have methods like;

##### **.findById(id)**
```js
post.findById(1)
```
It returns the document with id 1 from posts collection.

##### **.findOne()**
```js
post.findOne({name:{$has:'jo'}})
```
It returns the first document with that matches the query

##### **.find()**
Every query that has find() ends with .get() .eg
```js
post.find().get()
```
It returns an array of all the documents from posts collection.
```js
[
    {
        id: 1,
        title:'post title1',
        body:'i am post 1',
        views:2,
        createdAt: '2024-01-08T09:39:09.976Z',
        updatedAt: '2024-01-08T09:39:09.976Z'
    },
    {
        id: 2,
        title:'post title2',
        body:'i am post 2'
        views:8,
        createdAt: '2024-01-08T09:39:09.976Z',
        updatedAt: '2024-01-08T09:39:09.976Z'
    },
]
```
Also yor can request for  particular kind of data like
```js
post.find({views:2}).get()
post.find({views:2, title:{$has:'post'}}).get()
```
We also have the **sort()** and **limit()**
```js
post.find().sort({id:1}).get() 
//1 for ascending  and -1 for for descending

post.find().limit(5).get() 
//it retuns 5 documents

post.find().sort(id:-1).limit(5).get() 
/*it retuns 5 documents sorted in 
descending order basing on id 
*/
```
**The sort() and limit() have ***no orders*** in which they are called** like in mongodb.

```js
post.find().sort(id:-1).limit(5).get() 
post.find().limit(5).sort(id:-1).get() 
//the result for the above are the same
```

##### **.update()**

```js
post.update(2, {title:'updated title'})
/*update the title of document with id 2 
to 'updated title' and returns the updated document
*/
```

##### **.findOneAndUpdate()**

```js
post.findOneAndUpdate({views:10}, {title:'updated title'})
/*update the title of the first match
 to 'updated title'.
*/
```

##### **.findAndUpdate()**

```js
post.findAndUpdate({views:10}, {title:'updated title'})
/*update the title of all the matches to 'updated title'
*/
```

##### **.delete()**

```js
post.delete(2)
/*
deletes document with id 2
*/
```

##### **.findOneAndDelete()**

```js
post.findOneAndDelete({title:{$has:'updated'}})
/*
deletes first match of the query
*/
```

##### **.findAndDelete()**

```js
post.findAndDelete({title:{$has:'updated'}})
/*
deletes all the matches of the query
*/
```

##### **.last()**

```js
post.last() 
//
post.last({title:{$search:'updated'}})
/*
both returns the last match of the query
*/
```

##### **.countDocuments()**

```js
post.countDocuments() //1000
//
post.countDocuments({title:{$search:'updated'}}) //25
/*
counts the number of documents that matches the query
*/
```

##### **.paginate()**
This method has .get() at the end. This returns the data together with some metedata, call the get at the end
```js
post.paginate().get()
//defaults to page 1 and count of 12

post.paginate().page(2).get() 
//returns page 2 and count of 12

post.paginate().page(2).count(5).get()
//returns page 2 and count of 5 

post.paginate({age:10}, {title:false}).page(2).count(5).get()
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
      post: "post1",
      id: 1,
      createdAt: "2024-01-08T10:26:27.158Z",
      updatedAt: "2024-01-08T10:26:27.158Z"
    },
    {
      post: "post2",
      id: 2,
      createdAt: "2024-01-08T10:26:28.629Z",
      updatedAt: "2024-01-08T10:26:28.629Z"
    }
  ] 
}
```

**Some of the different ways of filterind are;**

***$lt***
```js
people.find({age:{$lt:18}}).get()
//returns people whose age is less than 18
```

***$lte***
```js
people.find({age:{$lte:18}}).get()
//returns people whose age is less than or equal to 18
```

***$gt***
```js
people.find({age:{$gt:18}}).get()
//returns people whose age is greater than to 18
```
***$gte***
```js
people.find({age:{$gte:18}}).get()
//returns people whose age is greater than or equal to 18
```

***$eq***
```js
people.find({age:{$eq:18}}).get()
//returns people whose age is equal to 18
```

***$neq***
```js
people.find({age:{$neq:18}}).get()
//returns people whose age is not equal to 18
```

***$has***
```js
people.find({country:{$has:'ug'}}).get()
//people whose country is has ug in their name
```

***$hasNo***
```js
people.find({country:{$hasNo:'ug'}}).get()
//people whose country has no ug in their name
```

***$sw***
```js
food.find({name:{$sw:'ap'}}).get()
//foods whose name starts with ap 
```

***$ew***
```js
food.find({name:{$ew:'ilk'}}).get()
//foods whose name end with ilk
```

***$nsw***
```js
food.find({name:{$nsw:'ap'}}).get()
//foods whose name is not starting with ap 
```

***$new***
```js
food.find({name:{$ew:'ilk'}}).get()
//foods whose name is not ending with ilk
```

***$in***
```js
food.find({prices:{$in:5}}).get()
//for array fields
//foods whose prices list has 5
```

***$nin***
```js
food.find({prices:{$nin:5}}).get()
//for array fields
//foods whose prices list has no 5
```

***$or***
```js
food.find({name:{$or:['pizza', 'buger']}}).get()
//foods whose name is pizza or burger
```

***$or***
```js
food.find({name:{$nor:['pizza', 'buger']}}).get()
//foods whose name is not pizza or burger
```

You can have complex queries like
```js
user.find({
    country:'canada',
    first_name:{$has:'ni'},
    last_name:{$has:'jo'},
    age:{$gte:20},
}).get()
//returns array

user
.find({id:{$gt:5}})
.find(first_name:{$sw:'nick'})
.get()
 //returns a number

user
.find({id:{$gt:5}})
.countDocuments()
 //returns a number
```
##### NB:
-Both .paginate() and .find() methods require you to call a get method at the end to return the data.

-In both .paginate() and .find() , you can call any method of you choice if .get() has not yet been called.

Both .paginate() and .find() takes in second optional parameter which spacifies which attribute you want back or not, all attributes will be return by default
```js
user.find({},{password:true})
user.find({country:'USA'},{password:false})
//returns results without password attribute
```









