class ReadApi {
    constructor() {
        ReadApi.instance = this;
    }

    // eslint-disable-next-line class-methods-use-this
    getRelationTuples() { }

    // eslint-disable-next-line class-methods-use-this
    getCheck() { }

    static getInstance() {
        return ReadApi.instance;
    }
}

module.exports = {
    ReadApi,
};
