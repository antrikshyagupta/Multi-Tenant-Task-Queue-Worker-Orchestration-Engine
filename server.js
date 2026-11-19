require('dotenv').config() ;
const logger = require('./src/config/logger');
const app = require("./src/app");

const PORT = process.env.PORT || 3000;


app.listen(PORT, () =>{
    logger.info(`server is running on port ${PORT}`)
}); 

