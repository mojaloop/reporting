const { Logger } = require('@mojaloop/sdk-standard-components').Logger;
const supertest = require('supertest');
const path = require('path');
const k8s = require('@kubernetes/client-node');
const keto = require('@ory/keto-client');
const defaultConfig = require('./data/defaultConfig.json');
const { parseCsvAsync } = require('../../src/lib/csvparser');


const { createApp } = require('../../src/app');

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
    db,
    logger,
};

const createMockServer = async (opts) => {
    const app = await createApp({ ...mockDefaults, ...opts });
    return supertest(app.callback());
};

const testResponse = (res, { contentType = 'application/json; charset=utf-8' } = {}) => {
    expect(Object.keys(res.headers).sort()).toStrictEqual([
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
        const res = await server.get('/test?dfspId=payerfsp&currency=MMK&format=csv');
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
        const res = await server.get('/test?dfspId=payerfsp&currency=MMK&format=xlsx');
        expect(res.statusCode).toEqual(200);
        testResponseXlsx(res, { contentType: 'application/xlsx' });
    });

    test('perms check', async () => {
        config.oryKetoReadUrl = 'http://localhost:4466';
        const server = await createMockServer({ config });
        const ketoMock = keto.ReadApi.getInstance();
        const userId = 'test-user-id';
        const fspId = 'payerfsp';
        const reportName = 'test';
        ketoMock.getRelationTuples = (ns, obj, rel, subj) => {
            const result = [];
            if (ns === 'participant' && obj === undefined && rel === 'member' && subj === userId) {
                result.push({ object: fspId });
            }
            return {
                data: {
                    relation_tuples: result,
                },
            };
        };
        ketoMock.getCheck = (ns, obj, rel, subj) => {
            let allowed = false;
            if (ns === 'permission' && obj === reportName && rel === 'granted' && subj === userId) {
                allowed = true;
            }
            return {
                data: {
                    allowed,
                },
            };
        };
        const watch = k8s.Watch.getInstance();
        watch.sendResource(path.join(__dirname, 'data/test.yaml'));
        let res = await server.get(`/test?dfspId=${fspId}&currency=MMK&format=xlsx`).set('x-user', userId);
        expect(res.statusCode).toEqual(200);
        testResponseXlsx(res, { contentType: 'application/xlsx' });

        res = await server.get(`/test?dfspId=${fspId}&currency=MMK&format=xlsx`).set('x-user', 'other-user');
        expect(res.statusCode).toEqual(403);

        res = await server.get('/test?dfspId=otherFsp&currency=MMK&format=xlsx').set('x-user', userId);
        expect(res.statusCode).toEqual(403);
    });
});
