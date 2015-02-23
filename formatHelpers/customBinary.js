var customBinaryDecoder = require('threejs-geometry-format-custom-binary')

module.exports = {
	contentType : 'application/octet-stream',
	fileExt: 'b3d.dflr',
	parse: function(data) {
		return data;
	},
	responseType: 'arraybuffer',
	inflate: true,
	buildGeometry: function(data) {
		return customBinaryDecoder(data, this.inflate);
	}

}