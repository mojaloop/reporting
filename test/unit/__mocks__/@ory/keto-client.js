class ReadApi {
    constructor() {
        ReadApi.instance = this;
    }

    getRelationTuples() { }

    getCheck() { }

    static getInstance() {
        return ReadApi.instance;
    }
}

module.exports = {
    ReadApi,
};
