const { logger } = require('./lib/logger');
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
        additionalConnectionOptions: config.database.additionalConnectionOptions || {},
    },
    pool: {
        max: config.database.dbPoolSizeMax,
    },
    retry: {
        dbRetries: config.database.dbRetries,
        dbConnectionRetryWaitMilliseconds: config.database.dbConnectionRetryWaitMilliseconds,
    }
};

(async () => {
    const db = new Database(dbConfig);
    const app = await createApp({ config, db, logger });

    const { port } = config;
    const host = '0.0.0.0';
    app.listen(port, host, () => (logger.info(`Listening on ${host}:${port}`)));
})();
