const express = require("express");
const cors = require("cors");
const tenantRoutes = require('./routes/tenant.routes');

const app = express();

//middlewares

app.use(cors());
app.use(express.json()); // lets express read JSON sent in POST requests

//checking api
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Platform API is alive!' });
});

//Tenant Routes :  final URL => POST /api/v1/tenants/register
app.use('/api/v1/tenants', tenantRoutes);



module.exports = app;