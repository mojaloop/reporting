/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2020                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 ************************************************************************* */

const keto = require('@ory/keto-client');

module.exports.createAuthMiddleware = (userIdHeader, oryKetoReadUrl) => {
    const oryKetoReadApi = new keto.ReadApi(undefined, oryKetoReadUrl);

    const opts = {
        validateStatus: () => true,
    };

    const getParticipantsByUserId = async (userId) => {
        const response = await oryKetoReadApi.getRelationTuples('participant', undefined, 'member', userId);
        return response.data.relation_tuples.map(({ object }) => object);
    };

    const canAccessReport = async (userId, obj) => {
        const response = await oryKetoReadApi.getCheck('permission', obj, 'granted', userId, opts);
        return response.data.allowed;
    };

    const canAccessParticipant = async (ctx) => {
        const queryParams = ctx.request.query;
        const grants = await Promise.all(Object.entries(queryParams)
            .filter(([k]) => /^d?fspId$/i.test(k))
            .map(([, fspId]) => ctx.state.participants.includes(fspId)));
        return grants.every(Boolean);
    };

    return async (ctx, next) => {
        const userId = ctx.req.headers[userIdHeader];
        ctx.state.participants = await getParticipantsByUserId(userId);
        const obj = ctx.state.reportData.pathMap[ctx.request.URL.pathname.toLowerCase()];
        if (!obj) {
            ctx.response.status = 404;
            return;
        }
        const grants = await Promise.all([
            canAccessReport(userId, obj),
            canAccessParticipant(ctx),
        ]);
        if (grants.every(Boolean)) {
            await next();
        } else {
            ctx.response.status = 403;
        }
    };
};
