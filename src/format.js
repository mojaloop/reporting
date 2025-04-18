/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2020                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

const parse = require('csv-parse');
const xlsx = require('xlsx');
const htmlParser = require('node-html-parser');
const tableToCsv = require('node-table-to-csv');

function parseCsvAsync(input) {
    const csvOptions = {
        columns: true,
        delimiter: ',',
        ltrim: true,
        rtrim: true,
    };
    return new Promise((resolve, reject) => {
        parse(input, csvOptions, (err, records) => {
            if (err) return reject(err);
            return resolve(records);
        });
    });
}

module.exports.formatResponse = async (ctx, htmlInput) => {
    const format = ctx.request.query.format || 'html';
    switch (format) {
        case 'xlsx': {
            ctx.state.logger.log('Setting XLSX response');

            const reportName = ctx.request.path.substr(ctx.request.path.lastIndexOf('/'), ctx.request.path.length)
                .replace('/', '').replace('.xlsx', '');

            // get records
            const csvInput = tableToCsv(htmlInput);
            const records = await parseCsvAsync(csvInput);

            // prepare the xlsx workbook
            const wb = xlsx.utils.book_new();

            // insert the records as a sheet
            const ws = xlsx.utils.json_to_sheet(records);
            xlsx.utils.book_append_sheet(wb, ws, reportName);

            ctx.body = wb;

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
