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
const { id } = require('@mojaloop/central-services-shared').Util
const ulid = id({ type: 'ulid' })
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
            await this.k8sApiCustomObjects.replaceNamespacedCustomObjectStatus({
                group: config.operator.resourceGroup,
                version: config.operator.resourceVersion,
                namespace: config.operator.namespace,
                plural: config.operator.resourcePlural,
                name: apiObj.metadata.name,
                body: status,
            });
        } catch (err) {
            this.logger.error(`Error updating status of the custom resource ${apiObj.metadata.name}: ${err.message}`);
        }
    }

    async onEvent(phase, apiObj) {
        const name = apiObj?.metadata?.name;
        const path = `${config.pathPrefix}${apiObj.spec.endpoint.path.toLowerCase()}`;
        const { handlerMap, pathMap, db, lockGracePeriodMs } = this.reportData;
        if (!name) return;

        this.logger.info(`Received event in phase ${phase} for the resource ${name}`);

        // Only one replica should process a resource at a time.
        // Use an annotation as a lock: 'reporting-operator/lock'
        if (!this.myId) {
            this.myId = process.env.HOSTNAME || ulid();
        }
        const myId = this.myId;
        const annotations = apiObj.metadata.annotations || {};
        const lockHolder = annotations['reporting-operator/lock'];
        let lockTimestamp = annotations['reporting-operator/lock-timestamp'];
        let lockExpired = false;

        if (lockHolder && lockTimestamp) {
            const lockTime = new Date(lockTimestamp).getTime();
            const now = Date.now();
            if (now - lockTime > lockGracePeriodMs) {
                lockExpired = true;
                this.logger.info(`Lock for resource ${name} expired, attempting to acquire.`);
            }
        }

        if (['ADDED', 'MODIFIED'].includes(phase)) {
            // Try to acquire the lock if not held or held by this replica
            if (lockHolder && lockHolder !== myId) {
                this.logger.info(`Resource ${name} is locked by ${lockHolder}, skipping.`);
                return;
            }
            // If not locked, try to acquire the lock
            if (!lockHolder) {
                try {
                    // Patch the resource to set the lock annotation
                    await this.k8sApiCustomObjects.patchNamespacedCustomObject(
                        config.operator.resourceGroup,
                        config.operator.resourceVersion,
                        config.operator.namespace,
                        config.operator.resourcePlural,
                        name,
                        {
                            metadata: {
                                annotations: {
                                    'reporting-operator/lock': myId,
                                    'reporting-operator/lock-timestamp': new Date().toISOString(),
                                },
                            },
                        },
                        undefined,
                        undefined,
                        undefined,
                        { headers: { 'Content-Type': 'application/merge-patch+json' } }
                    );
                    this.logger.info(`Acquired lock for resource ${name}`);
                    // After patch, return and wait for the next MODIFIED event with the lock set
                    return;
                } catch (err) {
                    this.logger.error(`Failed to acquire lock for resource ${name}: ${err.message}`);
                    return;
                }
            }

            const { generation } = apiObj.metadata;
            if (this.resourceGeneration[name] === generation) {
                return;
            }
            this.resourceGeneration[name] = generation;
            for (let i = config.operator.validationRetryCount; i >= 0; i -= 1) {
                try {
                    handlerMap[path] = await createReportHandler(db, apiObj.spec);
                } catch (e) {
                    this.logger.error(`Error occurred while validating resource. '${e.code}'`, e);
                    switch (e.code) {
                        case 'ECONNRESET':
                        case 'EPIPE':
                        case 'ECONNABORTED':
                        case 'ER_QUERY_INTERRUPTED':
                        case 'ECONNREFUSED':
                        case 'ER_ACCESS_DENIED_ERROR':
                        case 'ETIMEDOUT':
                        case 'ENOTFOUND':
                            if (i !== 0) {
                                this.logger.info(`Retying after ${config.operator.validationRetryIntervalMs}ms...(${i} retries left)`);
                                await new Promise((resolve) => { setTimeout(resolve, config.operator.validationRetryIntervalMs); });
                                break;
                            }
                        // eslint-disable-next-line no-fallthrough
                        default:
                            await this.updateResourceStatus(apiObj, 'INVALID', e.message);
                            return;
                    }
                }
            }
            pathMap[path] = apiObj.spec.permission || name;
            await this.updateResourceStatus(apiObj, 'VALIDATED');
        } else if (phase === 'DELETED') {
            delete handlerMap[path];
            delete pathMap[path];
            delete this.resourceGeneration[name];
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
