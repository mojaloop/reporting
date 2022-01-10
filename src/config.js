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

module.exports = {
    oryKetoReadUrl: env.get('ORY_KETO_READ_URL').asUrlString(),
    userIdHeader: env.get('USER_ID_HEADER').default('x-user').asString(),
    port: env.get('PORT').default('3000').asPortNumber(),
    templatesDir: env.get('TEMPLATES_DIR').asString(),
    database: {
        host: env.get('DB_HOST').default('localhost').asString(),
        port: env.get('DB_PORT').default('3306').asPortNumber(),
        user: env.get('DB_USER').default('central_ledger').asString(),
        password: env.get('DB_PASSWORD').default('password').asString(),
        database: env.get('DB_DATABASE').default('central_ledger').asString(),
        connectionLimit: env.get('DB_POOL_CONNECTION_LIMIT').default('10').asInt(),
        queueLimit: env.get('DB_POOL_QUEUE_LIMIT').default('0').asInt(),
    },
    operator: {
        resourceGroup: env.get('WATCH_RESOURCE_GROUP').default('mojaloop.io').asString(),
        resourceVersion: env.get('WATCH_RESOURCE_VERSION').default('v1').asString(),
        namespace: env.get('WATCH_NAMESPACE').default('default').asString(),
        resourcePlural: env.get('WATCH_RESOURCE_PLURAL').default('mojaloopreports').asString(),
    },
};
