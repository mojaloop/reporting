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
const jwtDecode = require('jwt-decode');

module.exports.createAuthMiddleware = (userTokenHeaderName, oryKetoReadUrl) => {
    let oryKetoReadApi;
    if (oryKetoReadUrl) {
        oryKetoReadApi = new keto.ReadApi(undefined, oryKetoReadUrl);
    }

    const getParticipantsByUserId = async (userId) => {
        const response = await oryKetoReadApi.getRelationTuples(
            'participant',
            undefined,
            undefined,
            undefined,
            'member',
            userId,
        );
        return response.data.relation_tuples.map(({ object }) => object);
    };

    const checkPermission = async (userId, obj) => {
        const response = await oryKetoReadApi.getCheck('permission', obj, 'access', userId);
        return response.data.allowed;
    };

    return async (ctx, next) => {
        let grant = true;
        if (oryKetoReadApi) {
            const { userId } = jwtDecode(ctx.req.headers[userTokenHeaderName]);
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
