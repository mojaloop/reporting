/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2020                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Vijay Kumar Guthi <vijaya.guthi@modusbox.com>                   *
 ************************************************************************* */

const k8s = require('@kubernetes/client-node');
const { Logger } = require('@mojaloop/sdk-standard-components').Logger;

const Config = require('./config');
const sampleResource1 = require('./data/sample-resource1.json');

jest.unmock('@kubernetes/client-node');
jest.setTimeout(50000);

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const logger = new Logger({ stringify: () => '' });

// If we want to do something in K8S, we can use the following APIs
// const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sApiCustomObjects = kc.makeApiClient(k8s.CustomObjectsApi);
// const k8sApiPods = kc.makeApiClient(k8s.CoreV1Api);

describe('K8S operator', () => {
    it('Clear all the K8S custom resources', async () => {
        try {
            await k8sApiCustomObjects.deleteNamespacedCustomObject(
                Config.WATCH_RESOURCE_GROUP,
                Config.WATCH_RESOURCE_VERSION,
                Config.WATCH_NAMESPACE,
                Config.WATCH_RESOURCE_PLURAL,
                sampleResource1.metadata.name,
            );
        } catch (err) {
            logger.info(err.message);
        }
    });
    it('Wait for some time', async () => {
        await new Promise((resolve) => { setTimeout(resolve, 3 * Config.WAIT_TIME_MS_AFTER_K8S_RESOURCE_CHANGE); });
    });
    it('Add a K8S custom resource', async () => {
        const status = await k8sApiCustomObjects.createNamespacedCustomObject(
            Config.WATCH_RESOURCE_GROUP,
            Config.WATCH_RESOURCE_VERSION,
            Config.WATCH_NAMESPACE,
            Config.WATCH_RESOURCE_PLURAL,
            sampleResource1,
        );
        expect(status.response.statusCode).toEqual(201);
    });
    it('Wait for some time', async () => {
        await new Promise((resolve) => { setTimeout(resolve, 3 * Config.WAIT_TIME_MS_AFTER_K8S_RESOURCE_CHANGE); });
    });
    it('Get the status of the custom resource', async () => {
        const status = await k8sApiCustomObjects.getNamespacedCustomObjectStatus(
            Config.WATCH_RESOURCE_GROUP,
            Config.WATCH_RESOURCE_VERSION,
            Config.WATCH_NAMESPACE,
            Config.WATCH_RESOURCE_PLURAL,
            sampleResource1.metadata.name,
        );
        expect(status.response.statusCode).toEqual(200);
        expect(status.response.body).toHaveProperty('metadata');
        expect(status.response.body.metadata).toHaveProperty('name');
        expect(status.response.body.metadata.name).toEqual(sampleResource1.metadata.name);
        expect(status.response.body).toHaveProperty('status');
        expect(status.response.body.status).toHaveProperty('state');
        expect(status.response.body.status.state).toEqual('VALID');
    });
    it('Remove the K8S custom resource', async () => {
        const status = await k8sApiCustomObjects.deleteNamespacedCustomObject(
            Config.WATCH_RESOURCE_GROUP,
            Config.WATCH_RESOURCE_VERSION,
            Config.WATCH_NAMESPACE,
            Config.WATCH_RESOURCE_PLURAL,
            sampleResource1.metadata.name,
        );
        expect(status.response.statusCode).toEqual(200);
    });
});
