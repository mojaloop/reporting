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
const { Logger } = require('@mojaloop/sdk-standard-components').Logger;
const config = require('./config');
const { createReportHandler } = require('./handlers');

class ReportingOperator {
    constructor(reportData) {
        this.reportData = reportData;

        this.resourceGeneration = {};

        this.logger = new Logger();

        this.kc = new k8s.KubeConfig();
        this.kc.loadFromDefault();

        this.k8sApiCustomObjects = this.kc.makeApiClient(k8s.CustomObjectsApi);

        this.watch = new k8s.Watch(this.kc);
    }

    async updateResourceStatus(apiObj, statusText, error) {
        const status = {
            apiVersion: apiObj.apiVersion,
            kind: apiObj.kind,
            metadata: {
                name: apiObj.metadata.name,
                resourceVersion: apiObj.metadata.resourceVersion,
            },
            status: {
                state: statusText,
                error,
            },
        };

        try {
            await this.k8sApiCustomObjects.replaceNamespacedCustomObjectStatus(
                config.operator.resourceGroup,
                config.operator.resourceVersion,
                config.operator.namespace,
                config.operator.resourcePlural,
                apiObj.metadata.name,
                status,
            );
        } catch (err) {
            this.logger.error(`Error updating status of the custom resource ${apiObj.metadata.name}: ${err.message}`);
        }
    }

    async onEvent(phase, apiObj) {
        const name = apiObj?.metadata?.name;
        const path = apiObj.spec.endpoint.path.toLowerCase();
        const { handlerMap, pathMap, db } = this.reportData;
        if (name) {
            this.logger.info(`Received event in phase ${phase} for the resource ${name}`);
            if (['ADDED', 'MODIFIED'].includes(phase)) {
                const { generation } = apiObj.metadata;
                if (this.resourceGeneration[name] === generation) {
                    return;
                }
                this.resourceGeneration[name] = generation;
                for (let i = config.operator.validationRetryCount; i >= 0; i -= 1) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        handlerMap[path] = await createReportHandler(db, apiObj.spec);
                    } catch (e) {
                        this.logger.error(`Error occured while validating resource. '${e.message}'`);
                        switch (e.code) {
                            case 'ECONNREFUSED':
                            case 'ER_ACCESS_DENIED_ERROR':
                            case 'ETIMEDOUT':
                            case 'ENOTFOUND':
                                if (i !== 0) {
                                    // eslint-disable-next-line max-len
                                    this.logger.info(`Retying after ${config.operator.validationRetryIntervalMs}ms...(${i} retries left)`);
                                    // eslint-disable-next-line max-len,no-await-in-loop
                                    await new Promise((resolve) => { setTimeout(resolve, config.operator.validationRetryIntervalMs); });
                                    break;
                                }
                            // eslint-disable-next-line no-fallthrough
                            default:
                                // eslint-disable-next-line no-await-in-loop
                                await this.updateResourceStatus(apiObj, 'INVALID', e.message);
                                return;
                        }
                    }
                }
                pathMap[path] = apiObj.spec.permission || name;
                await this.updateResourceStatus(apiObj, 'VALID');
            } else if (phase === 'DELETED') {
                delete handlerMap[path];
                delete pathMap[path];
                delete this.resourceGeneration[name];
            } else {
                this.logger.warn(`Unknown event type: ${phase}`);
            }
        }
    }

    watchResource() {
        const {
            resourceGroup, resourceVersion, namespace, resourcePlural,
        } = config.operator;
        return this.watch.watch(
            `/apis/${resourceGroup}/${resourceVersion}/namespaces/${namespace}/${resourcePlural}`,
            {},
            (phase, apiObj) => this.onEvent(phase, apiObj),
            () => setTimeout(() => this.watchResource(), 1000),
        );
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
