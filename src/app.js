const path = require('node:path');
const Koa = require('koa');
const cors = require('@koa/cors');
const randomphrase = require('@internal/randomphrase');
const { createGuard } = require('@mojaloop/authz');

const {
    defaultHandlerMap,
    createRouter,
} = require('./handlers');
const ReportingOperator = require('./operator');

const createApp = async ({ db, logger }) => {
    const app = new Koa();

    // Default context
    app.context.db = db;
    // What this service may answer, from the document that describes it
    app.context.authz = await createGuard(path.join(__dirname, 'api', 'openapi.yaml'));

    app.use(cors());

    const reportData = {
        handlerMap: defaultHandlerMap,
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

    const operator = new ReportingOperator(reportData);
    await operator.start();

    app.use(createRouter());
    return app;
};

module.exports = { createApp };
