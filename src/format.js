const conversionFactory = require('html-to-xlsx');
const puppeteer = require('puppeteer');
const htmlParser = require('node-html-parser');
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

module.exports.formatResponse = async (ctx, htmlInput) => {
    const format = ctx.request.query.format || 'html';
    switch (format) {
        case 'xlsx': {
            ctx.state.logger.log('Setting XLSX response');

            const reportName = ctx.request.path.substr(ctx.request.path.lastIndexOf('/'), ctx.request.path.length)
                .replace('/', '').replace('.xlsx', '');
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

            ctx.body = await conversion(htmlInput);
            ctx.set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            break;
        }
        case 'csv': {
            ctx.state.logger.log('Setting CSV response');
            ctx.body = tableToCsv(htmlInput);
            ctx.set('content-type', 'application/csv');
            break;
        }
        case 'html': {
            ctx.state.logger.log('Setting HTML response');
            ctx.body = htmlInput;
            ctx.set('content-type', 'text/html');
            break;
        }
        case 'json': {
            const root = htmlParser.parse(htmlInput);
            const el = root.querySelector('[data-json]');
            const data = el.getAttribute('data-json');
            ctx.body = JSON.parse(data);
            break;
        }
        default:
        // ignore
    }
};
