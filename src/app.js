
require('string.prototype.matchall').shim();
require('object.fromentries').shim();

const Database = require('./db');
const Koa = require('koa');
const { Logger, transports } = require('el-logger');
const router = require('@internal/router');
const handlers = require('./handlers');
const reportsConfig = require('../config/reports.json');
const dbConfig = require('../config/db.json');

const app = new Koa();

app.use(async (ctx, next) => {
    ctx.state = {
        ...ctx.state,
        logger: new Logger({
            ctx: {
                request: {
                    // TODO (use randomphrase internal lib): id: ctx.request.id,
                    path: ctx.path,
                    method: ctx.method,
                },
            },
            transports: [transports.stdout],
        }),
        db: new Database(dbConfig),
    };
    await next();
});

// Load handlers here, before post-processing
const reportHandlers = handlers.createReportHandlers(reportsConfig);
const routeHandlers = { ...handlers.handlerMap, ...reportHandlers }
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

module.exports = {
    app,
};
