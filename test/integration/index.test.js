
const { Logger } = require('el-logger');
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

const logger = new Logger();
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

test('healthcheck passes', async () => {
    const res = await createMockServer().get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual({ status: 'ok' });
});

test('default mock report - correct request', async () => {
    const res = await createMockServer().get('/test?userId=1');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toStrictEqual([ 'result' ]);
});

test('default mock report - missing queryparam value', async () => {
    const res = await createMockServer().get('/test');
    expect(res.statusCode).toEqual(400);
    console.log(res);
    console.log(res.body);
    // expect(res.body).toStrictEqual({
    //     msg: 'Errors in request',
    //     errors: ['queryparam userId must have a value supplied'],
    // });
});
