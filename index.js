const fs = require("fs");
const path = require("path");

// make directory
const mkdir = (folder) => {
  if (!fs.existsSync(folder)) {
    fs.mkdir(folder, (err) => {});
  }
  return folder;
};

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

class Litedb {
  #db_path = path.resolve() + "/Db/"; //path to the db
  #db = {}; //the db itself
  #db_collection = []; // the field being affected from the db
  #incid = 0; //autoincreamting id
  #input_field; //the field being asked by the constructor
  #many_files = false; //wheater to create one or more files
  #creating_collection = false
  #sort = false;
  #sort_criteria = {};
  #exclude_field = {};
  #limit = 12;
  #page = 1;
  #pagination = false;

  constructor(field, many_files = false) {
    this.#input_field = field;
    this.#many_files = many_files;

    if (many_files) {
      this.#db_path = this.#db_path + field + ".json"; //path to a separate file
      if (fs.existsSync(this.#db_path)) {
        this.#db = require(this.#db_path) || {};
      }
    } else {
      if (fs.existsSync(this.#db_path + "db.json")) {
        this.#db = require(this.#db_path + "db.json") || {};
      }
    }
    this.#db_collection = this.#db[field] || this.#db_collection;
    this.#incid = this.#db["_" + field] || this.#incid;
  }

  //*Create**************************************************************************
  // create new record
  create(record) {
    this.#creating_collection = true
    //craete array of record
    if(Array.isArray(record)){
      for( let rec of record){
        this.#addToDbCollection(rec)
      }
    }else{
      // create single record 
    this.#addToDbCollection(record)
    }
    return this;
  }

  //*Update**************************************************************************
  // update by the id
  update(id, record) {
    delete record.createddAt;
    delete record.id;
    //
    let found = this.#db_collection.find((rec) => rec.id === id);
    found && (found.updatedAt = new Date().toISOString());
    //
    this.#db_collection = this.#db_collection.map((rec) =>
      rec.id === id ? { ...found, ...record } : rec
    );
    this.save(false);

    return { ...found, ...record };
  }

  //update many given the criteria
  findOneAndUpdate(criteria, record) {
    let found_result = this.#matchAllCriteria(criteria)[0];
    // update each one of it;
    if (found_result) {
      this.update(found_result.id, record);
    }
    return true;
  }

  //update many given the criteria
  findAndUpdate(criteria, record) {
    let found_result = this.#matchAllCriteria(criteria);
    // update each one of it;
    if (found_result.length > 0) {
      for (let one_found of found_result) {
        this.update(one_found.id, record);
      }
    }
    return true;
  }

  //*Delete**************************************************************************
  // delet a record by id
  delete(id) {
    this.#db_collection = this.#db_collection.filter((rec) => rec.id !== id);
    this.save(false);
    return (this.#db_collection = this.#db_collection.find(
      (rec) => rec.id === id
    ));
  }

  // delete one by criteria
  findOneAndDelete(criteria) {
    let found = this.#matchAllCriteria(criteria)[0];
    if (found) {
      this.#db_collection = this.#db_collection.filter(
        (rec) => rec.id !== found.id
      );
      this.save(false);
    }
    return found || {};
  }

  // delete many by criteria
  findAndDelete(criteria) {
    let found = this.#matchAllCriteria(criteria);
    if (found) {
      for (let one_found of found) {
        this.#db_collection = this.#db_collection.filter(
          (rec) => rec.id !== one_found.id
        );
        this.save(false);
      }
    }
  }

  //*Last**************************************************************************
  //finding last that #matchAllCriteria critria
  last(criteria = {}) {
    return this.#matchAllCriteria(criteria).slice(-1)[0];
  }

  //*Find**************************************************************************
  // find by id
  findById(id) {
    return this.#db_collection.find((rec) => rec.id === id);
  }

  find(criteria = {}, exclude = {}) {
    this.#exclude_field = exclude;
    //
    if (!this.#hasProperty(criteria)) {
      this.#db_collection = this.#db_collection;
      return this;
    }
    //
    this.#db_collection = this.#matchAllCriteria(criteria);
    return this;

    //
  }
  //*FindOne**************************************************************************
  //returns the first mach of the criteria
  findOne(criteria = {}){
    if (!this.#hasProperty(criteria)) {
      return {};
    }
    return this.#matchAllCriteria(criteria)[0];
  }

  //*countDocuments**************************************************************************
  //counting documnt that meets the criteria pased
  countDocuments(criteria = {}) {
    return this.#matchAllCriteria(criteria).length;
  }

  //*******************************************************************************************
  //*Helper methods**************************************************************************
  //*******************************************************************************************

  #addToDbCollection(record){
    if (!this.#hasProperty(record)) return;
      record.id = this.#incid + 1;
      //
      record.createdAt = new Date().toISOString();
      record.updatedAt = new Date().toISOString();
      //
      this.#db_collection.push(record);
      this.save(true);
  }
  // sorting result in assending or descending order
  sort(criteria = {}) {
    this.#sort = true;
    this.#sort_criteria = criteria;
    return this;
  }

  // limit
  limit(limit = 1) {
    this.#limit = limit;
    return this;
  }

  // paginate and return data togethor with metadata
  paginate(critria={}, exclude = {}) {
    this.#exclude_field = exclude
    this.#pagination = true;
    this.#db_collection = this.#matchAllCriteria(critria);
    return this;
  }

  // number you want per page
  count(limit = 12) {
    this.#limit = limit;
    return this;
  }
  // number you want per page
  page(page = 1) {
    this.#page = page;
    return this;
  }
  // handle sorting
  #sortResultOfFind() {
  
    if (!this.#hasProperty(this.#sort_criteria)) {
      if (this.#limit) {
        return this.#db_collection.slice(0, this.#limit);
      } else {
        return this.#db_collection;
      }
    }

    
    let sample = this.#db_collection[0];
    //if db collection is empty
    if (!sample) {
      return this.#db_collection;
    }

    //
    for (let keys in this.#sort_criteria) {
      let key = keys;
      let value = this.#sort_criteria[key];
      let field = sample[key];

      // sort
      if (typeof field === "number") {
        // check order
        if (value < 0) {
          this.#db_collection = this.#db_collection.sort(
            (a, b) => b[key] - a[key]
          );
        } else {
          this.#db_collection = this.#db_collection.sort(
            (a, b) => a[key] - b[key]
          );
        }
      } else if (typeof field === "string") {
        // check order
        if (value < 0) {
          this.#db_collection = this.#db_collection.sort((a, b) =>
            b[key].localeCompare(a[key])
          );
        } else {
          this.#db_collection = this.#db_collection.sort((a, b) =>
            a[key].localeCompare(b[key])
          );
        }
      }

      if (this.#limit) {
        return this.#db_collection.slice(0, this.#limit);
      } else {
        return this.#db_collection;
      }
    }
  }
  // getting the result , called wen chaining mathod
  get() {
    //removing unwanted fields
    for (let field in this.#exclude_field) {
      this.#db_collection.map((rec) => {
        !this.#exclude_field[field] && delete rec[field];
        return rec;
      });
    }
    //handle sorting during find()
    if (this.#sort === true) {
      return this.#sortResultOfFind();
    }

    
    //
    if (this.#pagination) {
      let start = (this.#page - 1) * this.#limit;
      let stop = this.#page * this.#limit;
      let result = this.#db_collection.slice(start, stop);
      let has_next = stop < this.#db_collection.length;
      let has_prev = (this.#page - 1) * this.#limit > 1;
      let num_pages = Math.ceil(this.#db_collection.length / this.#limit);
      let next_page = this.#db_collection.length > stop ? this.#page + 1 : null;
      let prev_page = this.#page - 1 < 1 ? null : this.#page - 1;

      return {
        page: this.#page,
        par_page: this.#limit,
        has_next,
        has_prev,
        result,
        next_page,
        prev_page,
        num_pages,
      };
    } else {
      return this.#db_collection;
    }
  }

  #matchAllCriteria(criteria) {
    let plain_criteia = {}; //get criteria without $
    let $criteria = {}; //get criteria with $

    for (let crit in criteria) {
      //handles objects without $
      if (typeof criteria[crit] !== "string") {
        $criteria[crit] = criteria[crit];
      } else {
        //handles objects with $
        plain_criteia[crit] = criteria[crit];
      }
    }
    //
    let result_found = this.#matchPlainObject(plain_criteia);

    // filterin queries with $ in them
    for (let crit_key in $criteria) {
      let $query_key = Object.keys($criteria[crit_key])[0];
      let query_value = $criteria[crit_key][$query_key];

      // check the type of filter and run its logic of filtering
      if ($query_key === "$has") {
        result_found = result_found.filter((rec) =>
          rec[crit_key].toLowerCase().includes(query_value.toLowerCase())
        );
      }
      //does not
      if ($query_key === "$hasNo") {
        result_found = result_found.filter(
          (rec) =>
            !rec[crit_key].toLowerCase().includes(query_value.toLowerCase())
        );
      }

      // less than
      if ($query_key === "$lt") {
        let result_found = result_found.filter(
          (rec) => rec[crit_key] < query_value
        );
      }
      // greater than
      if ($query_key === "$gt") {
        result_found = result_found.filter(
          (rec) => rec[crit_key] > query_value
        );
      }

      // less than or equal to
      if ($query_key === "$gte") {
        result_found = result_found.filter(
          (rec) => rec[crit_key] >= query_value
        );
      }
      // greater than or equal to
      if ($query_key === "$lte") {
        result_found = result_found.filter(
          (rec) => rec[crit_key] <= query_value
        );
      }

      // in operator
      if ($query_key === "$in") {
        result_found = result_found.filter(
          (rec) =>
            Array.isArray(rec[crit_key]) && rec[crit_key].includes(query_value)
        );
      }

      // not in operator
      if ($query_key === "$nin") {
        result_found = result_found.filter(
          (rec) =>
            Array.isArray(rec[crit_key]) && !rec[crit_key].includes(query_value)
        );
      }

      // equals to operator
      if ($query_key === "$eq") {
        result_found = result_found.filter(
          (rec) => rec[crit_key] === query_value
        );
      }

      // not equals to operator
      if ($query_key === "$neq") {
        result_found = result_found.filter(
          (rec) => rec[crit_key] !== query_value
        );
      }

      // starts with operator
      if ($query_key === "$sw") {
        result_found = result_found.filter(
          (rec) => {
            let sliced = rec[crit_key].slice(0, query_value.length).toLowerCase()
            return sliced === query_value.toLowerCase()
          }
        );
      }
      // ends with operator
      if ($query_key === "$ew") {
        result_found = result_found.filter(
          (rec) => {
            let sliced = rec[crit_key].slice((rec[crit_key].length - (query_value.length)), rec[crit_key].length).toLowerCase()
            return sliced === query_value.toLowerCase()
          }
        );
      }
      // not starting with operator
      if ($query_key === "$nsw") {
        result_found = result_found.filter(
          (rec) => {
            let sliced = rec[crit_key].slice(0, query_value.length).toLowerCase()
            return sliced !== query_value.toLowerCase()
          }
        );
      }
      //not ending with operator
      if ($query_key === "$new") {
        result_found = result_found.filter(
          (rec) => {
            let sliced = rec[crit_key].slice((rec[crit_key].length - (query_value.length)), rec[crit_key].length).toLowerCase()
            return sliced !== query_value.toLowerCase()
          }
        );
      }
      //or operator
      if ($query_key === "$or") {
        result_found = result_found.filter((rec) =>
        query_value.join().toLowerCase().includes(rec[crit_key].toLowerCase()));
      }
      //or operator
      if ($query_key === "$nor") {
        result_found = result_found.filter((rec) =>
        !query_value.join().toLowerCase().includes(rec[crit_key].toLowerCase()));
      }
    }
    return result_found;
  }

  // finding the record matching the creteria without nested object passed
  #matchPlainObject(criteria = {}) {
    if (!this.#hasProperty(criteria)) return this.#db_collection;
    let found_result = [];
    let i = 0;

    for (let crit in criteria) {
      let key = crit;

      if (i === 0) {
        found_result = this.#db_collection.filter(
          (rec) => rec[key].toLowerCase() === criteria[key].toLowerCase()
        );
      } else {
        found_result = found_result.filter(
          (rec) => rec[key].toLowerCase() === criteria[key].toLowerCase()
        );
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
  // save method that write to db
  save(inc) {
    this.#db[this.#input_field] = this.#db_collection;
    this.#db["_" + this.#input_field] = this.#incid + (inc === true ? 1 : 0);
    // let path = this.#db_path+(this.#many_files?this.#input_field:'.json')
    let path;
    mkDir("Db");
    if (this.#many_files) {
      path = this.#db_path;
    } else {
      path = this.#db_path + "db.json";
    }
    // fs.writeFileSync(path, JSON.stringify(this.#db, null, 2));
    fs.writeFile(path, JSON.stringify(this.#db, null, 2), (err) => {
      if (err) console.log(err); 
    });

    this.#incid = this.#incid + (inc === true ? 1 : 0);
    if(this.#creating_collection){
      return this.#db_collection.slice(-1)[0]
    }
  }
}

module.exports = {Litedb};
