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
const path = require('path');

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

    function isNumeric(value) {
        return /^\d+$/.test(value);
    }

    return async (ctx, next) => {
        let grant = true;
        if (oryKetoReadApi) {
            const userId = ctx.req.headers[userIdHeader];
            ctx.state.participants = await getParticipantsByUserId(userId);
            const obj = path.parse(ctx.request.URL.pathname.toLowerCase().substr(1)).name;
            grant = await checkPermission(userId, obj);
            if (grant) {
                const params = ctx.request.URL.searchParams;
                for await (const [name, value] of params) {
                    if (/d?fspId/i.test(name)) {
                        let participant;
                        if (isNumeric(value)) {
                            const queryName = 'SELECT name FROM participant WHERE participantId = :id';
                            participant = (await ctx.db.query(queryName, { id: value }))[0]?.name;
                        } else {
                            participant = value;
                        }
                        grant &&= ctx.state.participants.includes(participant);
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
