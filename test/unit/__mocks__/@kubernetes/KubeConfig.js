class KubeConfig {
    constructor() {
        KubeConfig.instance = this;
    }

    loadFromDefault() { }

    makeApiClient() {
        return {
            async replaceNamespacedCustomObjectStatus() { },
        };
    }

    static getInstance() {
        return KubeConfig.instance;
    }
}

module.exports = KubeConfig;
