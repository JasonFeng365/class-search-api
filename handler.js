'use strict';
const app = require('./index.js');
const serverless = require('serverless-http');
module.exports.classSearchAPI = serverless(app)