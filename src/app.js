const express = require("express");
const cors = require("cors");
const tenantRoutes = require('./routes/tenant.routes');
const jobRoutes = require('./routes/job.routes');
const pinoHttp = require('pino-http');
const logger = require('./config/logger');

const app = express();

//middlewares

app.use(cors());
app.use(express.json()); // lets express read JSON sent in POST requests


 //pino 
 app.use(pinoHttp({ logger }));


//checking api
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Platform API is alive!' });
});

//Tenant Routes :  final URL => POST /api/v1/tenants/register
app.use('/api/v1/tenants', tenantRoutes);

// Mount alongside your tenant routes:
app.use('/api/v1/jobs', jobRoutes);

// Centralized JSON error handler
app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled request error');
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;