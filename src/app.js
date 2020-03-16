
const Koa = require('koa');
const router = require('@internal/router');
const { validateReportHandlers, createReportHandlers, handlerMap } = require('./handlers');
const randomphrase = require('@internal/randomphrase');
const fromEntries = require('object.fromentries');

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
                    query: ctx.query,
                },
            }),
        };
        await next();
    });

    // Log request receipt and response, handle exceptions
    app.use(async (ctx, next) => {
        ctx.state.logger.log('Received request');
        try {
            await next();
        } catch (err) {
            ctx.state.logger.push({ err }).log('Error handling request');
            ctx.response.status = err.statusCode || err.status || 500;
            ctx.response.body = JSON.stringify(err);
            ctx.response.set('content-type', 'application/json');
        }
        ctx.state.logger.push({ response: ctx.response.body }).log('Handled request');
    });

    // Load handlers here, before post-processing
    const reportsConfigWithSuffixes = fromEntries(
        Object.entries(reportsConfig)
            .reduce((pv, [key, val]) => [...pv, [`${key}.json`, val], [`${key}.csv`, val]], [])
    );
    validateReportHandlers(reportsConfigWithSuffixes);
    const reportHandlers = createReportHandlers(reportsConfigWithSuffixes);
    const routeHandlers = { ...handlerMap, ...reportHandlers }
    logger.push({ routes: Object.keys(routeHandlers) }).log('Serving routes');
    app.use(router(routeHandlers));

    // Serialise the body to the type we're interested in
    app.use(async (ctx, next) => {
        const suffix = ctx.request.path.split('.').pop();
        switch (suffix) {
            case 'csv':

                break;
            case 'json':

                break;
            default:
                // Do nothing
        }
        await next();
    });

    app.use(async (ctx, next) => {
        // This is strictly a JSON api, so only return application/json
        ctx.response.set('content-type', 'application/json');
        // Koa automatically json stringifies our response body and sets the response status to 200/204
        // if we haven't set it
        await next();
    });

    return app;
}

module.exports = create;
