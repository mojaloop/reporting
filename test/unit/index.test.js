const { logger } = require('../../src/lib/logger');
const supertest = require('supertest');
const path = require('path');
const k8s = require('@kubernetes/client-node');
const defaultConfig = require('./data/defaultConfig.json');
const { parseCsvAsync } = require('../../src/lib/csvparser');
const { createApp } = require('../../src/app');
const { EVERYTHING, guardReaching, restrictedTo } = require('@mojaloop/authz');

/** What the last query was bound to, so a test can see what a report ran on. */
let bindings = {};
const lastBindings = () => bindings;

const createDbMock = (result) => ({
    query: async (qStr, bound = {}) => {
        bindings = bound;
        return result;
    },
});


const db = createDbMock([
    { name: 'fsp1', currency: 'MMK' },
    { name: 'fsp3', currency: 'MMK' },
]);
const mockDefaults = {
    db,
    logger,
};

const createMockServer = async (opts) => {
    const app = await createApp({ ...mockDefaults, ...opts });
    const server = supertest(app.callback());
    /** What this caller may reach of each type, which is all a handler is given. */
    server.reaching = (access) => {
        app.context.authz = guardReaching(access, 'reports');
        return server;
    };
    return server;
};

const testResponse = (res, { contentType = 'application/json; charset=utf-8' } = {}) => {
    expect(Object.keys(res.headers).sort()).toStrictEqual([
        'access-control-allow-origin',
        'content-type',
        'content-length',
        'date',
        'vary',
        'connection',
    ].sort());
    expect(res.headers['content-type']).toEqual(contentType);
};

const testResponseXlsx = (res) => {
    expect(res.headers['content-type']).toEqual('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};

jest.setTimeout(30000);

describe('report', () => {
    let config;

    beforeEach(() => {
        config = JSON.parse(JSON.stringify(defaultConfig));
    });

    it('able to create server', async () => {
        await createMockServer({ config });
    });

    test('healthcheck passes', async () => {
        const server = await createMockServer({ config });
        const res = await server.get('/');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toStrictEqual({ status: 'ok' });
        testResponse(res);
    });

    test('CSV - correct response', async () => {
        const server = await createMockServer({ config });
        const watch = k8s.Watch.getInstance();
        watch.sendResource(path.join(__dirname, 'data/test.yaml'));
        const res = await server
            .reaching({ participants: restrictedTo(['payerfsp']) })
            .get(`/test?dfspId=payerfsp&currency=MMK&format=csv`);
        expect(res.statusCode).toEqual(200);
        const parsedCsv = await parseCsvAsync(res.text);
        expect(parsedCsv).toStrictEqual([
            {
                Currency: 'MMK',
                Name: 'fsp1',
            },
            {
                Currency: 'MMK',
                Name: 'fsp3',
            },
        ]);
        testResponse(res, { contentType: 'application/csv' });
    });

    test('XLSX - correct response', async () => {
        const server = await createMockServer({ config });
        const watch = k8s.Watch.getInstance();
        watch.sendResource(path.join(__dirname, 'data/test.yaml'));
        const res = await server
            .reaching({ participants: restrictedTo(['payerfsp']) })
            .get(`/test?dfspId=payerfsp&currency=MMK&format=xlsx`);
        expect(res.statusCode).toEqual(200);
        testResponseXlsx(res);
    });

    /**
     * A report that declares what its rows belong to receives the ids its
     * caller holds and filters by them, so asking about somebody else returns
     * their rows to nobody.
     */
    test('a report scoped by a type runs on the ids its caller holds', async () => {
        const server = await createMockServer({ config });
        const fspId = 'payerfsp';
        const watch = k8s.Watch.getInstance();
        watch.sendResource(path.join(__dirname, 'data/test.yaml'));

        let res = await server
            .reaching({ participants: restrictedTo([fspId]) })
            .get(`/test?dfspId=${fspId}&currency=MMK&format=xlsx`);
        expect(res.statusCode).toEqual(200);
        testResponseXlsx(res);
        expect(lastBindings()).toMatchObject({ participants: fspId });

        res = await server
            .reaching({ participants: restrictedTo([fspId]) })
            .get(`/test?dfspId=otherFsp&currency=MMK&format=xlsx`);
        expect(res.statusCode).toEqual(200);
        expect(lastBindings()).toMatchObject({ dfspId: 'otherFsp', participants: fspId });

        res = await server
            .reaching({ participants: EVERYTHING })
            .get(`/test?dfspId=otherFsp&currency=MMK&format=xlsx`);
        expect(res.statusCode).toEqual(200);
        testResponseXlsx(res);
        expect(lastBindings()).toMatchObject({ participants: null });
    });

    /**
     * A report that declares nothing is about every one of them, so it cannot
     * answer a caller who holds only some.
     */
    test('a report nothing narrows is refused to a caller holding some', async () => {
        const server = await createMockServer({ config });
        const watch = k8s.Watch.getInstance();
        watch.sendResource(path.join(__dirname, 'data/hubwide.yaml'));

        let res = await server
            .reaching({ participants: restrictedTo(['payerfsp']) })
            .get('/hubwide?currency=MMK&format=xlsx');
        expect(res.statusCode).toEqual(403);

        res = await server
            .reaching({ participants: EVERYTHING })
            .get('/hubwide?currency=MMK&format=xlsx');
        expect(res.statusCode).toEqual(200);
    });

    /**
     * The path a report declares is also the id a grant names it by, so the
     * two must agree character for character: a report answering on a spelling
     * nobody can be granted would be unreachable, and one answering on several
     * spellings would need a grant for each.
     */
    test('a report answers on the path it declares and no other spelling', async () => {
        const server = await createMockServer({ config });
        const watch = k8s.Watch.getInstance();
        watch.sendResource(path.join(__dirname, 'data/mixedCase.yaml'));

        server.reaching({ participants: EVERYTHING });

        let res = await server.get('/dfspSettlement?currency=MMK&format=csv');
        expect(res.statusCode).toEqual(200);

        res = await server.get('/dfspsettlement?currency=MMK&format=csv');
        expect(res.statusCode).toEqual(404);
    });
});
