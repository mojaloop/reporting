const mysql = require('mysql2');
const { logger } = require('./lib/logger')

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
            queueLimit = 0,
            connectionLimit = 10,
        } = {}
    }) {
        const createPool = () => mysql.createPool(
            {
                host,
                user,
                database,
                password,
                port,
                connectionLimit,
                namedPlaceholders: true,
                waitForConnections: true,
                queueLimit,
                ...additionalConnectionOptions,
            },
        );

        let connPool = createPool();
        this.conn = connPool.promise();

        // Listen for connection errors and recreate pool if lost
        connPool.on('error', (err) => {
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                connPool.end();
                connPool = createPool();
                this.conn = connPool.promise();
                logger.warn('MySQL pool recreated after PROTOCOL_CONNECTION_LOST');
            }
        });
    }

    async query(query, bindings = {}) {
        const isSPCall = (query.match(/^call\s/ig) !== null);
        const result = await this.conn.execute(query, bindings);
        return (isSPCall ? result[0][0] : result[0]);
    }


}

module.exports = Database;
