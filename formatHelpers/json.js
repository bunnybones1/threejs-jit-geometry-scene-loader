var threeGeometryJSONLoader;
module.exports = {
	contentType : 'application/json',
	fileExt: 'json',
	// responseType: 'json', //some browsers still don't support this responseType, so parse the data yourself.
	responseType: undefined,
	parse: JSON.parse,
	buildGeometry: function(jsonData) {
		if(!threeGeometryJSONLoader) {
			threeGeometryJSONLoader = new THREE.JSONLoader();
		}
		return threeGeometryJSONLoader.parse(jsonData).geometry;
	}
}