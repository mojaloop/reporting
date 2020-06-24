const mysql = require('mysql2');

class Database {
    async init({
        connection: {
            host = '127.0.0.1',
            port = 3306,
            user = 'central_ledger',
            password = '',
            database = 'central_ledger',
        } = {},
        pool: {
            queueLimit = 0,
            connectionLimit = 10,
        } = {},
    }) {
        const connPool = mysql.createPool(
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
            },
        );
        this.conn = connPool.promise();
    }

    async query(query, bindings) {
        const isSPCall = null !== query.match(/^call\s/ig);
        const result = await this.conn.execute(query, bindings);
        return (isSPCall ? result[0][0] : result[0]);
    }
}

module.exports = Database;
