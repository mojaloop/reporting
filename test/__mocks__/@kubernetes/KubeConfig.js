class KubeConfig {
    constructor() {
        KubeConfig.instance = this;
    }

    // eslint-disable-next-line class-methods-use-this
    loadFromDefault() { }

    // eslint-disable-next-line class-methods-use-this
    makeApiClient() {
        return {
            // eslint-disable-next-line no-empty-function
            async replaceNamespacedCustomObjectStatus() { },
        };
    }

    static getInstance() {
        return KubeConfig.instance;
    }
}

module.exports = KubeConfig;
