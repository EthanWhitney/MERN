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
const profileRoutes = require('./routes/profileRoutes');
const api = require('./api');

const app = express();
app.use(cors());
// app.use(bodyParser.json());
app.use(express.json());

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/sendgrid', sendGridRoutes);
app.use('/api/profile', profileRoutes);

// Initialize API endpoints
api.setApp(app, client);

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
