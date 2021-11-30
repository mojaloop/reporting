/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2020                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

const { formatResponse } = require('./format');

const healthCheck = async (ctx) => {
    ctx.body = { status: 'ok' };
};

const createRouter = () => async (ctx, next) => {
    const handlers = ctx.state.reportData.handlerMap[ctx.request.URL.pathname.toLowerCase()];
    const handler = handlers ? handlers[ctx.method.toLowerCase()] : undefined;

    ctx.assert(
        handler && handlers,
        404,
        'Not found',
    );

    ctx.state.logger.push({ handler }).log('Found handler');
    await handler(ctx);
    await next();
};

const createReportHandler = (render, report) => ({
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
        }
    },
});

module.exports = {
    createReportHandler,
    createRouter,
    defaultHandlerMap: {
        '/': {
            get: healthCheck,
        },
    },
};
