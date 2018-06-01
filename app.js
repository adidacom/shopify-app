var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var errorHandlingMiddleware = require('./error-handling');

var index = require('./routes/index');
var product = require('./routes/product');
var shopify = require('./routes/shopify');

var app = express();

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({ extended: false, limit: '5mb' }));
app.use(cookieParser());

app.use('/app/shopify', express.static(path.join(__dirname, 'public')));

app.use('/app/shopify', index);
app.use('/app/shopify/product', product);
app.use('/app/shopify/shopify', shopify);

// error handler
app.use(errorHandlingMiddleware.handle);

module.exports = app;
