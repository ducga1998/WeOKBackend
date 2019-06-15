var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require('body-parser')

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

let mydb, cloudant;
var vendor; // Because the MongoDB and Cloudant use different API commands, we
// have to check which command should be used based on the database
// vendor.
var dbName = 'mydb';

// Separate functions are provided for inserting/retrieving content from
// MongoDB and Cloudant databases. These functions must be prefixed by a
// value that may be assigned to the 'vendor' variable, such as 'mongodb' or
// 'cloudant' (i.e., 'cloudantInsertOne' and 'mongodbInsertOne')

var insertOne = {};
var getAll = {};
insertOne.deleteAll = function (doc, response) {
  mydb.deleteAll(doc, function (err, body, header) {
    if (err) {
      console.log('[mydb.insert] ', err.message);
      response.send("Error");
      return;
    }
    doc._id = body.id;
    response.send(doc);
  });
}
insertOne.cloudant = function (doc, response) {
  mydb.insert(doc, function (err, body, header) {
    if (err) {
      console.log('[mydb.insert] ', err.message);
      response.send("Error");
      return;
    }
    doc._id = body.id;
    response.send(doc);
  });
}

getAll.cloudant = function (response) {
  // mydb.collection(collectionName).remove({})
  var obj = [];
  mydb.list({ include_docs: true }, function (err, body) {
    if (!err) {
      body.rows.forEach(function (row) {
        console.log('row', row)
        if (row.doc.name && row.doc.rel && row.doc.phone && row.doc.check)
          obj.push(row.doc);
      });
      // names= obj.filter(name => !)
      // console.log('cascas', names)
      response.send(obj);
    }
  });
  //return names;
}

let collectionName = 'mycollection'; // MongoDB requires a collection name.

insertOne.mongodb = function (doc, response) {
  console.log('request')
  mydb.collection(collectionName).remove({})
  // mydb.collection(collectionName).insertOne(doc, function (err, body, header) {
  //   if (err) {
  //     console.log('[mydb.insertOne] ', err.message);
  //     response.send("Error");
  //     return;
  //   }
  //   doc._id = body.id;
  //   response.send(doc);
  // });
}


getAll.mongodb = function (response) {
  var names = [];
  mydb.collection(collectionName).remove({})
  // mydb.collection(collectionName).find({}, { fields: { _id: 0, count: 0 } }).toArray(function (err, result) {
  //   if (!err) {
  //     result.forEach(function (row) {
  //       names.push(row.name);
  //     });
  //     response.json(names);
  //   }
  // });
}

/* Endpoint to greet and add a new visitor to database.
* Send a POST request to localhost:3000/api/visitors with body
* {
*   "name": "Bob"
* }
*/
app.post("/api/visitors", function (request, response) {
  // var {name} = request.body.name;
  var { phone, name, rel } = request.body;
  var data = { phone, name, rel, check: true };
  // console.log('doc')
  if (!mydb) {
    console.log("No database.");
    response.send(data);
    return;
  }
  console.log('vendor', vendor)
  insertOne[vendor](data, response);
});

app.get("/api/users", function (request, response) {
  var names = [];
  if (!mydb) {
    console.log('names', names)
    response.json(names);
    return;
  }
  // console.log('names', response)
  getAll.cloudant(response)
});

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) { }

const appEnvOpts = vcapLocal ? { vcap: vcapLocal } : {}

const appEnv = cfenv.getAppEnv(appEnvOpts);

if (appEnv.services['compose-for-mongodb'] || appEnv.getService(/.*[Mm][Oo][Nn][Gg][Oo].*/)) {
  // Load the MongoDB library.
  var MongoClient = require('mongodb').MongoClient;

  dbName = 'mydb';

  // Initialize database with credentials
  if (appEnv.services['compose-for-mongodb']) {
    MongoClient.connect(appEnv.services['compose-for-mongodb'][0].credentials.uri, null, function (err, db) {
      if (err) {
        console.log(err);
      } else {
        mydb = db.db(dbName);
        console.log("Created database: " + dbName);
      }
    });
  } else {
    // user-provided service with 'mongodb' in its name
    MongoClient.connect(appEnv.getService(/.*[Mm][Oo][Nn][Gg][Oo].*/).credentials.uri, null,
      function (err, db) {
        if (err) {
          console.log(err);
        } else {
          mydb = db.db(dbName);
          console.log("Created database: " + dbName);
        }
      }
    );
  }

  vendor = 'mongodb';
} else if (appEnv.services['cloudantNoSQLDB'] || appEnv.getService(/[Cc][Ll][Oo][Uu][Dd][Aa][Nn][Tt]/)) {
  // Load the Cloudant library.
  var Cloudant = require('@cloudant/cloudant');

  // Initialize database with credentials
  if (appEnv.services['cloudantNoSQLDB']) {
    // CF service named 'cloudantNoSQLDB'
    cloudant = Cloudant(appEnv.services['cloudantNoSQLDB'][0].credentials);
  } else {
    // user-provided service with 'cloudant' in its name
    cloudant = Cloudant(appEnv.getService(/cloudant/).credentials);
  }
} else if (process.env.CLOUDANT_URL) {
  cloudant = Cloudant(process.env.CLOUDANT_URL);
}
if (cloudant) {
  //database name
  dbName = 'mydb';

  // Create a new "mydb" database.
  cloudant.db.create(dbName, function (err, data) {
    if (!err) //err if database doesn't already exists
      console.log("Created database: " + dbName);
  });

  // Specify the database we are going to use (mydb)...
  mydb = cloudant.db.use(dbName);
  // cloudant.db.delete(dbName).remove({})
  vendor = 'cloudant';
}
app.get('/deleteAll', (req, res) => {
  // console.log('mydb.collection(collectionName)', mydb.collection(collectionName))
})
//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/views'));


app.get("/api/weather", (req, res) => {
  return res.send('dcấcsấckjcnajsncjkasnkcnkasncasncjancajksnuc')
})
var port = process.env.PORT || 3000
app.listen(port, function () {
  console.log("To view your app, open this link in your browser: http://localhost:" + port);
});
