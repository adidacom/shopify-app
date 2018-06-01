var express = require('express');
var router = express.Router();
const CONSTANTS = require("./../constants");
const cookie = require('cookie');
var textualRequest = require('./../textual-request');
var TextualServerError = require('./../textual_server_error');
var productLib = require('./../product-lib');

var isAuthenticated = require('./../authentication');

const product_pod_url = process.env.PRODUCT_POD_URL; // + "/";
const vocabulary_pod_url = process.env.VOCABULARY_POD_URL;
const vocabulary_gf_url = process.env.VOCABULARY_GF_URL;
const hangTimeout = process.env.HANG_TIMEOUT;

var productCache = null;
var vocabularyCache = null;

/*
	This customer_id is important: This tells us who is doing the product
	and makes sure to create the product and the resulting texts under
	the correct customer. Now during test, we will set it to 1, which
	is our test-customer
*/
// var c_id = 76;
var c_id = null;

var product_url_ping = product_pod_url.slice(0, -1)
console.log(">>> Pinging Product API at", product_url_ping);
textualRequest.call({}, product_url_ping, { method: "GET" }).then(function (data) {
	console.log(">>> Product API connection established");

}).catch(function (err) {
	console.log(">>> Could not establish product API connection");
	process.exit(1);
});

var vocabulary_url_ping = vocabulary_gf_url.slice(0, -11);
console.log(">>> Pinging Vocabulary API at", vocabulary_url_ping)
textualRequest.call({}, vocabulary_url_ping, { method: "GET" }).then(function (data) {
	console.log(">>> Vocabulary API connection established");

}).catch(function (err) {
	console.log(">>> Could not establish vocabulary API connection");
	process.exit(1);
});

var groupBy = function (array, key) {
	return array.reduce(function (returnValue, currentVal) {
		moveTagToParents(currentVal, "type", "kind", false);
		moveTagToParents(currentVal, "type", "pluralkind", false);
		moveTagToParents(currentVal, 'category', 'unit', true);

		(returnValue[currentVal[key]] = returnValue[currentVal[key]] || []).push(currentVal);
		return returnValue;
	}, {});
};

var moveTagToParents = function (category, key, value, append) {
	var tagObject;
	if (category.tags) {
		if (!category.value || append) {
			tagObject = findTagby(category.tags, key, value);
			tagIndex = findIndexby(category.tags, key, value);
			if (tagObject && tagObject !== -1) {
				if (append) {
					category.value = (category.value) ? category.value : '0';
					category.value += " " + tagObject.value;
				} else {
					category.value = tagObject.value;
				}
				category.tags.splice(tagIndex, 1);
			} else if (append && category.type === "quantity") {
				category.value = (category.value) ? category.value : '0';
				category.value += " pcs";
			}
		}

		category.tags.forEach(function (item) {
			moveTagToParents(item, key, value, append);
		});
	}
}

var findIndexby = function (array, byKey, value) {
	for (var i = 0; i < array.length; i++) {
		if (array[i][byKey] === value) {
			return i;
		}
	}
	return -1;
}

var findTagby = function (array, byKey, value) {
	for (var i = 0; i < array.length; i++) {
		if (array[i][byKey] === value) {
			return array[i];
		}
	}
	return -1;
}

var getExistingTags = function () {
	const url = vocabulary_gf_url;

	if (vocabularyCache) {
		return Promise.resolve(vocabularyCache);
	}

	return textualRequest.call({}, url, { method: "GET" }).then(function (data) {
		vocabularyCache = data.data;
		return vocabularyCache;
	}).catch(function (err) {
		return { ok: false };
	});
};

var setExistingTags = function (tagArray, vocabularies) {
	for (var i = 0; i < tagArray.length; i++) {
		tag = tagArray[i];
		tag.existingTags = [];
		if (tag.tag_values) {
			for (var j = 0; j < tag.tag_values.length; j++) {
				type = tag.tag_type;
				type = type.substr(type.length - 5) === "_list" ? type.substr(0, type.length - 5) : type;
				name = tag.tag_values[j] + "_" + type;
				for (var k = 0; k < vocabularies.length; k++) {
					if (vocabularies[k].word == name || (vocabularies[k].type == tag.tag_type && vocabularies[k].word == "<any>")) {
						tag.existingTags.push(tag.tag_type + "_" + tag.tag_values[j]);
						break;
					}
				}
			}
		}
	}
};

var splitHeadlines = function (headlines, tags) {
	return headlines.reduce(function (returnValue, currentValue) {
		if ('headline' in currentValue && currentValue.headline) {
			if (currentValue.tag_values) {
				returnValue.withHeadline.push(currentValue);
			} else {
				var headlineTags = tags.filter(function (tagObject) {
					return tagObject.category == currentValue.tag_category &&
						tagObject.type == currentValue.tag_type;
				});

				if (headlineTags.length > 0) {
					currentValue.tag_values = headlineTags.reduce(function (returnValue, currentValue) {
						if (currentValue.value) {
							returnValue.push(currentValue.value);
						} else if (currentValue.tags) {
							for (var i = 0; i < currentValue.tags.length; i++) {
								returnValue.push(currentValue.tags[i].value);
							}
						}
						return returnValue;
					}, []);
					returnValue.withHeadline.push(currentValue);
				}
			}
		} else {
			if (currentValue.tag_values) {
				returnValue.others.push(currentValue);
			}
		}
		return returnValue;
	}, { withHeadline: [], others: [] });
};

router.use(isAuthenticated);

router.post('/generate', function (req, res, next) {
	var options = req.body;
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	productLib.generate(options, customer_id).then(function (data) {
		res.json(data);
	}).catch(function (err) {
		next(err);
	});
});

router.get('/new', function (req, res, next) {
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	return productLib.getCustomerLanguages(customer_id).then(function (languages) {
		productLib.getCategories(customer_id).then(function (categories) {
			res.render('product/newProduct', {
				menu: "Product",
				submenu: "Create Product",
				nestedCategories: categories.children,
				projectId: CONSTANTS.CUSTOMER_PROJECTS[customer_id],
				languages: languages
			});
		}).catch(function (err) {
			return next(err);
		});
	}).catch(function (err) {
		return next(err);
	});
});

router.post('/new', function (req, res, next) {
	var productJSON = req.body;
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	return productLib.createNewProduct(productJSON, customer_id, true).then(function (data) {
		res.json(data);
	}).catch(function (err) {
		return next(err);
	});
});

router.get('/:productId/edit', function (req, res, next) {
	var productId = req.params.productId;
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	if (typeof productId !== "string" || productId.length <= 0) {
		var err = new TextualServerError("Please provide a value for the product id");
		return next(err);
	}

	return productLib.getProduct(productId, customer_id).then(function (data) {
		res.render('product/editProduct', {
			menu: "Product",
			submenu: "ProductList",
			productId: productId,
			productName: data.productName,
			productKind: data.productKind,
			productCategory: data.productCategory,
			productCategoryName: data.productCategoryName,
			productBrand: data.productBrand,
			groupedHeadlines: data.groupedHeadlines,
			tags: JSON.stringify(data.tags),
			kinds: data.kinds,
			languages: data.languages,
			languageButtonBehavior: CONSTANTS.LANGUAGE_BUTTON_BEHAVIOR,
			projectId: CONSTANTS.CUSTOMER_PROJECTS[customer_id]
		});
	}).catch(function (err) {
		return next(err);
	});
});

router.get('/list', function (req, res, next) {
	var productId = req.params.productId;
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	var createCategoryMap = function (nestedCategories, categoryMap) {
		categoryMap[nestedCategories.category] = nestedCategories.display_name;
		if (nestedCategories.children) {
			nestedCategories.children.forEach(function (item) {
				createCategoryMap(item, categoryMap);
			});
		}
	};

	var groupProducts = function (productList) {
		return productList.reduce(function (returnValue, currentVal) {
			var productId, productName, productBrand, productCategory, productKind;

			for (var i = 0; (i < currentVal.length && (!productBrand || !productName || !productCategory || !productId)); i++) {
				if (currentVal[i].category === 'category') {
					productCategory = currentVal[i].value;
				} else if (currentVal[i].category === 'identifier') {
					switch (currentVal[i].type) {
						case "brand":
							productBrand = currentVal[i].value;
							break;
						case "name":
							productName = currentVal[i].value;
							break;
						case "id":
							productId = currentVal[i].value;
							break;
						case "kind":
							productKind = currentVal[i].value;
						default:

					}
				}
			}
			var groupedCategories = groupBy(currentVal, "category");

			var product = {
				id: productId ? productId : "",
				brand: productBrand ? productBrand : "",
				name: productName ? productName : "",
				kind: productKind ? productKind : "",
				tag_length: currentVal.length,
				category_list: groupedCategories
			};

			(returnValue[productCategory] = returnValue[productCategory] || []).push(product);
			return returnValue;
		}, {});
	};

	var category = req.query.category;
	var offset = req.query.offset;
	var perPage = CONSTANTS.PRODUCT_LIST.PRODUCTS_PER_PAGE;

	productLib.getProducts(category, offset, perPage, customer_id).then(function (data) {
		var groupedProducts = groupProducts(data.products.slice());
		var categoryNameMap = [];
		createCategoryMap(data.categories, categoryNameMap);

		res.render('product/productList', {
			menu: "Product",
			submenu: "ProductList",
			groupedProducts: groupedProducts,
			offset: data.offset,
			mightHaveNext: data.mightHaveNext,
			nextPageQuery: data.nextPageQuery,
			prevPageQuery: data.prevPageQuery,
			selectedCategory: req.query.category,
			nestedCategories: data.categories.children,
			categoryNameMap: categoryNameMap
		});
	});
});

router.post('/vocabulary', function (req, res, next) {
	const url = product_pod_url + "vertical";
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	var opt = {
		method: "POST",
		body: req.body
	}
	return textualRequest.call({ customer_id: customer_id }, url, opt).then(function (data) {
		res.json(data);
	}).catch(function (err) {
		return next(err);
	});
});

router.get('/subpart/:kind', function (req, res, next) {
	var kind = req.params.kind;
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	if (typeof kind !== "string" || kind.length <= 0) {
		var err = new TextualServerError("Please provide a value for kind");
		return next(err);
	}
	return productLib.getCustomerLanguages(customer_id).then(function (languages) {
		return productLib.getProductCategorySubparts(kind, languages, customer_id).then(function (data) {
			res.json(data);
		}).catch(function (err) {
			return next(err);
		});
	}).catch(function (err) {
		return next(err);
	});

});

router.get('/:productId', function (req, res, next) {
	var productId = req.params.productId;
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	if (typeof productId !== "string" || productId.length <= 0) {
		var err = new TextualServerError("Please provide a value for the product id");
		return next(err);
	}
	return productLib.getProductTags(productId, customer_id).then(function (data) {
		res.json(data);
	}).catch(function (err) {
		return next(err);
	});
});

router.delete('/:productId', function (req, res, next) {
	var productId = req.params.productId;
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	if (typeof productId !== "string" || productId.length <= 0) {
		var err = new TextualServerError("Please provide a value for the product id");
		return next(err);
	}

	return productLib.deleteProduct(productId, customer_id).then(function (data) {
		res.json(data);
	}).catch(function (err) {
		return next(err);
	});
});

router.patch('/:productId', function (req, res, next) {
	var productId = req.params.productId;
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	if (typeof productId !== "string" || productId.length <= 0) {
		var err = new TextualServerError("Please provide a value for the product id");
		return next(err);
	}

	return productLib.editProduct(productId, req.body).then(function (data) {
		res.json(data);
	}).catch(function (err) {
		return next(err);
	});
});

router.get('/kind/:category', function (req, res, next) {
	var category = req.params.category;
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	if (typeof category !== "string" || category.length <= 0) {
		var err = new TextualServerError("Please provide a value for the category");
		return next(err);
	}

	return productLib.getCustomerCategoryKinds(category, customer_id).then(function (data) {
		res.json(data);
	}).catch(function (err) {
		return next(err);
	});
});

router.get('/tags/:category', function (req, res, next) {
	var category = req.params.category;
	var userData = req.decoded;
	const customer_id = c_id || userData.customer_id;
	if (typeof category !== "string" || category.length <= 0) {
		var err = new TextualServerError("Please provide a value for the category");
		return next(err);
	}

	return productLib.getProductCategoryHeadlines(category, customer_id).then(function (data) {
		res.json(data);
	}).catch(function (err) {
		return next(err);
	});
});

module.exports = router;