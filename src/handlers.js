
const assert = require('assert').strict;
const qs = require('querystring');

const matchAll = require('string.prototype.matchall');
const fromEntries = require('object.fromentries');

const healthCheck = async (ctx) => {
    ctx.response.status = 200;
    ctx.response.body = { status: 'ok' };
};

const createReportHandlers = (reportsConfig) => {
    const handlerMapRoutes = Object.keys(module.exports.handlerMap);

    const createReportHandler = ([route, query]) => {
        // Check that the report route doesn't replace any static routes
        assert(!handlerMapRoutes.includes(route));
        // Check that the report route does not have a trailing slash
        assert(route.substr(-1) !== '/');

        const paramRegex = /\$P{([^}{]*)}/g;
        const params = [...matchAll(query, paramRegex)];
        // Ensure that every parameter has a name inside the curly braces of $P{}
        params.forEach(p => assert(
            p.length > 1,
            `Loading report config: report parameter for route ${route} did not contain a name`
        ));
        // Convert the query in the config into a database query template containing named bindings
        const dbQuery = params.reduce((q, param) => q.replace(param[0], `:${param[1]}`), query);
        const paramNames = params.map(p => p[1]);
        const handler = {
            get: async (ctx) => {
                const requestErrors = [
                    // User did not provide all necessary query parameters
                    ...paramNames
                        .filter(pn => !ctx.request.URL.searchParams.has(pn))
                        .map(pn => `Missing parameter in querystring: ${pn}`),
                    // User provided a querystring with duplicated params/args, such as ?q=a&q=b
                    ...paramNames
                        .filter(pn => ctx.request.URL.searchParams.getAll(pn).length > 1)
                        .map(pn => `Only one argument allowed for query param ${pn}`),
                    // User provided a querystring parameter not in our allowed list
                    ...[...ctx.request.URL.searchParams.keys()]
                        .filter(pn => !paramNames.includes(pn))
                        .map(pn => `queryparam ${pn} not supported by this report`),
                    // User did not provide a value for a query parameter
                    ...[...ctx.request.URL.searchParams.entries()]
                        .filter(([, arg]) => !arg)
                        .map(([param, ]) => `queryparam ${param} must have a value supplied`),
                ]

                ctx.assert(
                    requestErrors.length === 0,
                    400,
                    {
                        message: 'Errors in request',
                        errors: requestErrors,
                    },
                );

                const queryArgs = fromEntries(ctx.request.URL.searchParams.entries());
                const result = await ctx.db.query(dbQuery, queryArgs);
                ctx.response.body = result;
            },
        };
        return [route, handler];
    }

    return fromEntries(Object.entries(reportsConfig).map(createReportHandler));
}

module.exports = {
    createReportHandlers,
    handlerMap: {
        '/': {
            get: healthCheck,
        },
    },
};
