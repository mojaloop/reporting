/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2020                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

const ejs = require('ejs');
const { formatResponse } = require('./format');

const healthCheck = async (ctx) => {
    ctx.body = { status: 'ok' };
};

const createRouter = () => async (ctx, next) => {
    const handlers = ctx.state.reportData.handlerMap[ctx.request.URL.pathname.toLowerCase()];
    const handler = handlers?.[ctx.method.toLowerCase()];

    if (!handler) {
        ctx.response.status = 404;
        return;
    }

    ctx.state.logger.child({ handler }).info('Found handler');
    await handler(ctx);
    await next();
};

const validateReport = async (render, report, db) => {
    const queryArgs = {};
    for (const param of (report.endpoint.params || [])) {
        queryArgs[param.name] = param.default || '0';
    }

    const queries = report.queries
        .map((q) => db.query(q.query, queryArgs)
            .then((result) => ({ [q.name]: result })));
    const result = await Promise.all(queries);
    render(Object.assign({}, ...result));
};

const createReportHandler = async (db, report) => {
    const render = ejs.compile(report.template);
    await validateReport(render, report, db);

    return {
        get: async (ctx) => {
            const errors = [];
            const queryArgs = {};
            for (const param of (report.endpoint.params || [])) {
                if (!ctx.request.query[param.name] && param.required) {
                    errors.push(`Missing parameter in querystring: ${param.name}`);
                } else {
                    queryArgs[param.name] = ctx.request.query[param.name] || param.default;
                }
            }

            ctx.assert(
                errors.length === 0,
                400,
                {
                    message: 'Errors in request',
                    errors,
                },
            );

            const queries = report.queries
                .map((q) => ctx.db.query(q.query, queryArgs)
                    .then((result) => ({ [q.name]: result })));
            const result = await Promise.all(queries);
            try {
                const html = render(Object.assign({}, ...result));
                await formatResponse(ctx, html);
            } catch (e) {
                ctx.state.logger.log(e);
                ctx.response.status = 500;
            }
        },
    };
};

module.exports = {
    createReportHandler,
    createRouter,
    defaultHandlerMap: {
        '/': {
            get: healthCheck,
        },
    },
};
