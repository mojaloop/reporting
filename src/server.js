const { Logger } = require('@mojaloop/sdk-standard-components').Logger;
const path = require('path');
const Database = require('./db');
const config = require('./config');

const dbConfig = {
    connection: {
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        port: config.database.port,
    },
    pool: {
        connectionLimit: config.database.connectionLimit,
        queueLimit: config.database.queueLimit,
    },
};

const db = new Database(dbConfig);

const logger = new Logger();
const templatesDir = config.templatesDir || path.join(__dirname, '..', 'templates');
const app = require('./app')({ templatesDir, db, logger });

const { port } = config;
const host = '0.0.0.0';
app.listen(port, host, () => (logger.log(`Listening on ${host}:${port}`)));
