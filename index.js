const fs = require("fs");
const path = require("path");
const readline = require("readline");
const _ = require('lodash');

// make directory
const mkdir = (folder) => {
  if (!fs.existsSync(folder)) {
    fs.mkdir(folder, (err) => {});
  }
  return folder;
}
//

const mkDir = (upload_path) => {
  let formated_path = "";
  let i = 0;
  for (let path of upload_path.split("/")) {
    i++;
    if (i === 1) {
      mkdir(path);
      formated_path += path;
    } else {
      mkdir(formated_path);
      formated_path += "/" + path;
    }
  }
  mkdir(formated_path);
};

//writing json stream
function writeObjectToJsonStream(filePath, jsonObject) {
  const writeStream = fs.createWriteStream(filePath, { encoding: "utf8" });
  writeStream.write(JSON.stringify(jsonObject, null, 2));
  writeStream.end();
  writeStream.on("error", (error) => {
    console.error("***** Error writing to JSON stream: ****", error);
  });
}

// reading the json stream
function readLargeJsonStream(filePath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity,
    });

    let jsonData = "";

    rl.on("line", (line) => {
      jsonData += line;
    });

    rl.on("close", () => {
      try {
        const jsonObject = JSON.parse(jsonData);
        resolve(jsonObject);
      } catch (error) {
        // console.log(error);
        reject('');
      }
    });

    rl.on("error", (error) => {
      reject(error);
    });
  });
}

//
class Bigdb {
  // database_path, database, collection
  #database_path;
  #writable_file;
  #collection_name = "";
  #allow_many = false;
  //
  #database = {}; //the database itself
  #database_collection = []; // the collection being affected from the database
  #incrementid = 0; //autoincreamting id
  #input_collection; //the collection being asked by the constructor
  #criteria = {};
  #sort = false;
  #sort_criteria = {};
  #exclude_collection = {};
  #limit;
  #allow_limit = false;
  #allow_skip = false;
  #skipby = 0;
  #page = 1;
  #pagination = false;
  #update_many = false;
  #error_occured = false

  constructor(database_path, collection_name, allow_many) {
    this.#database_path = database_path;
    this.#collection_name = collection_name;
    this.#allow_many = allow_many;
  }

  //*Create**************************************************************************
  // create new record
  async create(record) {
    try {
      await this.#getDb();
      //craete array of record
      if (Array.isArray(record)) {
        _.forEach(record, (rec)=>{
          this.#addTodatabaseCollection(rec);
        })
      } else {
        // create single record
        this.#addTodatabaseCollection(record);
      }
      return this.#database_collection.slice(-1)[0] || null;
    } catch (error) {
      console.log(error);
      this.#error_occured = true
    }
  }

  //*Update**************************************************************************
  // update by the id
  async update(id, record) {
    try {
      await this.#getDb();
      return this.#updateDocs(id, record);
    } catch (error) {
      console.log(error);
      this.#error_occured = true
    }
  }

  //update many given the criteria
  async findOneAndUpdate(criteria, record) {
    try {
      await this.#getDb();
      let found_result = this.#matchOverallCriteria(criteria)[0];
      let updated;
      // update each one of it;
      if (found_result) {
        updated = this.#updateDocs(found_result.id, record);
      }
      this.#update_many === true
      this.#update_many === false && this.#save(false);
      this.#save(true);

      return updated || null;
    } catch (error) {
      console.log(error);
      this.#error_occured = true
    }
  }

  //update many given the criteria
  async findAndUpdate(criteria, record) {
    try {      
      await this.#getDb();
      let found_result = this.#matchOverallCriteria(criteria);
      if (_.size(found_result) > 0) {
        _.forEach(found_result, async(one_found)=>{
          await this.#updateDocs(one_found.id, record)
        })
      }
      this.#update_many === false && this.#save(false);
      return true;
    } catch (error) {
      console.log(error);
      this.#error_occured = true
    }
  }

  //*Delete**************************************************************************
  // delet a record by id
  async delete(id) {
    try {
      await this.#getDb();
      let deleted = true;
      if (Array.isArray(id)) {
        for (let i of id) {
          this.#database_collection = _.filter(this.#database_collection,
            (rec) => rec.id !== i
          );
        }
      } else {
        deleted = this.#findDocsById(id);
        this.#database_collection = _.filter(this.#database_collection,
          (rec) => rec.id !== id
        );
      }
      //
      this.#save(false);
      return deleted || null;
    } catch (error) {
      console.log(error);
      this.#error_occured =true
    }
  }

  // delete one by criteria
  async findOneAndDelete(criteria) {
    try {
      await this.#getDb();
      let found = this.#matchOverallCriteria(criteria)[0];
      if (found) {
        this.#database_collection = _.filter(this.#database_collection,
          (rec) => rec.id !== found.id
        );
      }
      this.#save(false);
      return found || null;
      
    } catch (error) {
      console.log(error);
      this.#error_occured =true
    }
  }

  // delete many by criteria
  async findAndDelete(criteria) {
    try {
      await this.#getDb();
      let found = this.#matchOverallCriteria(criteria);
      if (found) {
        for (let one_found of found) {
          this.#database_collection = _.filter(this.#database_collection,
            (rec) => rec.id !== one_found.id
          );
        }
      }
      this.#save(false);
      return true;
      
    } catch (error) {
      console.log(error);
      this.#error_occured = true
    }
  }

  //*Last**************************************************************************
  //finding last that #matchOverallCriteria critria
  async last(criteria = {}) {
    try {
      await this.#getDb();
      return _.last(this.#matchOverallCriteria(criteria).slice(-1))||null;
    } catch (error) {
      console.log(error);
      this.#error_occured =true
    }
  }

  //*Find**************************************************************************
  // find by id
  async findById(id) {
    try {
      await this.#getDb();
      return _.find(this.#database_collection,(rec) => rec.id === id) || null;
    } catch (error) {
      console.log(error);
      this.#error_occured = true
    }
  }

  find(criteria = {}, exclude = {}) {
    try {
      this.#exclude_collection = exclude;
      //
      if (!this.#hasProperty(criteria)) return this;
      this.#criteria = criteria;
      return this || null;
    } catch (error) {
      console.log(error);
      this.#error_occured =true
    }
  }
  //*FindOne**************************************************************************
  //returns the first mach of the criteria
  async findOne(criteria = {}) {
    try {
      await this.#getDb();
      if (!this.#hasProperty(criteria)) {
        return null;
      }
      return this.#matchOverallCriteria(criteria)[0] || null;
    } catch (error) {
      console.log(error);
      this.#error_occured =true
    }
  }

  //*countDocuments**************************************************************************
  //counting documnt that meets the criteria pased
  async countDocuments(criteria = {}) {
    try {
      await this.#getDb();
      return _.size(this.#matchOverallCriteria(criteria));
    } catch (error) {
      console.log(error);
      this.#error_occured = true
    }
  }

  //*******************************************************************************************
  //*Helper methods**************************************************************************
  //*******************************************************************************************

  #addTodatabaseCollection(record) {
    if (!this.#hasProperty(record)) return;
    record.id = this.#incrementid + 1;
    record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    this.#database_collection.push(record);
    this.#save(true);
  }
  // sorting result in assending or descending order
  sort(criteria = {}) {
    this.#sort = true;
    this.#sort_criteria = criteria;
    return this;
  }

  // limit
  limit(limit = this.#database_collection.length) {
    this.#allow_limit = true;
    this.#limit = limit;
    return this;
  }
  // skip
  skip(skipby = 0) {
    this.#allow_skip = true;
    this.#skipby = skipby;
    return this;
  }

  // paginate and return data togethor with metadata
  // paginate(criteria = {}, exclude = {}) {
  //   this.#limit = 12;
  //   this.#exclude_collection = exclude;
  //   this.#pagination = true;
  //   this.#criteria = criteria;
  //   return this;
  // }

  // number you want per page
  perpage(count = 12) {
    this.#limit = count;
    this.#pagination = true;
    return this;
  }
  // number you want per page
  page(page = 1) {
    this.#page = page;
    this.#pagination = true;
    return this;
  }
  // handle sorting
  #sortResultOfFind(){
    if (!this.#hasProperty(this.#sort_criteria)) return this.#database_collection

    //if database collection is empty
    if (!this.#database_collection[0]) return this.#database_collection
    let order_arr = this.#orderByArray(this.#sort_criteria)
    return _.orderBy(this.#database_collection, order_arr.keys, order_arr.values)
  }
  //function for sorting with lodash
  #orderByArray(orderByObj){
    let orderBy_keys =  Object.keys(orderByObj)
    let orderBy_values =  Object.values(orderByObj)
    let new_orderBy_values = []
    for (let value of orderBy_values){
        if(value == 1){
            new_orderBy_values.push('asc')
        }else if(value == -1){
            new_orderBy_values.push('desc')
        }else{
          console.log('Invalid sort value');
          return 
        }
    }
    return {keys:orderBy_keys, values:new_orderBy_values} 
}
  // getting the result , called when chaining mathod
  async get() {
    try {
      await this.#getDb(this.#database_path,this.#collection_name,this.#allow_many);
      this.#database_collection = this.#matchOverallCriteria(this.#criteria);
      //removing unwanted collections
      for (let collection in this.#exclude_collection) {
        _.map(this.#database_collection, (rec) => {
          !this.#exclude_collection[collection] && delete rec[collection];
          return rec;
        });
      }
      let num_records = this.#database_collection?this.#database_collection.length:0;
      
      //handle skipping
      if (this.#allow_skip) {
        let length = this.#database_collection.length;
        this.#database_collection = this.#database_collection.slice(
          this.#skipby,
          length
        );
      }
      //handle sorting during find
      if (this.#sort === true) {
        this.#database_collection = this.#sortResultOfFind();
      }
      //handle limiting
      if (this.#allow_limit) {
        this.#database_collection = this.#database_collection.slice(
          0,
          this.#limit
        );
      }
  
      //pagenate
      
      if (this.#pagination) {
        let start = (this.#page - 1) * this.#limit;
        
        let stop = this.#page * this.#limit;
        let result = this.#database_collection.slice(start, stop);
        let has_next = stop < this.#database_collection.length;
        let has_prev = ((this.#page - 1) * this.#limit) > 1;
        let num_pages = Math.ceil(this.#database_collection.length / this.#limit);
        let next_page = this.#database_collection.length > stop ? this.#page + 1 : null;
        let prev_page = this.#page - 1 < 1 ? null : this.#page - 1;
        let position = (this.#page-1) * this.#limit + 1         
        
        let result_data = result.length>0? {
          num_records,
          page: this.#page,
          par_page: this.#limit,
          has_next,
          has_prev,
          result,
          next_page,
          prev_page,
          num_pages,
          position
        }:null
        return result_data
      } else {
        return this.#database_collection.length>0?this.#database_collection: null;
      }
      
    } catch (error) {
      console.log(error);
      this.#error_occured =true
    }
  }

  //finding one record by id
  #findDocsById(id) {
    return _.find(this.#database_collection, (rec) => rec.id === id) || {};
  }
  //overall filtering including $and and $or
  #matchOverallCriteria(criteria) {
    let key = Object.keys(criteria)[0];
    let result_found = [];
    let result_found_id = [];
    // 
    if (key === "$and") {
      for (let crit in criteria[key]) {
        result_found = this.#matchAllCriteria(criteria["$and"]);
      }
      return result_found;
    } else if (key === "$or") {// case $or
      //getting the individual 
      for(let i=0; i<criteria[key].length; i++){
        let results = this.#matchAllCriteria(criteria[key][i]);
        //looping to push to the result found with check
        for (let result of results) {
          if (!result_found_id.includes(result.id)) {
            result_found.push(result);
            result_found_id.push(result.id);
          }
        }
      }
      return result_found;
    } else {
      return this.#matchAllCriteria(criteria);
    }
  }
  // matching palin and $criteria
  #matchAllCriteria(criteria) {
    let plain_criteria = {}; //get criteria without $
    let $criteria = {}; //get criteria with $
    for (let crit in criteria) {
      //handles objects without $
      if (typeof criteria[crit] !== "object") {
        plain_criteria[crit] = criteria[crit];
      } else {
        //handles objects with $
        $criteria[crit] = criteria[crit];
      }
    }
    //
    let result_found = this.#matchPlainObject(plain_criteria);

    // filterin queries with $ in them
    for (let crit_key in $criteria) {
      let $query_key = Object.keys($criteria[crit_key])[0];
      let query_value = $criteria[crit_key][$query_key];

      // check the type of filter and run its logic of filtering
      if ($query_key === "$has") {
        result_found = _.filter( result_found, (rec) =>
          rec[crit_key].toLowerCase().includes(query_value.toLowerCase())
        );
      }
      //does not
      if ($query_key === "$hasNo" || $query_key === "$hasno") {
        result_found = _.filter( result_found,
          (rec) =>
            !rec[crit_key].toLowerCase().includes(query_value.toLowerCase())
        );
      }

      // less than
      if ($query_key === "$lt") {
        result_found = _.filter( result_found,
          (rec) => rec[crit_key] < query_value
        );
      }
      // greater than
      if ($query_key === "$gt") {
        result_found = _.filter( result_found,
          (rec) => rec[crit_key] > query_value
        );
      }

      // less than or greater than or equal to
      if ($query_key === "$gte") {
        result_found = _.filter( result_found,
          (rec) => rec[crit_key] >= query_value
        );
      }
      // greater than or equal to
      if ($query_key === "$lte") {
        result_found = _.filter( result_found,
          (rec) => rec[crit_key] <= query_value
        );
      }
      // between
      if ($query_key === "$bt") {
        if (crit_key === "id") {
          result_found = result_found.slice(
            query_value[0] -1,
            query_value[1] - 1
          );
        } else {
          result_found = _.filter( result_found,
            (rec) =>
              typeof query_value[1] === "number" &&
              typeof query_value[1] === "number" &&
              rec[crit_key] > query_value[0] + 1 &&
              rec[crit_key] < query_value[1] - 1
          );
        }
      }

      // not between
      if ($query_key === "$nbt") {
        result_found = _.filter( result_found, 
          (rec) =>
            (typeof query_value[1] === "number" &&
              typeof query_value[1] === "number" &&
              rec[crit_key] < query_value[0]) ||
            rec[crit_key] > query_value[1]
        );
      }

      // in operator
      if ($query_key === "$in") {
        result_found = _.filter( result_found,
          (rec) =>
            Array.isArray(rec[crit_key]) && rec[crit_key].includes(query_value)
        );
      }

      // not in operator
      if ($query_key === "$nin") {
        result_found = _.filter( result_found,
          (rec) =>
            Array.isArray(rec[crit_key]) && !rec[crit_key].includes(query_value)
        );
      }

      // equals to operator
      if ($query_key === "$eq") {
        result_found = _.filter( result_found,
          (rec) => rec[crit_key] === query_value
        );
      }

      // not equals to operator
      if ($query_key === "$neq") {
        result_found = _.filter( result_found,
          (rec) => rec[crit_key] !== query_value
        );
      }

      // starts with operator
      if ($query_key === "$sw") {
        result_found = _.filter(result_found, (rec) => {
          let sliced = rec[crit_key].slice(0, query_value.length).toLowerCase();
          return sliced === query_value.toLowerCase();
        });
      }
      // ends with operator
      if ($query_key === "$ew") {
        result_found = _.filter(result_found, (rec) => {
          let sliced = rec[crit_key]
            .slice(
              rec[crit_key].length - query_value.length,
              rec[crit_key].length
            )
            .toLowerCase();
          return sliced === query_value.toLowerCase();
        });
      }
      // not starting with operator
      if ($query_key === "$nsw") {
        result_found = _.filter(result_found, (rec) => {
          let sliced = rec[crit_key].slice(0, query_value.length).toLowerCase();
          return sliced !== query_value.toLowerCase();
        });
      }
      //not ending with operator
      if ($query_key === "$new") {
        result_found = _.filter(result_found, (rec) => {
          let sliced = rec[crit_key]
            .slice(
              rec[crit_key].length - query_value.length,
              rec[crit_key].length
            )
            .toLowerCase();
          return sliced !== query_value.toLowerCase();
        });
      }
      //or operator
      if ($query_key === "$or") {
        result_found = result_found.filter((rec) =>
          query_value.join().toLowerCase().includes(rec[crit_key].toLowerCase())
        );
      }
      //or operator
      if ($query_key === "$nor") {
        result_found = _.filter(result_found,
          (rec) =>
            !query_value
              .join()
              .toLowerCase()
              .includes(rec[crit_key].toLowerCase())
        );
      }
      //all operator
      if ($query_key === "$all") {
        result_found = _.filter(result_found,
          (rec) => query_value.join() === rec[crit_key].join()
        );
      }

      //like operator
      if ($query_key === "$like") {
        result_found = _.filter(result_found, (rec) => {
          //where it matches any where
          if (
            query_value.charAt(0) === "%" &&
            query_value.charAt(query_value.length - 1) === "%"
          ) {
            //removing %
            let value = query_value.replace("%", "").replace("%", "").trim();
            return rec[crit_key].toLowerCase().includes(value.toLowerCase());
          } else if (query_value.charAt(0) === "%") {
            //matches at the start
            let value = query_value.replace("%", "").trim();
            // let sliced = rec[crit_key].slice(0, value.length - 1).toLowerCase();
            return rec[crit_key].startsWith(value.toLowerCase());
          } else if (query_value.slice(-1) === "%") {
            //matches at the end
            let value = query_value.replace("%", "").toLowerCase().trim();
            let sliced = rec[crit_key]
              .slice(rec[crit_key].length - value.length, rec[crit_key].length)
              .toLowerCase()
              .trim();
            return sliced === value;
          }
        });
      }
    }
    return result_found;
  }
  // finding the record matching the creteria without nested object passed
  #matchPlainObject(criteria = {}) {
    if (!this.#hasProperty(criteria)) return this.#database_collection;
    // 
    let found_result = [];
    let i = 0;

    for (let crit in criteria) {
      i++;
      if (i === 1) {
        found_result = _.filter(this.#database_collection, (rec) => {
          return rec[crit] && rec[crit] === criteria[crit];
        });
      } else {
        found_result = _.filter(found_result, (rec) => {
          return rec[crit] && rec[crit] === criteria[crit];
        });
      }
    }
    return found_result;
  }
  //check if an objct has prperty
  #hasProperty(criteria) {
    let keys = [];
    for (let key in criteria) {
      keys.push(key);
    }

    return keys.length > 0 ? true : false;
  }
  //remove all the occurence of an ellement of an array, does not take in an object
  #pullAllInstance(inputArray, elToBeRemoved) {
    if (!Array.isArray(inputArray)) return inputArray;
    let _elToBeRemoved = Array.isArray(elToBeRemoved)
      ? elToBeRemoved
      : [elToBeRemoved];
    // 
    let _inputArray = inputArray;
    for (let remove_element of _elToBeRemoved) {
      _inputArray = _.filter(_inputArray, (el) => el !== remove_element);
    }
    return _inputArray;
  }
  //pull on
  #pull(arr, num){
    let res = []
    let index = arr.findIndex(el=>el===num)
    for(let i = 0; i<arr.length; i++){
      if (i===index) continue
      res.push(arr[i])
    }
    return res
}
  //the actual update function
  #updateDocs(id, record) {
    if (!this.#hasProperty(record)) return false;
    delete record.createddAt;
    delete record.id;
    let key = Object.keys(record)[0];
    let found = this.#findDocsById(id);
    found && (found.updatedAt = new Date().toISOString());
    if (key.includes("$")) {
      //checking for each case
      // case of increament
      if (key === "$inc") {
        let collection = record["$inc"];
        for (let inner_key in collection) {
          let record_key = inner_key;
          let update_value = collection[inner_key];
          //
          let index = _.findIndex(this.#database_collection, (rec) => rec.id === id && typeof rec[record_key] === "number");
          found = index >=0 && { ...found, [record_key] : found[record_key] + update_value }
          // reasigning the updated record
          index >= 0 && ( this.#database_collection[index] = found )
        }
      }
      // case increament by multiplying
      if (key === "$mul") {
        let collection = record["$mul"];
        for (let inner_key in collection) {
          let record_key = inner_key;
          let update_value = collection[inner_key];
          //
          let index = _.findIndex(this.#database_collection, (rec) => rec.id === id && typeof rec[record_key] === "number");
          found = index >=0 && { ...found, [record_key] : found[record_key] * update_value }
          // reasigning the updated record
          index >= 0 && ( this.#database_collection[index] = found )
        }
      }

      // case push
      if (key === "$push") {
        let collection = record["$push"];
        for (let inner_key in collection) {
          let record_key = inner_key;
          let update_value = collection[inner_key];
          //
          let index = _.findIndex(this.#database_collection, (rec) => rec.id === id && Array.isArray(rec[record_key]));
          found = index >=0 && { ...found, ...found[record_key].push(update_value) }
          // reasigning the updated record
          index >= 0 && ( this.#database_collection[index] = found ) 
        }
      }

      //case pull
      if (key === "$pull") {
        let collection = record["$pull"];
        for (let inner_key in collection) {
          let record_key = inner_key;
          let update_value = collection[inner_key];
          //
          let index = _.findIndex(this.#database_collection, (rec) => rec.id === id && Array.isArray(rec[record_key]));
          found = index >=0 && { ...found, [record_key]: this.#pull( found[record_key], update_value) }
          // reasigning the updated record
          index >= 0 && ( this.#database_collection[index] = found ) 
        }
      }
      //case pullAll
      if (key === "$pullAll") {
        let collection = record["$pullAll"];
        for (let inner_key in collection) {
          let record_key = inner_key;
          let update_value = collection[inner_key];
          //
          let index = _.findIndex(this.#database_collection, (rec) => rec.id === id && Array.isArray(rec[record_key]));
          found = index >=0 && { ...found, [record_key]: this.#pullAllInstance( found[record_key], update_value) }
          // reasigning the updated record
          index >= 0 && ( this.#database_collection[index] = found ) 
          
        }
      }
    }
    //
    let index = _.findIndex(this.#database_collection, (rec) => rec.id === id );
    found = index >=0 && { ...found, ...record }// reasigning the updated record
    
    index >= 0 && ( this.#database_collection[index] = found )     
    return this.#findDocsById(id);
  }
  // #save method that write to database
  #save(inc) {
    try {
      if(!this.#error_occured){
        // return
        this.#database[this.#input_collection] = this.#database_collection;
        this.#database["_" + this.#input_collection] =
        this.#incrementid + (inc === true ? 1 : 0);
        writeObjectToJsonStream(this.#writable_file, this.#database);
        this.#incrementid = this.#incrementid + (inc === true ? 1 : 0);
      }
      
    } catch (error) {
      console.log(error);
      this.#error_occured = true
    }
  }
  //getting the database data
  async #getDb() {
    try {
      let database_name = this.#allow_many ? this.#collection_name : "database"; //name of the collection
      let database_path =
        this.#database_path === null
          ? path.join(path.resolve(), "Db")
          : path.join(path.resolve(), this.#database_path); //path to the database file
      // create database directory
      mkDir(database_path);
      //read or create database
      let database_file = path.join(database_path, database_name + ".json");
      let database_data = {
        [this.#collection_name]: [],
        ["_" + this.#collection_name]: 0,
      };
      //checking if file exists
      if (!fs.existsSync(database_file)) {
        fs.writeFile(
          database_file,
          JSON.stringify(database_data, null, 2),
          (err) => {
            if (err) console.log(err);
          }
        );
      }
      // updating variabls
      this.#database = await readLargeJsonStream(database_file);
      this.#input_collection = this.#collection_name;
      this.#database_collection = this.#database[this.#collection_name];
      this.#incrementid = this.#database["_" + this.#collection_name] || this.#incrementid;
      this.#writable_file = database_file;
    } catch (error) {
      console.log(error);
    }
  }
}
// 
module.exports = {
  Bigdb:(path=null, collection, many=false)=>new Bigdb(path, collection, many)
};

