const { readdirSync, readFileSync } = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const ejs = require('ejs');

const healthCheck = async (ctx) => {
    ctx.response.status = 200;
    ctx.response.body = { status: 'ok' };
    ctx.response.set('content-type', 'application/json');
};

const readTemplates = (templatesDir) => {
    const files = readdirSync(templatesDir);
    return files.reduce((acc, curr) => {
        if (path.extname(curr) === '.yaml') {
            const name = path.basename(curr, '.yaml');
            const absPath = path.join(templatesDir, curr);
            acc[name] = acc[name] || {};
            acc[name].dataSource = yaml.load(readFileSync(absPath));
        }
        if (path.extname(curr) === '.ejs') {
            const name = path.basename(curr, '.ejs');
            const absPath = path.join(templatesDir, curr);
            acc[name] = acc[name] || {};
            acc[name].render = ejs.compile(readFileSync(absPath).toString());
        }
        return acc;
    }, {});
};

const getParams = (template) => {
    const { params } = template;
    const requiredParams = Object.keys(params).filter((name) => params[name].required);
    const optionalParams = Object.keys(params).filter((name) => !params[name].required);
    return { requiredParams, optionalParams };
};

const createReportHandlers = (reportTemplates) => {
    const createReportHandler = ([route, template]) => {
        const { requiredParams, optionalParams } = getParams(template.dataSource);
        const params = [...requiredParams, ...optionalParams];

        // Build the optional param default object here (once) for later use
        // eslint-disable-next-line max-len
        const optionalParamDefaults = Object.fromEntries(optionalParams.map((p) => ([p, template.dataSource.params[p].default])));

        const handler = {
            get: async (ctx) => {
                const requestErrors = [
                    // User did not provide all necessary query parameters
                    ...requiredParams
                        .filter((pn) => !ctx.request.URL.searchParams.has(pn))
                        .map((pn) => `Missing parameter in querystring: ${pn}`),
                    // User provided a querystring with duplicated params/args, such as ?q=a&q=b
                    ...params
                        .filter((pn) => ctx.request.URL.searchParams.getAll(pn).length > 1)
                        .map((pn) => `Only one argument allowed for queryparam ${pn}`),
                    // User provided a querystring parameter not in our allowed list
                    ...[...ctx.request.URL.searchParams.keys()]
                        .filter((pn) => !params.includes(pn))
                        .map((pn) => `queryparam ${pn} not supported by this report`),
                    // User did not provide a value for a required query parameter
                    ...[...ctx.request.URL.searchParams.entries()]
                        .filter(([pn, arg]) => !arg && requiredParams.includes(pn))
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
                    ...Object.fromEntries(Array.from(ctx.request.URL.searchParams.entries())
                        .filter(([, v]) => v !== '')),
                };

                const queries = Object.entries(template.dataSource.data)
                    .map(([k, v]) => ctx.db.query(v, queryArgs)
                        .then((result) => ({ [k]: result })));
                const result = await Promise.all(queries);
                ctx.state.html = template.render(Object.assign({}, ...result));
            },
        };
        return [`/${route}`, handler];
    };

    return Object.fromEntries(Object.entries(reportTemplates).map(createReportHandler));
};

module.exports = {
    createReportHandlers,
    readTemplates,
    handlerMap: {
        '/': {
            get: healthCheck,
        },
    },
};
