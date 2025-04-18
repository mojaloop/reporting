const parse = require('csv-parse');

const parseCsvAsync = (input) => {
    const csvOptions = {
        columns: true,
        delimiter: ',',
        ltrim: true,
        rtrim: true,
    };
    return new Promise((resolve, reject) => {
        parse(input, csvOptions, (err, records) => {
            if (err) return reject(err);
            return resolve(records);
        });
    });
};

module.exports = {
    parseCsvAsync,
};
