/** ************************************************************************
 *  (C) Copyright Mojaloop Foundation 2020                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Vijay Kumar Guthi <vijaya.guthi@modusbox.com>                   *
 ************************************************************************* */

const rc = require('rc');
const parse = require('parse-strings-in-object');
const Config = require('./data/config.json');

const RC = parse(rc('OPERATOR', Config));

module.exports = RC;
