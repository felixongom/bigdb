const fs = require("fs");
const path = require("path");
const readline = require("readline");

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

//writing json stream
function writeObjectToJsonStream(filePath, jsonObject) {
  const writeStream = fs.createWriteStream(filePath, { encoding: "utf8" });
  writeStream.write(JSON.stringify(jsonObject, null, 2));
  writeStream.end();
  writeStream.on("error", (error) => {
    console.error("Error writing to JSON stream:", error);
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
        console.log(error);
        reject(error);
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
  #incid = 0; //autoincreamting id
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

  constructor(database_path, collection_name, allow_many) {
    this.#database_path = database_path;
    this.#collection_name = collection_name;
    this.#allow_many = allow_many;
  }

  //*Create**************************************************************************
  // create new record
  async create(record) {
    await this.#getDb();
    //craete array of record
    if (Array.isArray(record)) {
      for (let rec of record) {
        this.#addTodatabaseCollection(rec);
        console.log("&&&&&&&&&&&", record);
      }
    } else {
      // create single record
      this.#addTodatabaseCollection(record);
    }
    return this.#database_collection.slice(-1)[0];
  }

  //*Update**************************************************************************
  // update by the id
  async update(id, record) {
    await this.#getDb();
    return this.#updateDocs(id, record);
  }

  //update many given the criteria
  async findOneAndUpdate(criteria, record) {
    await this.#getDb();
    let found_result = this.#matchOverallCriteria(criteria)[0];
    let updated;
    // update each one of it;
    if (found_result) {
      updated = this.#updateDocs(found_result.id, record);
    }

    this.#update_many === false && this.#save(false);
    return updated;
  }

  //update many given the criteria
  async findAndUpdate(criteria, record) {
    await this.#getDb();
    this.#update_many === true;
    let found_result = this.#matchOverallCriteria(criteria);
    // update each one of it;
    if (found_result.length > 0) {
      for (let one_found of found_result) {
        this.#updateDocs(one_found.id, record);
      }
    }
    this.#save(false);
    return true;
  }

  //*Delete**************************************************************************
  // delet a record by id
  async delete(id) {
    await this.#getDb();
    let deleted = true;
    if (Array.isArray(id)) {
      // if it is array of ids, [1,2,3]
      for (let i of id) {
        this.#database_collection = this.#database_collection.filter(
          (rec) => rec.id !== i
        );
      }
    } else {
      deleted = this.#findDocsById(id);
      this.#database_collection = this.#database_collection.filter(
        (rec) => rec.id !== id
      );
    }
    //
    this.#save(false);
    return deleted;
  }

  // delete one by criteria
  async findOneAndDelete(criteria) {
    await this.#getDb();
    let found = this.#matchOverallCriteria(criteria)[0];
    if (found) {
      this.#database_collection = this.#database_collection.filter(
        (rec) => rec.id !== found.id
      );
    }
    this.#save(false);
    return found || {};
  }

  // delete many by criteria
  async findAndDelete(criteria) {
    await this.#getDb();
    let found = this.#matchOverallCriteria(criteria);
    if (found) {
      for (let one_found of found) {
        this.#database_collection = this.#database_collection.filter(
          (rec) => rec.id !== one_found.id
        );
      }
    }
    this.#save(false);
    return true;
  }

  //*Last**************************************************************************
  //finding last that #matchOverallCriteria critria
  async last(criteria = {}) {
    await this.#getDb();
    return this.#matchOverallCriteria(criteria).slice(-1)[0];
  }

  //*Find**************************************************************************
  // find by id
  async findById(id) {
    await this.#getDb();
    return this.#database_collection.find((rec) => rec.id === id) || {};
  }

  find(criteria = {}, exclude = {}) {
    this.#exclude_collection = exclude;
    //
    if (!this.#hasProperty(criteria)) return this;
    this.#criteria = criteria;
    return this;
  }
  //*FindOne**************************************************************************
  //returns the first mach of the criteria
  async findOne(criteria = {}) {
    await this.#getDb();
    if (!this.#hasProperty(criteria)) {
      return {};
    }
    return this.#matchOverallCriteria(criteria)[0];
  }

  //*countDocuments**************************************************************************
  //counting documnt that meets the criteria pased
  async countDocuments(criteria = {}) {
    await this.#getDb();
    return this.#matchOverallCriteria(criteria).length;
  }

  //*******************************************************************************************
  //*Helper methods**************************************************************************
  //*******************************************************************************************

  #addTodatabaseCollection(record) {
    if (!this.#hasProperty(record)) return;
    record.id = this.#incid + 1;
    //
    record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    //
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
  // skipp
  skip(skipby = 0) {
    this.#allow_skip = true;
    this.#skipby = skipby;
    return this;
  }

  // paginate and return data togethor with metadata
  paginate(criteria = {}, exclude = {}) {
    this.#limit = 12;
    this.#exclude_collection = exclude;
    this.#pagination = true;
    this.#criteria = criteria;
    // this.#database_collection = this.#matchOverallCriteria(this.#criteria);
    return this;
  }

  // number you want per page
  perPage(count = 12) {
    this.#limit = count;
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
      return this.#database_collection;
    }

    let sample = this.#database_collection[0];
    //if database collection is empty
    if (!sample) {
      return this.#database_collection;
    }

    //
    for (let keys in this.#sort_criteria) {
      let key = keys;
      let value = this.#sort_criteria[key];
      let collection = sample[key];

      // sort
      if (typeof collection === "number") {
        // check order
        if (value < 0) {
          this.#database_collection = this.#database_collection.sort(
            (a, b) => b[key] - a[key]
          );
        } else {
          this.#database_collection = this.#database_collection.sort(
            (a, b) => a[key] - b[key]
          );
        }
      } else if (typeof collection === "string") {
        // check order
        if (value < 0) {
          this.#database_collection = this.#database_collection.sort((a, b) =>
            b[key].localeCompare(a[key])
          );
        } else {
          this.#database_collection = this.#database_collection.sort((a, b) =>
            a[key].localeCompare(b[key])
          );
        }
      }

      if (this.#limit) {
        return this.#database_collection.slice(0, this.#limit);
      } else {
        return this.#database_collection;
      }
    }
  }
  // getting the result , called wen chaining mathod
  async get() {
    await this.#getDb(
      this.#database_path,
      this.#collection_name,
      this.#allow_many
    );
    this.#database_collection = this.#matchOverallCriteria(this.#criteria);
    //removing unwanted collections
    for (let collection in this.#exclude_collection) {
      this.#database_collection.map((rec) => {
        !this.#exclude_collection[collection] && delete rec[collection];
        return rec;
      });
    }
    let num_records = this.#database_collection?this.#database_collection.length:0;
    //handle sorting during find()
    if (this.#sort === true) {
      this.#database_collection = this.#sortResultOfFind();
    }

    //handle skipping
    if (this.#allow_skip) {
      let length = this.#database_collection.length;
      this.#database_collection = this.#database_collection.slice(
        this.#skipby,
        length
      );
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
      let has_prev = (this.#page - 1) * this.#limit > 1;
      let num_pages = Math.ceil(this.#database_collection.length / this.#limit);
      let next_page =
        this.#database_collection.length > stop ? this.#page + 1 : null;
      let prev_page = this.#page - 1 < 1 ? null : this.#page - 1;

      return {
        num_records,
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
      return this.#database_collection;
    }
  }

  //finding one record by id
  #findDocsById(id) {
    return this.#database_collection.find((rec) => rec.id === id) || {};
  }
  //overall filtering including $and and $or
  #matchOverallCriteria(criteria) {
    let key = Object.keys(criteria)[0];
    let result_found = [];
    let result_found_id = [];

    if (key === "$and") {
      //case $and
      for (let crit in criteria[key]) {
        result_found = this.#matchAllCriteria(criteria["$and"]);
      }
      return result_found;
    } else if (key === "$or") {
      // case $or
      for (let crit in criteria[key]) {
        let single_criteria = {};
        single_criteria[crit] = criteria[key][crit];
        let results = this.#matchAllCriteria(single_criteria);
        //looping to push to the result founfd with check
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
        $criteria = criteria[crit];
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
        result_found = result_found.filter(
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
      // between
      if ($query_key === "$bt") {
        if (crit_key === "id") {
          result_found = result_found.slice(
            query_value[0] + 1,
            query_value[1] - 1
          );
        } else {
          result_found = result_found.filter(
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
        result_found = result_found.filter(
          (rec) =>
            (typeof query_value[1] === "number" &&
              typeof query_value[1] === "number" &&
              rec[crit_key] < query_value[0]) ||
            rec[crit_key] > query_value[1]
        );
      }

      // in operator
      if ($query_key === "$in") {
        console.log(1234, 566);
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
        result_found = result_found.filter((rec) => {
          let sliced = rec[crit_key].slice(0, query_value.length).toLowerCase();
          return sliced === query_value.toLowerCase();
        });
      }
      // ends with operator
      if ($query_key === "$ew") {
        result_found = result_found.filter((rec) => {
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
        result_found = result_found.filter((rec) => {
          let sliced = rec[crit_key].slice(0, query_value.length).toLowerCase();
          return sliced !== query_value.toLowerCase();
        });
      }
      //not ending with operator
      if ($query_key === "$new") {
        result_found = result_found.filter((rec) => {
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
        result_found = result_found.filter(
          (rec) =>
            !query_value
              .join()
              .toLowerCase()
              .includes(rec[crit_key].toLowerCase())
        );
      }
      //all operator
      if ($query_key === "$all") {
        result_found = result_found.filter(
          (rec) => query_value.join() === rec[crit_key].join()
        );
      }

      //like operator
      if ($query_key === "$like") {
        result_found = result_found.filter((rec) => {
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
            let sliced = rec[crit_key].slice(0, value.length - 1).toLowerCase();
            return sliced === value.toLowerCase();
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
    let found_result = [];
    let i = 0;

    for (let crit in criteria) {
      i++;
      if (i === 1) {
        found_result = this.#database_collection.filter((rec) => {
          return rec[crit] && rec[crit] === criteria[crit];
        });
      } else {
        found_result = found_result.filter((rec) => {
          console.log(rec[crit].toLowerCase());
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
    let _inputArray = inputArray;

    for (let remove_element of _elToBeRemoved) {
      _inputArray = _inputArray.filter((el) => el !== remove_element);
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

    //  let k = {$push:{price:2}}
    if (key.includes("$")) {
      //checking for each case
      // case increament
      if (key === "$inc") {
        let collection = record["$inc"];
        for (let inner_key in collection) {
          let record_key = inner_key;
          let update_value = collection[inner_key];
          //
          let found = this.#findDocsById(id);
          found && (found.updatedAt = new Date().toISOString());
          //
          this.#database_collection = this.#database_collection.map((rec) => {
            return rec.id === id &&
              typeof rec[record_key] === "number" &&
              typeof rec[record_key] === "number"
              ? { ...rec, [record_key]: rec[record_key] + update_value }
              : rec;
          });
        }
      }
      // case increament by multiplying
      if (key === "$mul") {
        let collection = record["$mul"];
        for (let inner_key in collection) {
          let record_key = inner_key;
          let update_value = collection[inner_key];
          //
          let found = this.#findDocsById(id);
          found && (found.updatedAt = new Date().toISOString());

          //
          this.#database_collection = this.#database_collection.map((rec) => {
            return rec.id === id &&
              typeof rec[record_key] === "number" &&
              typeof rec[record_key] === "number"
              ? { ...rec, [record_key]: rec[record_key] * update_value }
              : rec;
          });
        }
      }

      // case push
      if (key === "$push") {
        let collection = record["$push"];
        for (let inner_key in collection) {
          let record_key = inner_key;
          let update_value = collection[inner_key];
          //

          found && (found.updatedAt = new Date().toISOString());
          //
          this.#database_collection = this.#database_collection.map((rec) =>
            rec.id === id && Array.isArray(found[record_key])
              ? { ...found, ...found[record_key].push(update_value) }
              : rec
          );
        }
      }

      //case pull
      if (key === "$pull") {
        let collection = record["$pull"];
        for (let inner_key in collection) {
          let record_key = inner_key;
          let update_value = collection[inner_key];
          //
          found && (found.updatedAt = new Date().toISOString());
          //
          this.#database_collection = this.#database_collection.map((rec) =>
            rec.id === id && Array.isArray(found[record_key])
              ? {
                  ...found,
                  [record_key]: this.#pull(
                    rec[record_key],
                    update_value
                  ),
                }
              : rec
          );
        }
      }
      //case pullAll
      if (key === "$pullAll") {
        let collection = record["$pullAll"];
        for (let inner_key in collection) {
          let record_key = inner_key;
          let update_value = collection[inner_key];
          //

          found && (found.updatedAt = new Date().toISOString());
          //
          this.#database_collection = this.#database_collection.map((rec) =>
            rec.id === id && Array.isArray(found[record_key])
              ? {
                  ...found,
                  [record_key]: this.#pullAllInstance(
                    rec[record_key],
                    update_value
                  ),
                }
              : rec
          );
        }
      }
    }
    //
    found && (found.updatedAt = new Date().toISOString());
    //
    this.#database_collection = this.#database_collection.map((rec) =>
      rec.id === id ? { ...found, ...record } : { ...rec }
    );

    this.#update_many === false && this.#save(false);
    return this.#findDocsById(id);
  }
  // #save method that write to database
  #save(inc) {
    this.#database[this.#input_collection] = this.#database_collection;
    this.#database["_" + this.#input_collection] =
      this.#incid + (inc === true ? 1 : 0);
    writeObjectToJsonStream(this.#writable_file, this.#database);
    this.#incid = this.#incid + (inc === true ? 1 : 0);
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
      this.#incid = this.#database["_" + this.#collection_name] || this.#incid;
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
