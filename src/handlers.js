
const assert = require('assert').strict;

const matchAll = require('string.prototype.matchall');
const fromEntries = require('object.fromentries');

const healthCheck = async (ctx) => {
    ctx.response.status = 200;
    ctx.response.body = { status: 'ok' };
    ctx.response.set('content-type', 'application/json');
};

const getParams = (query) => {
    const requiredParamRegex = /\$P{([^}{]*)}/g;
    const requiredParams = [...matchAll(query, requiredParamRegex)];

    const optionalParamRegex = /\$O{([^}{]*)}/g;
    const optionalParams = [...matchAll(query, optionalParamRegex)];

    return { requiredParams, optionalParams };
};

const validateHandler = ([route, query]) => {
    // Check that the report route doesn't replace any static routes
    const handlerMapRoutes = Object.keys(module.exports.handlerMap);
    assert(!handlerMapRoutes.includes(route),
        `Configured report route "${route}" would override static route with same path`);
    // Check that the report route does not have a trailing slash
    const splitRoute = route.split('.');
    assert(
        splitRoute[splitRoute.length - 2].substr(-1) !== '/',
        `Report route ${route} cannot contain a trailing slash`,
    );

    const { requiredParams, optionalParams } = getParams(query);

    const params = [...requiredParams, ...optionalParams];

    // Ensure that every parameter has a name inside the curly braces of $P{}
    params.forEach((p) => assert(
        p[1].length > 0,
        `Loading report config: report parameter ${p[0]} for route ${route} did not contain a name`,
    ));
};

const validateReportHandlers = (reportsConfig) => {
    Object.entries(reportsConfig).map(validateHandler);
};

const createReportHandlers = (reportsConfig) => {
    const createReportHandler = ([route, query]) => {
        // validateHandler(handlerMapRoutes, route, query)

        const { requiredParams, optionalParams } = getParams(query);
        const params = [...requiredParams, ...optionalParams];

        // Build the optional param default object here (once) for later use
        const optionalParamDefaults = Object.assign(
            {}, ...optionalParams.map((p) => ({ [p[1]]: null })),
        );

        // Convert the query in the config into a database query template containing named bindings
        const dbQuery = params.reduce((q, param) => q.replace(param[0], `:${param[1]}`), query);
        const paramNames = params.map((p) => p[1]);
        const requiredParamNames = requiredParams.map((p) => p[1]);
        const handler = {
            get: async (ctx) => {
                const requestErrors = [
                    // User did not provide all necessary query parameters
                    ...requiredParamNames
                        .filter((pn) => !ctx.request.URL.searchParams.has(pn))
                        .map((pn) => `Missing parameter in querystring: ${pn}`),
                    // User provided a querystring with duplicated params/args, such as ?q=a&q=b
                    ...paramNames
                        .filter((pn) => ctx.request.URL.searchParams.getAll(pn).length > 1)
                        .map((pn) => `Only one argument allowed for queryparam ${pn}`),
                    // User provided a querystring parameter not in our allowed list
                    ...[...ctx.request.URL.searchParams.keys()]
                        .filter((pn) => !paramNames.includes(pn))
                        .map((pn) => `queryparam ${pn} not supported by this report`),
                    // User did not provide a value for a required query parameter
                    ...[...ctx.request.URL.searchParams.entries()]
                        .filter(([pn, arg]) => !arg && requiredParamNames.includes(pn))
                        .map(([param]) => `queryparam ${param} must have a value supplied`),
                ];

                ctx.assert(
                    requestErrors.length === 0,
                    400,
                    {
                        message: 'Errors in request',
                        errors: requestErrors,
                    },
                );

                const queryArgs = {
                    ...optionalParamDefaults,
                    // Filter out empty strings as these are optional parameters with no supplied
                    // value. We'll treat these as null, rather than an empty string.
                    ...fromEntries(Array.from(ctx.request.URL.searchParams.entries()).filter(([, v]) => v !== '')),
                };
                ctx.state.logger.push({ dbQuery, queryArgs }).log('Executing query');
                const result = await ctx.db.query(dbQuery, queryArgs);
                ctx.state.logger.push({ dbQuery, queryArgs, result }).log('Query result');

                ctx.response.body = result;
            },
        };
        return [route, handler];
    };

    return fromEntries(Object.entries(reportsConfig).map(createReportHandler));
};

module.exports = {
    validateReportHandlers,
    createReportHandlers,
    handlerMap: {
        '/': {
            get: healthCheck,
        },
    },
};
