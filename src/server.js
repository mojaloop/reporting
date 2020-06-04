
const { Logger } = require('@mojaloop/sdk-standard-components').Logger;

const Database = require('./db');
const reportsConfig = require('../config/reports.json');

const dbConfig = {
    connection: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_DATABASE || 'central_ledger',
    },
    pool: {
        min: 1,
        max: 10,
    },
};

const db = new Database(dbConfig);

const logger = new Logger();
const app = require('./app')({ db, reportsConfig, logger });

const port = 3000;
const host = '0.0.0.0';
app.listen(port, host, () => (logger.log(`Listening on ${host}:${port}`)));
