const { KnexWrapper } = require('@mojaloop/central-services-shared/src/mysql');
const metrics = require('@mojaloop/central-services-metrics');
const { logger } = require('./lib/logger');

class Database {
    constructor({
        connection: {
            host = '127.0.0.1',
            port = 3306,
            user = 'central_ledger',
            password = '',
            database = 'central_ledger',
            additionalConnectionOptions = {},
        } = {},
        pool: {
            min = 0,
            max = 10,
        } = {},
        retry: {
            dbRetries = 10,
            dbConnectionRetryWaitMilliseconds = 1000,
        } = {}
    }) {
        const knexOptions = {
            client: 'mysql2',
            connection: {
                host,
                port,
                user,
                password,
                database,
                ...additionalConnectionOptions,
            },
            pool: { min, max }
        }
        const retryOptions = {
            retries: dbRetries,
            minTimeout: dbConnectionRetryWaitMilliseconds,
            factor: 1.3,
        };

        this.conn = new KnexWrapper({
          knexOptions,
          retryOptions,
          logger,
          metrics,
          context: 'REPORTING_DB'
        });
    }

    async query(query, bindings = {}) {
        // Knex uses ? for positional bindings or :key for named bindings
        // If bindings is an array, use positional; if object, use named
        const result = await this.conn.raw(query, bindings);
        // For stored procedures, result[0] is the rows
        const isSPCall = /^call\s/i.test(query);
        return isSPCall ? result[0][0] : result[0];
    }

    /**
     * Checks the health status of the database by verifying the latest migration lock.
     *
     * @async
     * @returns {Promise<boolean>} Resolves to `true` if the migration lock is not active (healthy), or `false` if it is locked (unhealthy).
     */
    async getHealth() {
        // Check the latest migration lock status
        const result = await this.conn
            .knex('migration_lock')
            .select('is_locked AS isLocked')
            .orderBy('index', 'desc')
            .first();

        return result && result.isLocked === 0;
    }
}

module.exports = Database;
