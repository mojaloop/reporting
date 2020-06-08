
const Koa = require('koa');
const router = require('@internal/router');
const randomphrase = require('@internal/randomphrase');
const fromEntries = require('object.fromentries');
const csvStringify = require('csv-stringify/lib/sync');
const json2xls = require('json2xls');
const sendFile = require('koa-sendfile');
const fs = require('fs').promises;

const { validateReportHandlers, createReportHandlers, handlerMap } = require('./handlers');

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
            .reduce((pv, [key, val]) => [...pv, [`${key}.json`, val], [`${key}.csv`, val], [`${key}.xlsx`, val]], []),
    );
    validateReportHandlers(reportsConfigWithSuffixes);
    const reportHandlers = createReportHandlers(reportsConfigWithSuffixes);
    const routeHandlers = { ...handlerMap, ...reportHandlers };
    logger.push({ routes: Object.keys(routeHandlers) }).log('Serving routes');
    app.use(router(routeHandlers));

    // Serialise the body to the type we're interested in
    app.use(async (ctx, next) => {
        const suffix = ctx.request.path.split('.').pop();
        switch (suffix) {
            case 'xlsx': {
                ctx.state.logger.log('Setting XLSX response');
                const reportName = ctx.request.path.substr(ctx.request.path.lastIndexOf('/'), ctx.request.path.length).replace('/', '').replace('.xlsx', '');
                const fileName = `${reportName}_${Date.now()}.xlsx`;
                const body = json2xls(ctx.response.body);
                await fs.writeFile(fileName, body, 'binary');
                ctx.response.status = 200;
                await sendFile(ctx, fileName);
                await fs.unlink(fileName);
                break;
            }
            case 'csv': {
                ctx.state.logger.log('Setting CSV response');
                // TODO: try to use the streaming API
                const body = csvStringify(ctx.response.body, {
                    columns: Object.keys(ctx.response.body[0] || {}),
                    header: true,
                });
                ctx.response.body = body;
                ctx.response.set('content-type', 'application/csv');
                break;
            }
            case 'json': {
                ctx.state.logger.log('Setting JSON response');
                ctx.response.body = JSON.stringify(ctx.response.body);
                ctx.response.set('content-type', 'application/json');
                break;
            }
            default:
                // ignore
        }
        await next();
    });

    return app;
};

module.exports = create;
