const { Logger } = require('@mojaloop/sdk-standard-components').Logger;
const supertest = require('supertest');
const path = require('path');

const App = require(`${__ROOT__}/src/app`); // eslint-disable-line import/no-dynamic-require
const csvParse = require('csv-parse/lib/sync');

const createDbMock = (result) => ({
    query: async (/* qStr, bindings */) => result,
});

// Silent logger- remove the `stringify` option to print logs
const logger = new Logger({ stringify: () => '' });
const db = createDbMock([
    { name: 'fsp1', currency: 'MMK' },
    { name: 'fsp3', currency: 'MMK' },
]);
const mockDefaults = {
    templatesDir: path.join(__dirname, 'templates'),
    db,
    logger,
};

const createMockServer = (opts) => supertest(App({ ...mockDefaults, ...opts }).callback());

const testResponse = (res, { contentType = 'json' } = {}) => {
    expect(Object.keys(res.headers)).toStrictEqual([
        'content-type',
        'content-length',
        'date',
        'connection',
    ]);
    expect(res.headers['content-type']).toEqual(`application/${contentType}`);
};

const testResponseXlsx = (res) => {
    expect(Object.keys(res.headers)).toStrictEqual([
        'last-modified',
        'content-length',
        'content-type',
        'etag',
        'date',
        'connection',
    ]);
    expect(res.headers['content-type']).toEqual('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};

test('able to create server', () => {
    createMockServer();
});

test('able to create server without any reports configured', () => {
    createMockServer({ templatesDir: path.join(__dirname, 'emptyDir') });
});

test('healthcheck passes', async () => {
    const res = await createMockServer().get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual({ status: 'ok' });
    testResponse(res);
});

test('default mock report - CSV - correct response', async () => {
    const res = await createMockServer().get('/test.csv?currency=MMK');
    expect(res.statusCode).toEqual(200);
    expect(csvParse(res.text, { columns: true })).toStrictEqual([
        {
            Currency: 'MMK',
            Name: 'fsp1',
        },
        {
            Currency: 'MMK',
            Name: 'fsp3',
        },
    ]);
    testResponse(res, { contentType: 'csv' });
});

test('query failure results in 500', async () => {
    const res = await createMockServer({ db: { query: () => { throw new Error(); } } })
        .get('/test.csv?currency=MMK');
    expect(res.statusCode).toEqual(500);
    expect(res.body).toStrictEqual({});
    testResponse(res);
});
