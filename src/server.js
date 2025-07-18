const { Logger } = require('@mojaloop/sdk-standard-components').Logger;
const Database = require('./db');
const config = require('./config');
const { createApp } = require('./app');

const dbConfig = {
    connection: {
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        port: config.database.port,
        additionalConnectionOptions: config.database.additionalConnectionOptions || {}
    },
    pool: {
        connectionLimit: config.database.connectionLimit,
        queueLimit: config.database.queueLimit,
    },
};

(async () => {
    const db = new Database(dbConfig);

    const logger = new Logger();
    const app = await createApp({ config, db, logger });

    const { port } = config;
    const host = '0.0.0.0';
    app.listen(port, host, () => (logger.log(`Listening on ${host}:${port}`)));
})();
