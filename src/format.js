/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2020                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

const conversionFactory = require('html-to-xlsx');
const puppeteer = require('puppeteer');
const htmlParser = require('node-html-parser');
const chromeEval = require('chrome-page-eval')({
    puppeteer,
    launchOptions: {
        headless: true,
        executablePath: puppeteer.executablePath(),
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

            ctx.set('content-disposition', `attachment; filename="${reportName}.xlsx"`);
            ctx.set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

            ctx.body = await conversion(htmlInput);

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
