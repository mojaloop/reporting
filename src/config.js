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
    userTokenHeaderName: env.get('USER_TOKEN_HEADER_NAME').default('token_id').asString(),
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
};
