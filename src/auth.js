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
    let oryKetoReadApi;
    if (oryKetoReadUrl) {
        oryKetoReadApi = new keto.ReadApi(undefined, oryKetoReadUrl);
    }

    const opts = {
        validateStatus: () => true,
    };

    const getParticipantsByUserId = async (userId) => {
        const response = await oryKetoReadApi.getRelationTuples('participant', undefined, 'member', userId);
        return response.data.relation_tuples.map(({ object }) => object);
    };

    const checkPermission = async (userId, obj) => {
        const response = await oryKetoReadApi.getCheck('permission', obj, 'granted', userId, opts);
        return response.data.allowed;
    };

    return async (ctx, next) => {
        let grant = true;
        if (oryKetoReadApi) {
            const userId = ctx.req.headers[userIdHeader];
            ctx.state.participants = await getParticipantsByUserId(userId);
            grant = await checkPermission(userId, ctx.req.path);
            if (grant) {
                const params = ctx.request.URL.searchParams;
                for (const [name, value] of params) {
                    if (/d?fspId/i.test(name)) {
                        grant &= ctx.state.participants.includes(value);
                    }
                }
            }
        }
        if (grant) {
            await next();
        } else {
            ctx.response.status = 403;
        }
    };
};
