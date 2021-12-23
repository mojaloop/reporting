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
                try {
                    handlerMap[path] = await createReportHandler(db, apiObj.spec);
                } catch (e) {
                    await this.updateResourceStatus(apiObj, 'INVALID', e.message);
                    return;
                }
                pathMap[path] = name;
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
        this.watchResource().catch((err) => {
            if (err.message === 'No currently active cluster') {
                this.logger.error('Can not connect to K8S API');
            } else {
                this.logger.error(err.stack);
            }
        });
    }
}

module.exports = ReportingOperator;
