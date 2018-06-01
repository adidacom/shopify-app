const PRODUCT_SUGGESTIONS = {
	"quality": {
		"design": [
			'solid',
			'minimal',
			'small',
			'elegant',
			'big',
			'portable',
			'light_weight',
			'iconic',
			'thin',
			'delicate',
			'flat',
			'beautiful',
			'natty',
			'thick',
			'futuristic',
			'robust',
			'fine',
			'sophisticated',
			'tasteful',
			'minimalistic',
			'slim',
			'trendy',
			'classic',
			'firm',
			'stylish',
			'overblown',
			'flashy',
			'groovy',
			'salient',
			'handy',
			'compact',
			'cool',
			'durable',
			'discrete'
		],
		"eco": [
			'energy_efficient',
			'energy_saving',
			'environmentally_friendly'
		],
		"performance": [
			'blazing_fast',
			'superfast',
			'fast',
			'ultrafast',
			'cutting_egde',
			'powerful'
		],
		"price": [
			'selected',
			'good_value_for_money'
		],
		"sound": [
			'silent',
			'noiseproof'
		],
		"subjective": [
			'unique',
			'perfect',
			'optimal',
			'fantastic',
			'outstanding',
			'exceptional',
			'prime',
			'spectacular',
			'ultimate',
			'great',
			'special',
			'ideal',
			'spot_on',
			'amazing',
			'ingenious',
			'brilliant',
			'irresistable',
			'nice',
			'awesome',
			'groundbreaking',
			'unbeatable',
			'unmatched',
			'innovative',
			'superior',
			'exciting',
			'luxurious',
			'modern',
			'extreme',
			'uncompromising'
		],
		"user": [
			'flexible',
			'versatile',
			'universal',
			'personal',
			'user_friendly',
			'popular',
			'all_round',
			'carefree',
			'safe',
			'secure',
			'ergonomic',
			'practical',
			'useful',
			'smooth',
			'ordinary',
			'reliable',
			'functional',
			'familiar',
			'traditional',
			'manageable',
			'profesional',
			'simple',
			'smart',
			'well_known',
			'unusual',
			'rare',
			'prestigious'
		],
		'superlativ': []
	},
	'feature': {
		'perfect_for': [
			'gaming',
			'work',
			'entertainment',
			'surf',
			'school'
		],
		'driving_wheel': []
	},
	'identifier': {
		'name': []
	},
	'safety': {
		'has': []
	}
}
const SUBPARTS_SUGGESTIONS = {
	screen: [
		'fantastic',
		'glossy',
		'flat',
		'thin',
		'stylish',
		'high definition',
		'big',
		'bright',
		'sharp'
	],
	hard_drive: [
		'fast',
		'energy_efficient',
		'silent',
		'large',
		'shock- resistant',
		'reliable',
		'environmentally_friendly'
	],
	cpu: [
		'fast',
		'energy_efficient',
		'silent',
		'powerful'
	],
	battery: [
		'long_lasting',
		'reliable',
		'energy_efficient',
		'environmentally_friendly'
	]
}

//FIXME: projects is no longer needed
const CUSTOMER_PROJECTS = {
	//mapping of customer_id with project_id
	'1': '3',
	'8': '3',
	'5': '10',
	'7': '15',
	'18': '18'
}

const PRODUCT_LIST = {
	PRODUCTS_PER_PAGE: 10,
}

const LANGUAGE_BUTTON_BEHAVIOR = "radio";

module.exports = {
	PRODUCT_SUGGESTIONS: PRODUCT_SUGGESTIONS,
	SUBPARTS_SUGGESTIONS: SUBPARTS_SUGGESTIONS,
	CUSTOMER_PROJECTS: CUSTOMER_PROJECTS,
	PRODUCT_LIST : PRODUCT_LIST,
	LANGUAGE_BUTTON_BEHAVIOR : LANGUAGE_BUTTON_BEHAVIOR
};
