
const Koa = require('koa');
const router = require('@internal/router');
const handlers = require('./handlers');
const randomphrase = require('@internal/randomphrase');

const create = ({ db, reportsConfig, logger }) => {
    const app = new Koa();

    // Default context
    app.context.db = db;

    // Attach state for handlers
    app.use(async (ctx, next) => {
        ctx.state = {
            ...ctx.state,
            logger: logger.push({
                request: {
                    id: randomphrase(),
                    path: ctx.path,
                    method: ctx.method,
                },
            }),
        };
        await next();
    });

    // Log request receipt
    app.use(async (ctx, next) => {
        ctx.state.logger.log('Received request');
        try {
            await next();
        } catch (err) {
            ctx.state.logger.push(err).log('Error handling request');
            ctx.response.status = err.statusCode || err.status || 500;
            ctx.response.body = JSON.stringify(err);
        }
        ctx.state.logger.log('Handled request');
    });

    // Load handlers here, before post-processing
    const reportHandlers = handlers.createReportHandlers(reportsConfig);
    const routeHandlers = { ...handlers.handlerMap, ...reportHandlers }
    logger.push({ routes: Object.keys(routeHandlers) }).log('Serving routes');
    app.use(router(routeHandlers));

    app.use(async (ctx, next) => {
        // This is strictly a JSON api, so only return application/json
        ctx.response.headers = {
            'content-type': 'application/json',
        }
        // Koa automatically json stringifies our response body and sets the response status to 200/204
        // if we haven't set it
        await next();
    });

    return app;
}

module.exports = create;
