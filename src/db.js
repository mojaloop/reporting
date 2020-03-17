
const knex = require('knex');

class Database {
    constructor({
        connection: {
            host = '127.0.0.1',
            port = 3306,
            user = 'root',
            password = '',
            database = 'root',
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
            },
            pool: {
                min,
                max,
            },
        });
    }

    async query(query, bindings) {
        return (await this.conn.raw(query, bindings))[0];
    }
}

module.exports = Database;
