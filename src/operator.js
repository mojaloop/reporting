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

const logger = new Logger();

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApiCustomObjects = kc.makeApiClient(k8s.CustomObjectsApi);

// Listen for events or notifications and act accordingly
const watch = new k8s.Watch(kc);

const resourceGeneration = {};

async function updateResourceStatus(apiObj, statusText, error) {
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
        await k8sApiCustomObjects.replaceNamespacedCustomObjectStatus(
            config.operator.resourceGroup,
            config.operator.resourceVersion,
            config.operator.namespace,
            config.operator.resourcePlural,
            apiObj.metadata.name,
            status,
        );
    } catch (err) {
        logger.error(`Error updating status of the custom resource ${apiObj.metadata.name}`, err.message);
    }
}

async function onEvent(reportData, phase, apiObj) {
    const name = apiObj?.metadata?.name;
    const path = apiObj.spec.endpoint.path.toLowerCase();
    const { handlerMap, pathMap, db } = reportData;
    if (name) {
        if (['ADDED', 'MODIFIED'].includes(phase)) {
            const { generation } = apiObj.metadata;
            if (resourceGeneration[name] === generation) {
                return;
            }
            resourceGeneration[name] = generation;
            try {
                handlerMap[path] = await createReportHandler(db, apiObj.spec);
            } catch (e) {
                await updateResourceStatus(apiObj, 'INVALID', e.message);
                return;
            }
            pathMap[path] = name;
            await updateResourceStatus(apiObj, 'VALID');
        } else if (phase === 'DELETED') {
            delete handlerMap[path];
            delete pathMap[path];
            delete resourceGeneration[name];
        } else {
            logger.warn(`Unknown event type: ${phase}`);
        }
    }
}

function watchResource(reportData) {
    return watch.watch(
        // eslint-disable-next-line max-len
        `/apis/${config.operator.resourceGroup}/${config.operator.resourceVersion}/namespaces/${config.operator.namespace}/${config.operator.resourcePlural}`,
        {},
        (phase, apiObj) => onEvent(reportData, phase, apiObj),
        () => setTimeout(watchResource, 1000),
    );
}

function startOperator(reportData) {
    watchResource(reportData).catch((err) => {
        if (err.message === 'No currently active cluster') {
            logger.error('Can not connect to K8S API');
        } else {
            logger.error(err.stack);
        }
    });
}

module.exports = { startOperator };
