
const knex = require('knex');

class Database {
    constructor({
        connection: {
            host = '127.0.0.1',
            port = 3306,
            user = 'root',
            password = '',
            database = 'central_ledger',
        } = {},
        pool: {
            min = 0,
            max = 10,
        } = {},
    }) {
        this.conn = knex({
            client: 'mysql2',
            connection: {
                host,
                user,
                password,
                database,
                port,
            },
            pool: {
                min,
                max,
            },
        });
    }

    async query(query, bindings) {
        const isSPCall = query.match(/^call\s/ig);
        const result = await this.conn.raw(query, bindings);
        return (isSPCall === null ? result[0] : result[0][0]);
    }
}

module.exports = Database;
