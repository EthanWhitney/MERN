require('dotenv').config();

const express = require('express');
const cors = require('cors');

const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb+srv://ma058102:group4@mern.7inupbn.mongodb.net/?appName=MERN';

const client = new MongoClient(url);
client.connect();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const serverRoutes = require('./routes/serverRoutes');
const sendGridRoutes = require('./routes/sendGridRoutes');

const app = express();
app.use(cors());
// app.use(bodyParser.json());
app.use(express.json());

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/sendgrid', sendGridRoutes);

app.post('/api/addcard', async (req, res, next) =>
{
  // incoming: userId, color
  // outgoing: error
	
  const { userId, card } = req.body;

  const newCard = {Card:card,UserId:userId};
  var error = '';

  try
  {
    const db = client.db('COP4331Cards');
    const result = db.collection('Cards').insertOne(newCard);
  }
  catch(e)
  {
    error = e.toString();
  }

  var ret = { error: error };
  res.status(200).json(ret);
});

app.post('/api/login', async (req, res, next) => 
{
  // incoming: login, password
  // outgoing: id, firstName, lastName, error
	
 var error = '';

  const { login, password } = req.body;

  const db = client.db('COP4331Cards');
  const results = await db.collection('Users').find({Login:login,Password:password}).toArray();

  var id = -1;
  var fn = '';
  var ln = '';

  if( results.length > 0 )
  {
    id = results[0].UserID;
    fn = results[0].FirstName;
    ln = results[0].LastName;
  }

  var ret = { id:id, firstName:fn, lastName:ln, error:''};
  res.status(200).json(ret);
});

app.post('/api/searchcards', async (req, res, next) => 
{
  // incoming: userId, search
  // outgoing: results[], error

  var error = '';

  try
  {
    const { userId, search } = req.body;

    var _search = search.trim();
    
    const db = client.db('COP4331Cards');
    const results = await db.collection('Cards').find({"Card":{$regex:_search+'.*', $options:'i'}}).toArray();
    
    var _ret = [];
    for( var i=0; i<results.length; i++ )
    {
      _ret.push( results[i].Card );
    }
    var ret = { results: _ret, error: error };
    res.status(200).json(ret);
  }
  catch(e)
  {
    error = e.toString();
    var ret = { results: [], error: error };
    res.status(500).json(ret);
  }
});

app.use((req, res, next) => 
{

  app.get("/api/ping", (req, res, next) => {
	res.status(200).json({ message: "Hello World" });
  });
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  next();
});

app.listen(5000); // start Node + Express server on port 5000