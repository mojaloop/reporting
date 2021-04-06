const { Logger } = require('@mojaloop/sdk-standard-components').Logger;

const Database = require('./db');

const dbConfig = {
    connection: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'central_ledger',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_DATABASE || 'central_ledger',
        port: process.env.DB_PORT || 3306,
    },
    pool: {
        connectionLimit: 10,
        queueLimit: 0,
    },
};

const db = new Database(dbConfig);

const logger = new Logger();
const app = require('./app')({ db, logger });

const port = 3000;
const host = '0.0.0.0';
app.listen(port, host, () => (logger.log(`Listening on ${host}:${port}`)));
