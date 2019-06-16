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

var updateDocument = function (callback) {
  console.log("Updating document 'mydoc'");
  // make a change to the document, using the copy we kept from reading it back
  doc.c = true;
  db.insert(doc, function (err, data) {
    console.log('Error:', err);
    console.log('Data:', data);
    // keep the revision of the update so we can delete it
    doc._rev = data.rev;
    callback(err, data);
  });
};
getAll.cloudant = function (response) {
  var names = [];
  mydb.list({ include_docs: true }, function (err, body) {
    if (!err) {
      body.rows.forEach(function (row) {
        if (row.doc.name && row.doc.relationship)
          names.push(row.doc);
      });
      response.json(names);
    }
  });
  //return names;
}
getAll.follow = function (res) {
  var names = [];
  mydb.list({ include_docs: true }, function (err, body) {
    if (!err) {
      const arr = [
        0956947563,
        0915460230
      ]
      // body.rows
      // arr.filter(item => body.rows)
      body.rows.filter(item => {
        return arr.includes(item.doc.phone)
      }).forEach(function (row) {
        console.log('row rowrow row', row)
        if (row.doc.name && row.doc.relationship)
          names.push(row.doc);
      });
      res.json(names);
    }
  });
}

let collectionName = 'mycollection'; // MongoDB requires a collection name.

insertOne.mongodb = function (doc, response) {
  mydb.collection(collectionName).insertOne(doc, function (err, body, header) {
    if (err) {
      console.log('[mydb.insertOne] ', err.message);
      response.send("Error");
      return;
    }
    doc._id = body.id;
    response.send(doc);
  });
}

getAll.mongodb = function (response) {
  var names = [];
  mydb.collection(collectionName).find({}, { fields: { _id: 0, count: 0 } }).toArray(function (err, result) {
    if (!err) {
      result.forEach(function (row) {
        names.push(row.name);
      });
      response.json(names);
    }
  });
}

/* Endpoint to greet and add a new visitor to database.
* Send a POST request to localhost:3000/api/visitors with body
* {
*   "name": "Bob"
* }
*/
var ok = true

app.post("/api/visitors", function (request, response) {

  ok = !ok
  console.log('response.body', response.body)
  const { name, phone, lastLocation, closed, relationship, latutude, longitude } = request.body

  // var  = request.body;
  var doc = { name, phone, lastLocation, closed, safe: ok, relationship, latlng: { latutude, longitude } }
  console.log('result', doc)
  if (!mydb) {
    console.log("No database.");
    response.send(doc);
    return;
  }
  insertOne[vendor](doc, response);
});


app.get("/api/users", function (request, response) {
  var names = [];
  if (!mydb) {
    response.json(names);
    return;
  }
  getAll[vendor](response);
});

app.get('/api/profile', function (req, res) {
  return res.send({
    name: "Nguyen Minh Duc",
    phone: 919259462,
    lastLocation: "Học viện CNTT Bách Khoa",
    closed: [
      "0913856293",
      "0913945073",
      "0927479395",
      // "919259462"
    ],
    safe: false,
    relationship: "father",
    latlng: {
      latutude: 21.003817,
      longitude: 105.847747,
    }
  })
})
app.get('/api/follow', (req, res) => {
  getAll.follow(res)
})

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

  vendor = 'cloudant';
}

//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/views'));



var port = process.env.PORT || 3000
app.listen(port, function () {
  console.log("To view your app, open this link in your browser: http://localhost:" + port);
});

// tate = {
//   me: {
//       name: 'Undefined Team',
//       phone: '123760340239',
//       lastLocation: 'Dong Da, Hanoi, Vietnam',
//       closed: ['1234567890', '0987654321'],
//       safe: true,
//       latlng: {
//           latitude: 21.003817,
//           longitude: 105.847747,
//       }
//   },
//   following: [
//       {
//           name: 'Abcde',
//           phone: '123760340239',
//           lastLocation: 'Dong Da, Hanoi, Vietnam',
//           closed: ['1234567890', '0987654321'],
//           safe: true,
//           latlng: {
//               latitude: 21.013817,
//               longitude: 105.846747,
//           }
//       },
//       {
//           name: 'Bcdefg',
//           phone: '123760340239',
//           lastLocation: 'Dong Da, Hanoi, Vietnam',
//           closed: ['1234567890', '0987654321'],
//           safe: true,
//           latlng: {
//               latitude: 21.002817,
//               longitude: 105.844747,
//           }
//       },
//   ],

// }
// }