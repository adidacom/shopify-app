var textualRequest = require('./textual-request');
var db = require('./database/poolDatabase');

const product_generate_url = process.env.PRODUCTS_URL;
const product_pod_url = process.env.PRODUCT_POD_URL;
const vocabulary_pod_url = process.env.VOCABULARY_POD_URL;
const vocabulary_gf_url = process.env.VOCABULARY_GF_URL;
const hangTimeout = process.env.HANG_TIMEOUT;

var productCache = null;
var vocabularyCache = null;


var _delay = function(t, v) {
	return new Promise(function(resolve) { 
       setTimeout(resolve.bind(null, v), t);
   });
};


var _getExistingTags = function(customer_id) {
    const url = vocabulary_gf_url;

    if (vocabularyCache) {
		return Promise.resolve(vocabularyCache);
	}

    return textualRequest.call({customer_id: customer_id}, url, {method: "GET"}).then(function (data) {
    	vocabularyCache = data.data;
        return vocabularyCache;
    }).catch(function (err) {
        return { ok: false };
    });  
};

var _matchExistingTags = function(tagArray, vocabularies) {
    for (var i = 0; i < tagArray.length; i++) {
        tag = tagArray[i];
        tag.existingTags = [];
        if (tag.tag_values) {
            for (var j = 0; j < tag.tag_values.length; j++) {
            	type = tag.tag_type;
            	type = type.substr(type.length - 5) === "_list" ? type.substr(0, type.length - 5) : type;
                name = tag.tag_values[j].value + "_" + type;
                for (var k = 0; k < vocabularies.length; k++) {
                    if (vocabularies[k].word == name || (vocabularies[k].type == tag.tag_type && vocabularies[k].word == "<any>")) {
                    	tag.existingTags.push(tag.tag_type + "_" + tag.tag_values[j].value);
                        break;
                    }
                }
            }
        }
    }
};


var getCustomerLanguages = function(customer_id) {
	return new Promise(function (resolve, reject) {
		db.selectMultiple(process.env.DB_WEBAPP, 'customer_language', "customer_id", customer_id, function(err, result) {
			if (err) {
				console.log("Error retrieving customer languages: " + err.message);
				return resolve([]);
			}

			languages = [];
			result.forEach(function(item){
				languages.push(item.language);
			});
			return resolve(languages);
		});
	});
};

var getCategories = function (customer_id) {
	const url = product_pod_url + 'category';
	return textualRequest.call({ customer_id: customer_id }, url, {method: "GET"}).then(function (data) {
		return data.data;
	}).catch(function (err) {
		return [];
	});
};


var _splitHeadlines = function(headlines, tags) {
	return headlines.reduce(function (returnValue, currentValue) {
		if ('headline_singular' in currentValue && currentValue.headline_singular) {
			if (!currentValue.tag_values) {
				var headlineTags = tags.filter(function(tagObject) {
					return tagObject.category == currentValue.tag_category &&
							tagObject.type == currentValue.tag_type;
				});

				if (headlineTags.length > 0) {
					currentValue.tag_values = headlineTags.reduce(function(returnValue, currentValue) {
						if (currentValue.value) {
							returnValue.push(currentValue.value);
						} else if (currentValue.tags) {
							for (var i = 0; i < currentValue.tags.length; i++) {
								returnValue.push(currentValue.tags[i].value);	
							}
						}
						return returnValue;
					}, []);
				}
			}
			var headline = returnValue.withHeadline.find(function(item){
				return item[0].headline_singular.default == currentValue.headline_singular.default;
			});
			if (headline) {
				headline.push(currentValue);
			} else {
				returnValue.withHeadline.push([currentValue]);
			}

		} else {
			if (currentValue.tag_values) {
				returnValue.others.push(currentValue);
			}
		}
		return returnValue;
	}, { withHeadline: [], others: [] });
};


var createNewProduct = function(productJSON, customer_id, return_data = true) {
	const url = product_pod_url + "product";

	productJSON.return_data = return_data;

	var opt = {
		method: "POST",
		body: productJSON
	};

	return textualRequest.call({ customer_id: customer_id }, url, opt).then(function (data) {
		productCache = data.data;
		return data.data;
	}).catch(function (err) {
		return Promise.reject(err);
	});
};


var getProductCategorySubparts = function(productCategory, languages, customer_id) {
	var url = vocabulary_pod_url + "kind/" + productCategory + "/subpart";
	if (languages && languages.length > 0) {
		url += "?";

		languages.forEach(function(item) {
			url += "language=" + item + "&";
		});

		url = url.slice(0, -1);
	}

	return textualRequest.call({ customer_id: customer_id }, url, {}).then(function (data) {
		return data.data;
	}).catch(function (err) {
		return Promise.reject(err);
	});
};


var _getProductCategoryTags = function(productCategory, customer_id) {
	const url = vocabulary_pod_url + "vertical/" + productCategory + "?headlines=0";
	return textualRequest.call({ customer_id: customer_id }, url, {}).then(function (data) {
		return data.data;
	}).catch(function (err) {
		return Promise.reject(err);
	});
};


var getProductTags = function(productId, customer_id){
	const url = product_pod_url + "product/" + productId;

	if (productCache) {
		return Promise.resolve(productCache);
	}

	return textualRequest.call({ customer_id: customer_id }, url, {}).then(function (data) {
		return data.data;
	}).catch(function (err) {
		return Promise.reject(err);
	});
};


var getProduct = function(productId, customer_id) {

	return getProductTags(productId, customer_id).then(function (tags) {
		productCache = null;
		var productName = {}, productKind, productCategory, productBrand = {};
		for (var i = 0; i < tags.length; i++) {
			if (tags[i].category === 'identifier') {
				if (tags[i].type === 'name') {
					productName.name = tags[i].value;
					productName.id = tags[i].id;
				} else if (tags[i].type === 'kind') {
					kind = tags[i].value;
				} else if (tags[i].type === 'brand') {
					productBrand.name = tags[i].value;
					productBrand.id = tags[i].id;
				}
			} else if (tags[i].category === 'category') {
				productCategory = tags[i].value;
			}
		}
		return _delay(hangTimeout).then(function () {
			return getCustomerLanguages(customer_id).then(function(languages){
				return _delay(hangTimeout).then(function () {
					return _getProductCategoryTags(productCategory, customer_id).then(function (categoryTags) {
						return _delay(hangTimeout).then(function () {              
				            return _getExistingTags(customer_id).then(function(vocabularies) {
				            	return _delay(hangTimeout).then(function () {
				            		return getProductCategorySubparts(productCategory, languages, customer_id).then(function (subpartKinds) {
					            		return _delay(hangTimeout).then(function () {
					            			return getCategoryKinds(productCategory, languages, customer_id).then(function(categoryKinds){
					            				var productCategoryName = "";
					            				var productKind = categoryKinds.data.find(function(item) {
					            					return item.kind.value == kind;
					            				});
					            				if (productKind) {
					            					productCategoryName = productKind.category_display_name;
					            				} else {
					            					productCategoryName = categoryKinds.data[0].category_display_name;
					            				}

								                _matchExistingTags(categoryTags, vocabularies);

												var groupedHeadlines = _splitHeadlines(categoryTags, tags);
												return {
													productName: productName,
													productKind: productKind,
													productCategoryName: productCategoryName,
													productCategory: productCategory,
													groupedHeadlines: groupedHeadlines,
													productBrand: productBrand,
													tags: tags,
													kinds: subpartKinds,
													languages: languages,
												};
											}).catch(function (err) {
												return Promise.reject(err);
											});
										});
									});
								});
			            	}).catch(function (err) {
								return Promise.reject(err);
							});
						});
					}).catch(function (err) {
						return Promise.reject(err);
					});
				});
			}).catch(function (err) {
				return Promise.reject(err);
			});
		});
	}).catch(function (err) {
		return Promise.reject(err);
	});
};

var _getPageQueryParams = function(category, displayCondition, offset) {
	var queryParams = "";
	if (category) {
		queryParams = "?category=" + category;
		if (displayCondition) {
			queryParams += "&offset=" + offset;
		} 
	} else {
		if (displayCondition) {
			queryParams += "?offset=" + offset;
		} 
	}

	return queryParams;
};


var _getProductList = function (category, offset, perPage, customer_id) {
	var url = product_pod_url + "product" + "?customer_id=" + customer_id;

	if (category) {
		url += "&category=" + category;
	}

	offset = parseInt(offset ? offset : 0, 10);
	url += "&amount=" + perPage;
	url += "&offset=" + offset;
	var nextPage = offset + perPage;
	var prevPage = offset - perPage;

	return textualRequest.call({ customer_id: customer_id }, url, {}).then(function (data) {
		var products = [];
		var project_ids = [];
		var mightHaveNext = data.mightHaveNext;
		var nextPageQuery = _getPageQueryParams(category, mightHaveNext, nextPage);
		var mightHavePrev = prevPage > 0;
		var prevPageQuery = _getPageQueryParams(category, mightHavePrev, prevPage);
		
		if (data.ok) {
			products = data.data;
		}
		return { products: products, offset: offset, mightHaveNext: mightHaveNext, nextPageQuery: nextPageQuery, prevPageQuery: prevPageQuery };
	}).catch(function (err) {
		return { products: [], project_ids: [] };
	});
};

var getProducts = function(category, offset, perPage, customer_id) {
	return getCategories(customer_id).then(function(categories){
		return _delay(hangTimeout).then(function () {
			return _getProductList(category, offset, perPage, customer_id).then(function(productData){
				productData.categories = categories;
				return productData;
			});
		});
	});
};


var deleteProduct = function(productId, customer_id) {
	var url = product_pod_url + "product/" + productId;

	var opt = {
		method: "DELETE"
	};

	return textualRequest.call({ customer_id: customer_id }, url, opt);
};


var editProduct = function(productId, productJSON, customer_id) {
	const url = product_pod_url + "product/" + productId;

	var opt = {
		method: "PATCH",
		body: productJSON
	};

	return textualRequest.call({customer_id: customer_id}, url, opt);
};

var getCustomerCategoryKinds = function(category, customer_id){
	return getCustomerLanguages(customer_id).then(function(languages){
		return getCategoryKinds(category, languages, customer_id);
	});
};

var getCategoryKinds = function(category, languages, customer_id) {
	var url = vocabulary_pod_url + "kind/" + category;
	if (languages && languages.length > 0) {
		url += "?";

		languages.forEach(function(item) {
			url += "language=" + item + "&";
		});

		url = url.slice(0, -1);
	}

	return textualRequest.call({ customer_id: customer_id }, url, {});
};


var getProductCategoryHeadlines = function(category, customer_id) {
	return _getProductCategoryTags(category, customer_id).then(function (categoryTags) {
            return _getExistingTags(customer_id).then(function(vocabularies) {
				_matchExistingTags(categoryTags, vocabularies);
				
                var categoryHeadlines = categoryTags.reduce(function (returnValue, currentValue) {
					if ('headline_singular' in currentValue && currentValue.headline_singular) {
						var headline = returnValue.withHeadline.find(function(item){
							return item[0].headline_singular.default == currentValue.headline_singular.default;
						});
						if (headline) {
							headline.push(currentValue);
						} else {
							returnValue.withHeadline.push([currentValue]);
						}
					} else {
						returnValue.others.push(currentValue);
					}
					return returnValue;
				}, { withHeadline: [], others: [] });

				return categoryHeadlines;
			});
	}).catch(function (err) {
		return Promise.reject(err);
	});
};

var generate = function(options, customer_id) {
	var url = product_generate_url;
	options.channel = "title+auto";
	var opt = {
		method: "POST",
		body: options
	};

	return textualRequest.call({ customer_id: customer_id }, url, opt);
}

module.exports = {
	getCategories: getCategories,
	createNewProduct: createNewProduct,
	getProductCategorySubparts: getProductCategorySubparts,
	getProductTags: getProductTags,
	getProduct: getProduct,
	getProducts: getProducts,
	deleteProduct: deleteProduct,
	editProduct: editProduct,
	getCategoryKinds: getCategoryKinds,
	getCustomerCategoryKinds : getCustomerCategoryKinds,
	getCustomerLanguages : getCustomerLanguages,
	getProductCategoryHeadlines: getProductCategoryHeadlines,
	generate: generate
};