class KubeConfig {
    constructor() {
        KubeConfig.instance = this;
    }

    // eslint-disable-next-line class-methods-use-this
    loadFromDefault() { }

    static getInstance() {
        return KubeConfig.instance;
    }
}

module.exports = KubeConfig;
