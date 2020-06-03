
const { Logger, transports } = require('el-logger'); // eslint-disable-line no-unused-vars
const supertest = require('supertest');

const App = require(`${__ROOT__}/src/app`); // eslint-disable-line import/no-dynamic-require
const csvParse = require('csv-parse/lib/sync');

// TO TEST
// - bad settings provided to the app, e.g. bad reports
// - reports with zero parameters
// - reports with duplicated parameters
// - multiple problems with querystring
// - generate some 500s

const createDbMock = (result) => ({
    query: async (/* qStr, bindings */) => [result],
});

// uncomment the stdout transport to see logs during your test run
const logger = new Logger({ transports: [/* transports.stdout() */] });
const db = createDbMock({ colName: 'result' });
const mockDefaults = {
    reportsConfig: {
        '/test': 'SELECT * FROM user WHERE id = $P{userId}',
    },
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
        'content-type',
        'last-modified',
        'etag',
        'date',
        'connection',
        'transfer-encoding',
    ]);
    expect(res.headers['content-type']).toEqual('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};

test('able to create server', () => {
    createMockServer();
});

test('able to create server without any reports configured', () => {
    createMockServer({ reportsConfig: {} });
});

test('report route containing trailing slash fails assertion', () => {
    const t = () => createMockServer({ reportsConfig: { '/blah/': 'test' } });
    expect(t).toThrow(/^Report route .* cannot contain a trailing slash$/);
});

test('healthcheck passes', async () => {
    const res = await createMockServer().get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual({ status: 'ok' });
    testResponse(res);
});

test('default mock report - CSV - correct response', async () => {
    const res = await createMockServer().get('/test.csv?userId=1');
    expect(res.statusCode).toEqual(200);
    expect(csvParse(res.text, { columns: true })).toStrictEqual([{ colName: 'result' }]);
    testResponse(res, { contentType: 'csv' });
});

test('default mock report - JSON - correct response', async () => {
    const res = await createMockServer().get('/test.json?userId=1');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual([{ colName: 'result' }]);
    testResponse(res);
});

test('default mock report - XLSX - correct response', async () => {
    const res = await createMockServer().get('/test.xlsx?userId=1');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual({});
    testResponseXlsx(res, { contentType: 'xlsx' });
});

test('report query missing parameter name results in handler build failure', async () => {
    const t = () => createMockServer({ reportsConfig: { '/blah': '$P{}' } });
    expect(t).toThrow(/^Loading report config: report parameter \$P\{\} for route \/blah\.(json|csv) did not contain a name$/);
});

test('query failure results in 500', async () => {
    const res = await createMockServer({ db: { query: () => { throw new Error(); } } })
        .get('/test.json?userId=1');
    expect(res.statusCode).toEqual(500);
    expect(res.body).toStrictEqual({});
    testResponse(res);
});

test('default mock report - correct query and bindings received by database', async () => {
    expect.assertions(4);
    const reportsConfig = {
        '/t': '$P{arg0}$P{arg1}$P{arg2}',
    };
    const res = await createMockServer({
        reportsConfig,
        db: {
            query: (query, bindings) => {
                expect(query).toEqual(':arg0:arg1:arg2');
                expect(bindings).toStrictEqual({
                    arg0: 'a',
                    arg1: 'b',
                    arg2: 'c',
                });
                return ['blah'];
            },
        },
    }).get('/t.json?arg0=a&arg1=b&arg2=c');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual(['blah']);
});

test('default mock report - missing queryparam', async () => {
    const res = await createMockServer().get('/test.json');
    expect(res.statusCode).toEqual(400);
    expect(res.body).toStrictEqual({
        message: 'Errors in request',
        errors: ['Missing parameter in querystring: userId'],
    });
    testResponse(res);
});

test('default mock report - missing queryparam value', async () => {
    const res = await createMockServer().get('/test.json?userId=');
    expect(res.statusCode).toEqual(400);
    expect(res.body).toStrictEqual({
        message: 'Errors in request',
        errors: ['queryparam userId must have a value supplied'],
    });
    testResponse(res);
});

test('default mock report - duplicated queryparam', async () => {
    const res = await createMockServer().get('/test.json?userId&userId=1');
    expect(res.statusCode).toEqual(400);
    expect(res.body).toStrictEqual({
        message: 'Errors in request',
        errors: [
            'Only one argument allowed for queryparam userId',
            'queryparam userId must have a value supplied',
        ],
    });
    testResponse(res);
});

test('default mock report - extra queryparam', async () => {
    const res = await createMockServer().get('/test.json?hello&userId=1');
    expect(res.statusCode).toEqual(400);
    expect(res.body).toStrictEqual({
        message: 'Errors in request',
        errors: ['queryparam hello not supported by this report'],
    });
    testResponse(res);
});

test('default mock report - optional query parameter provided - correct query and bindings received by database', async () => {
    expect.assertions(4);
    const reportsConfig = {
        '/t': '$P{arg0}$P{arg1}$O{arg2}',
    };
    const res = await createMockServer({
        reportsConfig,
        db: {
            query: (query, bindings) => {
                expect(query).toEqual(':arg0:arg1:arg2');
                expect(bindings).toStrictEqual({
                    arg0: 'a',
                    arg1: 'b',
                    arg2: 'c',
                });
                return ['blah'];
            },
        },
    }).get('/t.json?arg0=a&arg1=b&arg2=c');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual(['blah']);
});

test('default mock report - optional query parameter omitted - correct query and bindings received by database', async () => {
    expect.assertions(4);
    const reportsConfig = {
        '/t': '$P{arg0}$P{arg1}$O{arg2}',
    };
    const res = await createMockServer({
        reportsConfig,
        db: {
            query: (query, bindings) => {
                expect(query).toEqual(':arg0:arg1:arg2');
                expect(bindings).toStrictEqual({
                    arg0: 'a',
                    arg1: 'b',
                    arg2: null,
                });
                return ['blah'];
            },
        },
    }).get('/t.json?arg0=a&arg1=b');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual(['blah']);
});

test('default mock report - optional query parameter value omitted - correct query and bindings received by database', async () => {
    expect.assertions(4);
    const reportsConfig = {
        '/t': '$P{arg0}$P{arg1}$O{arg2}',
    };
    const res = await createMockServer({
        reportsConfig,
        db: {
            query: (query, bindings) => {
                expect(query).toEqual(':arg0:arg1:arg2');
                expect(bindings).toStrictEqual({
                    arg0: 'a',
                    arg1: 'b',
                    arg2: null,
                });
                return ['blah'];
            },
        },
    }).get('/t.json?arg0=a&arg1=b&arg2=');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual(['blah']);
});
