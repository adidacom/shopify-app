var mysql = require('mysql');
var fs = require('fs');
var TextualServerError = require('../textual_server_error');

function createPool(databaseName){
	var production = process.env.PRODUCTION;
	if (production && production==="TRUE") {
	    return mysql.createPool({
	    	        database: databaseName,
	    	        host: process.env.MYSQL_DB_HOST,
	    	        user: process.env.TEXTUAL_DB_USER,
	    	        password: process.env.TEXTUAL_DB_PASSWORD
	    	    });
	} else {
	    return mysql.createPool({
	    	        database: databaseName,
	    	        host: process.env.MYSQL_DB_HOST,
	    	        user: process.env.TEXTUAL_DB_USER,
	    	        password: process.env.TEXTUAL_DB_PASSWORD,
	    	        ssl :{
	    	            ca : fs.readFileSync('ssl/server-ca.pem'),
	    	            cert : fs.readFileSync('ssl/client-cert.pem'),
	    	            key : fs.readFileSync('ssl/client-key.pem')
	    	        }
	    	    });
	}
}

function getConnection (databaseName, callback) {
	switch(databaseName){
		case process.env.HITL_DB:
			return interim_reports.getConnection(callback);
		case process.env.DB_TEXTUAL:
			return textual_db.getConnection(callback);
		case process.env.DB_WEBAPP:
			return webapp_db.getConnection(callback);
		case process.env.TEMPLATE_DB:
			return template_db.getConnection(callback);
		case process.env.PRODUCT_DB:
			return product_db.getConnection(callback);
		case process.env.DB_CUSTOMER:
			return customer_db.getConnection(callback);
		default:
			return callback(new TextualServerError("Connection not found"), null);
	}
}

var template_db = createPool(process.env.TEMPLATE_DB);
var interim_reports = createPool(process.env.HITL_DB);
var product_db = createPool(process.env.PRODUCT_DB);
var textual_db = createPool(process.env.DB_TEXTUAL);
var webapp_db = createPool(process.env.DB_WEBAPP);
var customer_db = createPool(process.env.DB_CUSTOMER);

process.on('SIGINT', function() {
  template_db.end(function (err) {
    process.exit(0);
  });
  interim_reports.end(function (err) {
    process.exit(0);
  });
  textual_db.end(function (err) {
    process.exit(0);
	});
	product_db.end(function (err) {
    process.exit(0);
  });
});

module.exports = {
	getConnection: getConnection
};
