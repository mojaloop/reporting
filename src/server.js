
const { Logger, transports } = require('el-logger');

const Database = require('./db');
const reportsConfig = require('../config/reports.json');
const dbConfig = require('../config/db.json');

const db = new Database(dbConfig);

const logger = new Logger({ transports: [transports.stdout()] })
const app = require('./app')({ db, reportsConfig, logger });

app.listen(3000, logger.log('Listening on port 3000...'));
