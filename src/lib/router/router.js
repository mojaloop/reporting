/** ************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       James Bush - james.bush@modusbox.com                             *
 ************************************************************************* */


module.exports = (handlerMap) => async (ctx, next) => {
    const handlers = handlerMap[ctx.request.URL.pathname];
    const handler = handlers ? handlers[ctx.method.toLowerCase()] : undefined;

    ctx.assert(
        handler && handlers,
        404,
        'Not found',
    );

    ctx.state.logger.push({ handler }).log('Found handler');
    await handler(ctx);
    await next();
};
