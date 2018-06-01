'use strict';
var fetch = require('node-fetch');
var TextualServerError = require('./textual_server_error');

module.exports = function TextualRequest(url, options) {
	if (typeof this != 'undefined') {

		options.body = (options.body ? options.body : null);
		// set customer_id for each request
		if (options.body && options.body.omit_customer_id === true) {
			delete options.body.omit_customer_id;
		} else if (url.indexOf('customer_id') === -1 && this.customer_id) {
			if (options.body) {
				options.body.customer_id = this.customer_id;
			}
			var separator = (url.indexOf('?') > -1 ? '&' : '?');
			url = url.trim() + separator + 'customer_id=' + this.customer_id;
		}
	}
	if ('body' in options) {
		if (options.body) {
			options.body = JSON.stringify(options.body);	
		} else {
			delete(options.body);
		}
	}

	options.timeout = parseInt(process.env.TIMEOUT, 10);
	options.headers = Object.assign(
		(options.headers) ? options.headers : {},
		{
			'Content-Type': 'application/json',
			'Accept': 'application/json',
		}
	);
	return fetch(url, options).then(function (res) {
		if (res.status !== 200) {
			if (res.status === 204) {
				return {
					ok: true,
					data: []
				};
			}
			return res.json().then(function (data) {
				var errorMessage = (data && data.error) ? data.error : res.statusText;
				var error = new TextualServerError(errorMessage);
				error.status = res.status;
				throw error;
			});
		}
		return res.json();
	}).then(function (data) {
		if (data.ok) {
			return data;
		} else {
			throw new TextualServerError(data.error);
		}
	});
};