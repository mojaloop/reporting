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
const ejs = require('ejs');
const config = require('./config');
const { createReportHandler } = require('./handlers');

const logger = new Logger();

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// const k8sApiMC = kc.makeApiClient(k8s.CustomObjectsApi);

// Listen for events or notifications and act accordingly
const watch = new k8s.Watch(kc);

async function onEvent(reportData, phase, apiObj) {
    logger.info(`Received event in phase ${phase} for the resource ${apiObj?.metadata?.name}`);

    const name = apiObj?.metadata?.name;
    const path = apiObj.spec.endpoint.path.toLowerCase();
    const { handlerMap, renderMap, pathMap } = reportData;
    if (name) {
        if (phase === 'ADDED') {
            renderMap[name] = ejs.compile(apiObj.spec.template);
            handlerMap[path] = createReportHandler(renderMap[name], apiObj.spec);
            pathMap[path] = name;
        } else if (phase === 'MODIFIED') {
            renderMap[name] = ejs.compile(apiObj.spec.template);
            handlerMap[path] = createReportHandler(renderMap[name], apiObj.spec);
            pathMap[path] = name;
        } else if (phase === 'DELETED') {
            delete handlerMap[path];
            delete renderMap[name];
            delete pathMap[path];
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
