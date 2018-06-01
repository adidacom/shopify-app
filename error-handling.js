var TextualServerError = require('./textual_server_error');

var handle = function(err, req, res, next) {
	console.log("error-handling:", err);
	if((process.env.PRODUCTION == "FALSE") || (err instanceof TextualServerError)){
		if(req.xhr){
			var ret = {message: err.message};
			if (err.status) {
				ret.status = err.status;
			}
			res.send(500, ret);
		}
  		res.render('error', {'message': err.message});
	}else{
		if(req.xhr){
			res.send(500, {message: "An error has occured"});
		}
		if(err.status === 500){
			console.log("?????????");
		}
		res.render('error', {'message': "An error has occured"});
	}
};

module.exports = {handle: handle};