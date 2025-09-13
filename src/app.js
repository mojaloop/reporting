const Koa = require('koa');
const cors = require('@koa/cors');
const randomphrase = require('@internal/randomphrase');

const { createAuthMiddleware } = require('./auth');
const {
    defaultHandlerMap,
    createRouter,
} = require('./handlers');
const ReportingOperator = require('./operator');

const createApp = async ({ db, logger, config }) => {
    const app = new Koa();

    // Default context
    app.context.db = db;

    app.use(cors());

    const reportData = {
        handlerMap: defaultHandlerMap,
        pathMap: {},
        db,
    };

    // Attach state for handlers
    app.use(async (ctx, next) => {
        ctx.state = {
            ...ctx.state,
            reportData,
            logger: logger.child({
                request: {
                    id: randomphrase(),
                    path: ctx.path,
                    method: ctx.method,
                    query: ctx.query,
                },
            }),
        };
        await next();
    });

    // Log request receipt and response, handle exceptions
    app.use(async (ctx, next) => {
        ctx.state.logger.info('Received request');
        try {
            await next();
        } catch (err) {
            ctx.state.logger.error('Error handling request', err);
            ctx.response.status = err.statusCode || err.status || 500;
            ctx.response.body = JSON.stringify(err);
            ctx.response.set('content-type', 'application/json');
        }
        ctx.state.logger.info('Handled request');
    });

    if (config.oryKetoReadUrl) {
        app.use(createAuthMiddleware(config.userIdHeader, config.oryKetoReadUrl));
    }

    const operator = new ReportingOperator(reportData);
    await operator.start();

    app.use(createRouter());
    return app;
};

module.exports = { createApp };
