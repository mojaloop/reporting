class ReadApi {
    constructor() {
        ReadApi.instance = this;
    }

    // getRelationTuples(ns, obj, rel, subj) {
    //     return {
    //         data: {
    //             relation_tuples: this.tuples.filter((t) => t.)
    //         },
    //     };
    // }
    //
    // getCheck() {
    //
    // }

    static getInstance() {
        return ReadApi.instance;
    }
}

module.exports = {
    ReadApi,
};
