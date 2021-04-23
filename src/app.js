const Koa = require('koa');
const router = require('@internal/router');
const randomphrase = require('@internal/randomphrase');
const sendFile = require('koa-sendfile');
const conversionFactory = require('html-to-xlsx');
const puppeteer = require('puppeteer');
const chromeEval = require('chrome-page-eval')({
    puppeteer,
    launchOptions: {
        headless: true,
        args: [
            // Required for Docker version of Puppeteer
            '--no-sandbox',
            '--disable-setuid-sandbox',
            // This will write shared memory files into /tmp instead of /dev/shm,
            // because Docker default for /dev/shm is 64MB
            '--disable-dev-shm-usage',
        ],
    },
});
const tableToCsv = require('node-table-to-csv');

const fs = require('fs').promises;
const fsSync = require('fs');

const {
    createReportHandlers,
    handlerMap,
    readTemplates,
} = require('./handlers');

const create = ({ templatesDir, db, logger }) => {
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
        ctx.state.logger.push({}).log('Handled request');
    });

    const templates = readTemplates(templatesDir);
    const reportHandlers = createReportHandlers(templates);
    const reportHandlersWithSuffixes = Object.fromEntries(
        Object.entries(reportHandlers)
            .reduce((pv, [key, val]) => [
                ...pv,
                [`${key}.csv`, val],
                [`${key}.xlsx`, val],
                [`${key}.html`, val],
            ], []),
    );
    const routeHandlers = { ...handlerMap, ...reportHandlersWithSuffixes };
    logger.push({ routes: Object.keys(routeHandlers) }).log('Serving routes');
    app.use(router(routeHandlers));

    // Serialise the body to the type we're interested in
    app.use(async (ctx, next) => {
        const suffix = ctx.request.path.split('.').pop();
        switch (suffix) {
            case 'xlsx': {
                ctx.state.logger.log('Setting XLSX response');

                const reportName = ctx.request.path.substr(ctx.request.path.lastIndexOf('/'), ctx.request.path.length).replace('/', '').replace('.xlsx', '');
                const conversion = conversionFactory({
                    extract: async ({ html, ...restOptions }) => {
                        const tmpHtmlPath = `/tmp/${reportName}_${Date.now()}.html`;

                        await fs.writeFile(tmpHtmlPath, html);

                        const result = await chromeEval({
                            ...restOptions,
                            html: tmpHtmlPath,
                            scriptFn: conversionFactory.getScriptFn(),
                        });

                        const tables = Array.isArray(result) ? result : [result];

                        return tables.map((table) => ({
                            name: table.name,
                            getRows: async (rowCb) => {
                                table.rows.forEach((row) => {
                                    rowCb(row);
                                });
                            },
                            rowsCount: table.rows.length,
                        }));
                    },
                });

                const stream = await conversion(ctx.state.html);

                const fileName = `${reportName}_${Date.now()}.xlsx`;
                stream.pipe(fsSync.createWriteStream(fileName));

                await new Promise((resolve) => stream.on('end', resolve));
                ctx.response.status = 200;
                await sendFile(ctx, fileName);
                await fs.unlink(fileName);
                break;
            }
            case 'csv': {
                ctx.state.logger.log('Setting CSV response');
                ctx.response.body = tableToCsv(ctx.state.html);
                ctx.response.set('content-type', 'application/csv');
                break;
            }
            case 'html': {
                ctx.state.logger.log('Setting HTML response');
                ctx.response.body = ctx.state.html;
                ctx.response.set('content-type', 'text/html');
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
