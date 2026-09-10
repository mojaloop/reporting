/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2020                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

const k8s = require('@kubernetes/client-node');
const { logger } = require('./lib/logger');
const config = require('./config');
const { createReportHandler } = require('./handlers');
const { provisionReport, deprovisionReport } = require('./provisioning');
class ReportingOperator {
    constructor(reportData) {
        this.reportData = reportData;

        this.resourceGeneration = {};

        this.logger = logger;

        this.kc = new k8s.KubeConfig();
        this.kc.loadFromDefault();

        this.k8sApiCustomObjects = this.kc.makeApiClient(k8s.CustomObjectsApi);

        this.watch = new k8s.Watch(this.kc);
    }

    async updateResourceStatus(apiObj, statusText, messages) {
        try {
            // Fetch the latest version of the resource to get the current resourceVersion
            const latest = await this.k8sApiCustomObjects.getNamespacedCustomObject({
                group: config.operator.resourceGroup,
                version: config.operator.resourceVersion,
                namespace: config.operator.namespace,
                plural: config.operator.resourcePlural,
                name: apiObj.metadata.name
            });

            const status = {
                apiVersion: apiObj.apiVersion,
                kind: apiObj.kind,
                metadata: {
                    name: apiObj.metadata.name,
                    resourceVersion: latest?.data?.metadata?.resourceVersion || latest?.metadata?.resourceVersion,
                },
                status: {
                    state: statusText,
                    messages,
                },
            };

            await this.k8sApiCustomObjects.replaceNamespacedCustomObjectStatus({
                group: config.operator.resourceGroup,
                version: config.operator.resourceVersion,
                namespace: config.operator.namespace,
                plural: config.operator.resourcePlural,
                name: apiObj.metadata.name,
                body: status
            });
        } catch (err) {
            this.logger.error(`Error updating status of the custom resource ${apiObj.metadata.name}: ${err.message}`);
        }
    }

    async onEvent(phase, apiObj) {
        const name = apiObj?.metadata?.name;
        const path = apiObj.spec.endpoint.path;
        // A grant names the report by the segment its URL carries, so the id
        // here and the one the gateway reads off a request are the same string.
        const reportId = path.replace(/^\//, '');
        const { handlerMap, db } = this.reportData;
        if (!name) return;

        this.logger.info(`Received event in phase ${phase} for the resource ${name}`);

        if (['ADDED', 'MODIFIED'].includes(phase)) {
            const { generation } = apiObj.metadata;
            if (this.resourceGeneration[name] === generation) {
                return;
            }
            this.resourceGeneration[name] = generation;

            const notices = [];
            if (reportId.includes('/')) {
                // A request carries one segment after /reports, so a deeper
                // path is a report no grant can name and no request can reach.
                await this.updateResourceStatus(apiObj, 'INVALID', [
                    `endpoint.path must be a single segment, so "${path}" cannot be granted or reached`,
                ]);
                return;
            }
            if (apiObj.spec.permission) {
                notices.push(`spec.permission is not used; this report is granted as reports/${reportId}`);
                this.logger.warn(`${name}: ${notices[0]}`);
            }

            for (let i = config.operator.validationRetryCount; i >= 0; i -= 1) {
                try {
                    handlerMap[path] = await createReportHandler(db, apiObj.spec);
                    await provisionReport(reportId, this.logger);
                    await this.updateResourceStatus(apiObj, 'VALIDATED', notices);
                    return;
                } catch (e) {
                    this.logger.error(`Error occurred while validating resource. ${e.code}`, e);
                    // Retry on specific error codes, statusCode 409, or message containing any of the retry substrings
                    const retryMessageSubstrings = [
                        'connection is in closed state'
                    ];
                    if (
                        [
                            'ECONNRESET',
                            'EPIPE',
                            'ECONNABORTED',
                            'ER_QUERY_INTERRUPTED',
                            'ECONNREFUSED',
                            'ER_ACCESS_DENIED_ERROR',
                            'ETIMEDOUT',
                            'ENOTFOUND',
                            'PROTOCOL_CONNECTION_LOST'
                        ].includes(e.code) ||
                        e.statusCode === 409 ||
                        (
                            typeof e.message === 'string' &&
                            retryMessageSubstrings.some(sub => e.message.toLowerCase().includes(sub))
                        )
                    ) {
                        if (i !== 0) {
                            this.logger.info(`Retrying after ${config.operator.validationRetryIntervalMs}ms...(${i} retries left)`);
                            await new Promise((resolve) => { setTimeout(resolve, config.operator.validationRetryIntervalMs); });
                            continue;
                        }
                    }
                    await this.updateResourceStatus(apiObj, 'INVALID', [...notices, e.message]);
                    return;
                }
            }
        } else if (phase === 'DELETED') {
            delete handlerMap[path];
            delete this.resourceGeneration[name];
            await deprovisionReport(reportId, this.logger);
        } else {
            this.logger.warn(`Unknown event type: ${phase}`);
        }
    }

    watchResource() {
        const {
            resourceGroup, resourceVersion, namespace, resourcePlural,
        } = config.operator;
        // Store reference to the watch request
        this.watchRequest = this.watch.watch(
            `/apis/${resourceGroup}/${resourceVersion}/namespaces/${namespace}/${resourcePlural}`,
            {},
            (phase, apiObj) => this.onEvent(phase, apiObj),
            () => setTimeout(() => this.watchResource(), 1000),
        );
        return this.watchRequest;
    }

    start() {
        return this.watchResource().catch((err) => {
            if (err.message === 'No currently active cluster') {
                this.logger.error('Can not connect to K8S API');
            } else {
                this.logger.error(err.stack);
            }
            throw err;
        });
    }
}

module.exports = ReportingOperator;
