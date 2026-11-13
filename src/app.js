const express = require("express");
const cors = require("cors");

const app = express();

//middlewares

app.use(cors());
app.use(express.json()); // lets express read JSON sent in POST requests

//checking api
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Platform API is alive!' });
});



module.exports = app;