
const { Logger, transports } = require('el-logger');
const supertest = require('supertest');
const App = require(`${__ROOT__}/src/app`);

// TO TEST
// - bad settings provided to the app, e.g. bad reports
// - reports with zero parameters
// - reports with duplicated parameters
// - multiple problems with querystring
// - generate some 500s

const createDbMock = (result) => ({
    query: async (qStr, bindings) => [result]
});

const logger = new Logger({ transports: [transports.stdout()] });
const db = createDbMock('result');
const reportsConfig = {
    '/test': 'SELECT * FROM user WHERE id = $P{userId}',
};
const mockDefaults = {
    reportsConfig,
    db,
    logger,
};

const createMockServer = (opts) => {
    return supertest(App({ ...mockDefaults, ...opts }).callback());
};

const testResponseInvariants = (res) => {
    expect(Object.keys(res.headers)).toStrictEqual([
        'content-type',
        'content-length',
        'date',
        'connection'
    ]);
    expect(res.headers['content-type']).toEqual('application/json');
};

test('able to create server', () => {
    createMockServer();
});

test('able to create server without any reports configured', () => {
    createMockServer({ reportsConfig: {} });
});

test('report route overriding healthcheck fails assertion', () => {
    const t = () => createMockServer({ reportsConfig: { '/': 'test' } });
    expect(t).toThrow(/^Configured report route .* would override static route with same path$/);
});

test('report route containing trailing slash fails assertion', () => {
    const t = () => createMockServer({ reportsConfig: { '/blah/': 'test' } });
    expect(t).toThrow(/^Report route .* cannot contain a trailing slash$/);
});

test('healthcheck passes', async () => {
    const res = await createMockServer().get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual({ status: 'ok' });
    testResponseInvariants(res);
});

test('default mock report - correct request', async () => {
    const res = await createMockServer().get('/test?userId=1');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual([ 'result' ]);
    testResponseInvariants(res);
});

test('query failure results in 500', async () => {
    const res = await createMockServer({ db: { query: () => { throw new Error() } } })
        .get('/test?userId=1');
    expect(res.statusCode).toEqual(500);
    expect(res.body).toStrictEqual({});
    testResponseInvariants(res);
});

test.only('default mock report - correct query and bindings received by database', async () => {
    expect.assertions(4);
    const reportsConfig = {
        '/t': '$P{arg0}$P{arg1}$P{arg2}'
    };
    const res = await createMockServer({
        reportsConfig,
        db: {
            query: (query, bindings) => {
                expect(qArg).toEqual(':arg0:arg1:arg2');
                expect(bindings).toStrictEqual({
                    arg0: 'a',
                    arg1: 'b',
                    arg2: 'c',
                });
                return ['blah'];
            },
        },
    }).get('/t?arg0=a&arg1=b&arg2=c');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual(['blah']);
});

test('default mock report - missing queryparam', async () => {
    const res = await createMockServer().get('/test');
    expect(res.statusCode).toEqual(400);
    expect(res.body).toStrictEqual({
        message: 'Errors in request',
        errors: ['Missing parameter in querystring: userId'],
    });
    testResponseInvariants(res);
});

test('default mock report - missing queryparam value', async () => {
    const res = await createMockServer().get('/test?userId=');
    expect(res.statusCode).toEqual(400);
    expect(res.body).toStrictEqual({
        message: 'Errors in request',
        errors: ['queryparam userId must have a value supplied'],
    });
    testResponseInvariants(res);
});

test('default mock report - duplicated queryparam', async () => {
    const res = await createMockServer().get('/test?userId&userId=1');
    expect(res.statusCode).toEqual(400);
    expect(res.body).toStrictEqual({
        message: 'Errors in request',
        errors: [
            'Only one argument allowed for queryparam userId',
            'queryparam userId must have a value supplied'
        ],
    });
    testResponseInvariants(res);
});

test('default mock report - extra queryparam', async () => {
    const res = await createMockServer().get('/test?hello&userId=1');
    expect(res.statusCode).toEqual(400);
    expect(res.body).toStrictEqual({
        message: 'Errors in request',
        errors: ['queryparam hello not supported by this report'],
    });
    testResponseInvariants(res);
});
