var express = require('express');
var router = express.Router();
var users = require('../textual-users');
var textualRequest = require('./../textual-request');
var TextualServerError = require('./../textual_server_error');

var isAuthenticated = require('./../authentication');
var jwt = require('jsonwebtoken');

const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce')();
const querystring = require('querystring');
const request = require('request-promise');

const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
const jwtSecret = process.env.JWT_SECRET;
const customer_url = process.env.CUSTOMER_CREATE_OR_GET
const payment_url = process.env.CUSTOMER_SET_PAYMENT_ID

const scopes = 'read_products,write_products,write_script_tags';
const forwardingAddress = process.env.FORWARD_ADDRESS; // Replace this with your HTTPS Forwarding address


var getUserData = function (shopResponse, accessToken, callback) {
    if (users.userMap[shopResponse.id]) {
        var userData = users.userMap[shopResponse.id];
        userData['token'] = accessToken;
        return callback(userData);
    } else {
        var opt = {
            body: {
                id: shopResponse.id,
                name: shopResponse.name,
                url: shopResponse.myshopify_domain
            },
            method: 'POST',
            omit_customer_id: true
        };
        var url = customer_url;
        textualRequest.call({}, url, opt).then(function (data) {
            data = data.data;
            data['token'] = accessToken;
            users.userMap[data.shop_id] = data;
            return callback(data);
        }).catch(function (err) {
            console.log(err);
            return callback(null);
        });
    }
};

var activateCharge = function (userData, callback) {
    const shop = userData.shop_url;
    const chargeId = userData.payment_id;
    const shopRequestHeaders = {
        'X-Shopify-Access-Token': userData.token,
    };
    var chargeActivateUrl = 'https://' + shop + '/admin/recurring_application_charges/' + chargeId + '/activate.json';
    opt = {
        method: 'POST',
        uri: chargeActivateUrl,
        data: chargeStatus,
        json: true,
        headers: shopRequestHeaders
    };
    request(opt)
        .then((activateResponse) => {
            return callback(null, activateResponse);
        })
        .catch((error) => {
            console.log(error);
            return callback(error, null);
        });
};

var makeChargeRequest = function (userData, callback) {
    const accessToken = userData.token;
    const shop = userData.shop_url;
    const chargeUrl = 'https://' + shop + '/admin/recurring_application_charges.json'
    const redirectUri = 'https://' + shop + '/admin/apps/' + apiKey;
    const shopRequestHeaders = {
        'X-Shopify-Access-Token': accessToken,
    };
    var opt = {
        method: 'POST',
        uri: chargeUrl,
        body: {
            "recurring_application_charge": {
                "name": "Textual app monthly payment",
                "price": 20.0,
                "return_url": redirectUri,
                "test": true
            }
        },
        json: true, // Automatically stringifies the body to JSON
        headers: shopRequestHeaders
    };
    request(opt)
        .then((chargeResponse) => {
            userData.payment_id = chargeResponse.recurring_application_charge.id;
            users.userMap[userData.shop_id] = userData;
            var opt = {
                body: {
                    payment_id: userData.payment_id
                },
                method: 'PUT'
            };
            const url = payment_url;
            textualRequest.call({ customer_id: userData.customer_id }, url, opt).then((data) => {
                return callback(null, chargeResponse.recurring_application_charge);
            }).catch((error) => {
                console.log(error);
                return callback(error, null);
                // res.status(error.code).send(error.error);
            });
        }).catch((error) => {
            console.log(error);
            return callback(error, null);
            // res.status(error.statusCode).send(error.error.error_description);
        });
}

var removeDevelopmentScripts = function (userData) {
    const accessToken = userData.token;
    const shop = userData.shop_url;
    const scriptUrl = 'https://dev.textual.se/app/shopify/js/shopify/descriptionEdit.js'
    const scriptTagUrl = 'https://' + shop + '/admin/script_tags.json';
    const shopRequestHeaders = {
        'X-Shopify-Access-Token': accessToken,
    };
    var opt = {
        method: 'GET',
        uri: scriptTagUrl,
        json: true, // Automatically stringifies the body to JSON
        headers: shopRequestHeaders
    }
    request(opt)
        .then((scriptResponse) => {
            scriptResponse.script_tags.forEach((script) => {
                if (script.src != scriptUrl) {
                    var opt = {
                        method: 'DELETE',
                        uri: 'https://' + shop + '/admin/script_tags/' + script.id + '.json',
                        json: true,
                        headers: shopRequestHeaders
                    };
                    request(opt)
                        .then((res) => {
                            console.log("script deleted: ", script.src);
                        })
                        .catch(function (err) {
                            console.log(err);
                        });
                }
            });
        })
        .catch(function (err) {
            console.log(err);
        });
}

var insertScript = function (userData, callback) {
    removeDevelopmentScripts(userData);
    const accessToken = userData.token;
    const shop = userData.shop_url;
    const scriptUrl = forwardingAddress + '/js/shopify/descriptionEdit.js'
    const scriptTagUrl = 'https://' + shop + '/admin/script_tags.json?src=' + scriptUrl;
    const shopRequestHeaders = {
        'X-Shopify-Access-Token': accessToken,
    };
    var opt = {
        method: 'GET',
        uri: scriptTagUrl,
        json: true, // Automatically stringifies the body to JSON
        headers: shopRequestHeaders
    }
    request(opt)
        .then((scriptStatusResponse) => {
            if (scriptStatusResponse.script_tags.length == 0) {
                const scriptTagInsertUrl = 'https://' + shop + '/admin/script_tags.json';
                opt = {
                    method: 'POST',
                    uri: scriptTagInsertUrl,
                    body: {
                        script_tag: {
                            'event': 'onload',
                            'src': scriptUrl
                        }
                    },
                    json: true,
                    headers: shopRequestHeaders
                };
                request(opt)
                    .then((scriptResponse) => {
                        callback(null, scriptResponse);
                    })
                    .catch((error) => {
                        callback(error, null);
                    });
            } else {
                callback(null, 'script already inserted');
            }
        })
        .catch((error) => {
            callback(error, null);
        });
}

// router.use(isAuthenticated);

router.get('/', (req, res) => {
    const shop = req.query.shop;
    if (shop) {
        const state = nonce();
        const redirectUri = forwardingAddress + '/shopify/callback';
        const installUrl = 'https://' + shop +
            '/admin/oauth/authorize?client_id=' + apiKey +
            '&scope=' + scopes +
            '&state=' + state +
            '&redirect_uri=' + redirectUri;

        res.cookie('state', state);
        res.redirect(installUrl);
    } else {
        return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
    }
});

router.get('/callback', (req, res) => {

    const { shop, hmac, code, state } = req.query;
    const stateCookie = req.cookies.state;

    if (state !== stateCookie) {
        return res.status(403).send('Request origin cannot be verified');
    }

    if (shop && hmac && code) {
        // DONE: Validate request is from Shopify
        const map = Object.assign({}, req.query);
        delete map['signature'];
        delete map['hmac'];
        const message = querystring.stringify(map);
        const generatedHash = crypto
            .createHmac('sha256', apiSecret)
            .update(message)
            .digest('hex');

        if (generatedHash !== hmac) {
            return res.status(400).send('HMAC validation failed');
        }

        // DONE: Exchange temporary code for a permanent access token
        const accessTokenRequestUrl = 'https://' + shop + '/admin/oauth/access_token';
        const accessTokenPayload = {
            client_id: apiKey,
            client_secret: apiSecret,
            code,
        };
        request.post(accessTokenRequestUrl, { json: accessTokenPayload })
            .then((accessTokenResponse) => {
                const accessToken = accessTokenResponse.access_token;
                const shopRequestHeaders = {
                    'X-Shopify-Access-Token': accessToken,
                };
                const shopAccessUrl = 'https://' + shop + '/admin/shop.json';
                var opt = {
                    method: 'GET',
                    uri: shopAccessUrl,
                    headers: shopRequestHeaders
                }
                request(opt)
                    .then((shopResponse) => {
                        shopResponse = JSON.parse(shopResponse).shop;
                        getUserData(shopResponse, accessToken, (userData) => {
                            var payload = userData;
                            users.cookieMap[stateCookie] = payload;
                            res.cookie('state', stateCookie);
                            res.redirect('/app/shopify/');
                        });
                    })
                    .catch((error) => {
                        console.log(error);
                        res.status(error.statusCode).send(error.error.error_description);
                    });
            })
            .catch((error) => {
                console.log(error);
                res.status(error.statusCode).send(error.error.error_description);
            });
    } else {
        res.status(400).send('Required parameters missing');
    }
});

router.get('/charge', function(req, res, next){
    const stateCookie = req.cookies.state;
    var userData = users.cookieMap[stateCookie];
    
    if (userData && userData.payment_id) {
        const chargeId = userData.payment_id;
        var payload = userData;
        var userToken = jwt.sign(payload, jwtSecret, {
            expiresIn: "24h" // expires in 24 hours
        });

        const chargeStatusUrl = 'https://' + shop + '/admin/recurring_application_charges/' + chargeId + '.json';
        var opt = {
            method: 'GET',
            uri: chargeStatusUrl,
            headers: shopRequestHeaders
        };
        request(opt)
            .then((chargeStatusResponse) => {
                chargeStatusResponse = JSON.parse(chargeStatusResponse).recurring_application_charge;
                chargeStatus = chargeStatusResponse.status;
                switch (chargeStatus) {
                    case 'pending':
                        console.log("in panding status");
                        res.render('shopify/redirectCharge', { redirect: chargeStatusResponse.confirmation_url });
                        break;
                    case 'accepted':
                        console.log("in accepted");
                        insertScript(userData, (error, scriptResponse) => {
                            if (error) {
                                console.log(error);
                            } else {
                                console.log(scriptResponse);
                            }
                        });
                        activateCharge(userData, (error, chargeStatus) => {
                            if (error) {
                                console.log(error);
                                res.status(error.statusCode).send(error.error.error_description);
                            } else {
                                console.log("payment activated");
                                res.render('shopify/shopifyIndex', { token: userToken });
                            }
                        });
                        break;
                    case 'active':
                        console.log('payment active');
                        insertScript(userData, (error, scriptResponse) => {
                            if (error) {
                                console.log(error);
                            } else {
                                console.log(scriptResponse);
                            }
                        });
                        res.render('shopify/shopifyIndex', { token: userToken });
                        break;
                    default:
                        makeChargeRequest(userData, (error, chargeResponse) => {
                            if (error) {
                                res.status(error.statusCode || error.code).send(error.error.error_description || error.error);
                            } else {
                                res.render('shopify/redirectCharge', { redirect: chargeResponse.confirmation_url })
                            }
                        });
                        break;
                }
            })
            .catch((error) => {
                console.log(error);
                res.status(error.statusCode).send(error.error.error_description);
            });
    } else {
        makeChargeRequest(userData, (error, chargeResponse) => {
            if (error) {
                res.status(error.statusCode || error.code).send(error.error.error_description || error.error);
            } else {
                res.render('shopify/redirectCharge', { redirect: chargeResponse.confirmation_url })
            }
        });
    }
});


router.post('/push', function (req, res, next) {
    var userData = req.decoded;
    const accessToken = userData.token;
    const shop = userData.shop_url;

    const shopRequestHeaders = {
        'X-Shopify-Access-Token': accessToken,
    };
    var shopifyProduct = req.body.shopifyProduct;
    const shopifyProductId = users.productMap[req.body.productId];
    if (shopifyProductId) {
        const shopRequestUrl = 'https://' + shop + '/admin/products/' + shopifyProductId + '.json';
        shopifyProduct.id = shopifyProductId;
        var opt = {
            method: 'PUT',
            uri: shopRequestUrl,
            body: {
                product: shopifyProduct
            },
            json: true, // Automatically stringifies the body to JSON
            headers: shopRequestHeaders
        };
        request(opt)
            .then((shopResponse) => {
                res.json({ 'message': 'Product updated to shopify!' });
            })
            .catch((error) => {
                console.log(error);
                next(error);
            });
    } else {
        const shopRequestUrl = 'https://' + shop + '/admin/products.json';
        var opt = {
            method: 'POST',
            uri: shopRequestUrl,
            body: {
                product: shopifyProduct
            },
            json: true, // Automatically stringifies the body to JSON
            headers: shopRequestHeaders
        };
        request(opt)
            .then((shopResponse) => {
                users.productMap[req.body.productId] = shopResponse.product.id;
                res.json({ 'message': 'Product send to shopify!' });
            })
            .catch((error) => {
                console.log(error);
                next(error);
            });
    }

});


module.exports = router;
