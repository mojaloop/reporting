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

module.exports.createAuthMiddleware = (oryKetoReadUrl) => {
    let oryKetoReadApi;
    if (oryKetoReadUrl) {
        oryKetoReadApi = new keto.ReadApi(undefined, oryKetoReadUrl);
    }

    const checkPermission = async (userId, obj) => {
        const response = await oryKetoReadApi.getCheck('permission', obj, 'access', userId);
        return response.data.allowed;
    };

    return async (ctx, next) => {
        let grant = true;
        if (oryKetoReadApi) {
            const { userId } = jwtDecode(ctx.req.headers.token_id);
            grant = await checkPermission(userId, ctx.req.path);
        }
        if (grant) {
            await next();
        } else {
            ctx.response.status = 403;
        }
    };
};
