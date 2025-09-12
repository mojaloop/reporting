/** ************************************************************************
 *  (C) Copyright ModusBox Inc. 2021 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha - yevhen.kyriukha@modusbox.com                   *
 ************************************************************************* */

require('dotenv/config');
const env = require('env-var');

const config = {
    oryKetoReadUrl: env.get('ORY_KETO_READ_URL').asUrlString(),
    userIdHeader: env.get('USER_ID_HEADER').default('x-user').asString(),
    port: env.get('PORT').default('3000').asPortNumber(),
    templatesDir: env.get('TEMPLATES_DIR').asString(),
    pathPrefix: env.get('PATH_PREFIX').default('/api/reports').asString(),
    database: {
        host: env.get('DB_HOST').default('localhost').asString(),
        port: env.get('DB_PORT').default('3306').asPortNumber(),
        user: env.get('DB_USER').default('central_ledger').asString(),
        password: env.get('DB_PASSWORD').default('password').asString(),
        database: env.get('DB_DATABASE').default('central_ledger').asString(),
        connectionLimit: env.get('DB_POOL_CONNECTION_LIMIT').default('10').asInt(),
        queueLimit: env.get('DB_POOL_QUEUE_LIMIT').default('0').asInt(),
        additionalConnectionOptions: env.get('DB_ADDITIONAL_CONNECTION_OPTIONS').default('{}').asJsonObject(),
        dbRetries: env.get('DB_RETRIES').default('10').asInt(),
        dbConnectionRetryWaitMilliseconds: env.get('DB_CONNECTION_RETRY_WAIT_MILLISECONDS')
            .default('1000')
            .asInt(),
        dbPoolSizeMax: env.get('DB_POOL_SIZE_MAX').asInt()
    },
    operator: {
        resourceGroup: env.get('WATCH_RESOURCE_GROUP').default('mojaloop.io').asString(),
        resourceVersion: env.get('WATCH_RESOURCE_VERSION').default('v1').asString(),
        namespace: env.get('WATCH_NAMESPACE').default('default').asString(),
        resourcePlural: env.get('WATCH_RESOURCE_PLURAL').default('mojaloopreports').asString(),
        validationRetryCount: env.get('VALIDATION_RETRY_COUNT').default('10').asInt(),
        validationRetryIntervalMs: env.get('VALIDATION_RETRY_INTERVAL_MS').default('10000').asInt(),
    },
};

// SSL logic for MySQL connection
if (env.get('DB_SSL_ENABLED').default('false').asBool()) {
    config.database.additionalConnectionOptions = config.database.additionalConnectionOptions || {};
    config.database.additionalConnectionOptions.ssl = {
        rejectUnauthorized: env.get('DB_SSL_VERIFY').default('false').asBool(),
    };
    const sslCa = env.get('DB_SSL_CA').default('').asString();
    if (sslCa) {
        config.database.additionalConnectionOptions.ssl.ca = sslCa;
    }
}

module.exports = config;
