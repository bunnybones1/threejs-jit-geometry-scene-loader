var threeGeometryJSONLoader;
module.exports = {
	contentType : 'application/json',
	fileExt: 'json',
	responseType: 'json',
	parse: JSON.parse,
	buildGeometry: function(jsonData) {
		if(!threeGeometryJSONLoader) {
			threeGeometryJSONLoader = new THREE.JSONLoader();
		}
		return threeGeometryJSONLoader.parse(jsonData).geometry;
	}
}