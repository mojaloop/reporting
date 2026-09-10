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

/**
 * The types a report's rows belong to, as its custom resource declares them.
 * A report declaring none is about the whole hub.
 */
const scopedBy = (report) => report.endpoint.scopedBy || [];

/**
 * What a report's queries receive for a type: the ids its caller holds, joined
 * for a prepared statement, and null for a caller nothing restricts. A report
 * writes its own filter around it, because only its author knows which column
 * holds the id.
 */
const binding = (visible) => (visible.restricted ? visible.ids.join(',') : null);

const healthCheck = async (ctx) => {
    ctx.body = { status: 'ok' };
};

const createRouter = () => async (ctx, next) => {
    // A report answers on the path its resource declares and no other
    // spelling, because that path is also the id a grant names it by.
    const handlers = ctx.state.reportData.handlerMap[ctx.request.URL.pathname];
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

    // A report that says its rows belong to a type has to filter by it, or
    // the declaration is a claim its queries never honour
    for (const type of scopedBy(report)) {
        const unfiltered = report.queries.filter((q) => !q.query.includes(`:${type}`));
        if (unfiltered.length > 0) {
            throw new Error(
                `${report.endpoint.path}: declares ${type} but ${unfiltered.map((q) => q.name).join(', ')} never binds :${type}`,
            );
        }
        queryArgs[type] = null;
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

            // What this service's document says a report's rows are scoped
            // by. A report that declares a type receives what the caller
            // holds of it and filters by it; one that does not covers them
            // all, so a caller holding some cannot be answered from it.
            const declared = scopedBy(report);
            for (const type of ctx.authz.scopedBy(ctx.req)) {
                const visible = ctx.authz(ctx.req, type);
                if (declared.includes(type)) {
                    queryArgs[type] = binding(visible);
                } else if (visible.restricted) {
                    ctx.response.status = 403;
                    ctx.response.body = {
                        message: `${report.endpoint.path} covers every ${type}, and this caller holds some of them`,
                    };
                    return;
                }
            }

            const queries = report.queries
                .map((q) => ctx.db.query(q.query, queryArgs)
                    .then((result) => ({ [q.name]: result })));
            const result = await Promise.all(queries);
            try {
                const html = render(Object.assign({}, ...result));
                await formatResponse(ctx, html);
            } catch (e) {
                ctx.state.logger.error(e);
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
