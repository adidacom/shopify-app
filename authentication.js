var jwt = require('jsonwebtoken');

var isAuthenticated = function (req, res, next) {
    var url = req.url.split('?')[0];
    if (url === '/' || url === '/callback') {
        next();
    } else {
        var token = req.headers['x-textual-auth'] || req.query.token;
        if (token) {
            jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
                if (err) {
                    return res.json({ success: false, message: 'Failed to authenticate token.' });
                } else {
                    req.decoded = decoded;
                    next();
                }
            });
        } else {
            return res.status(403).send({
                success: false,
                message: 'No token provided.'
            });
        }
    }
};

module.exports = isAuthenticated;