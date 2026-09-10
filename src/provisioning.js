/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2026                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 ************************************************************************* */

/**
 * A report is a resource: it appears when its custom resource is applied and
 * goes when it is removed. Telling the IAM makes it grantable, so an operator
 * can hand someone a new report without a deploy. This service names the
 * report and never writes a grant.
 */

const config = require('./config');

/** The resource type reports are granted on, as this service's API document spells it. */
const REPORT_RESOURCE = 'reports';

const call = async (method, body, logger) => {
    if (!config.iamProvisioningUrl) return;
    const response = await fetch(`${config.iamProvisioningUrl}/provision`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        logger.error(`IAM answered ${response.status} for ${method} ${body.type}/${body.id}`);
        return;
    }
    return response.json();
};

/**
 * @param {string} reportPath  the report's endpoint segment, which is what a
 *                             request carries and therefore what a grant names
 */
const provisionReport = (reportPath, logger) =>
    call('POST', { type: REPORT_RESOURCE, id: reportPath, principals: {} }, logger);

const deprovisionReport = (reportPath, logger) =>
    call('DELETE', { type: REPORT_RESOURCE, id: reportPath }, logger);

module.exports = { provisionReport, deprovisionReport, REPORT_RESOURCE };
