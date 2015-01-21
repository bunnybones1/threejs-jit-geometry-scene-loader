var loadJSON = require('load-json-xhr');
function noop() {};

var SHOULDNT_EVEN_EXIST = -2,
	LOAD_UNAVAILABLE = -1,
	LOAD_AVAILABLE = 0,
	LOADING = 1,
	LOADED = 2;

function JITGeometrySceneLoader(props) {
	if(props) this.load(props);
};

JITGeometrySceneLoader.prototype = {
	objectsByPath: undefined,
	objectPaths: undefined,
	geometries: undefined,
	objectsWaitingForGeometriesByGeometryPaths: undefined,
	loadersByGeometryPaths: undefined,
	load: function (props) {
		var _this = this;
		props = props || {};

		//defaults
		var defaults = {
			path: '',
			geometryPath: '',
			targetParent: undefined,
			onMeshComplete: function(mesh) { if(_this.debugLevel>=1) console.log("MESH COMPLETE"); },
			onComplete: function() { if(_this.debugLevel>=1) console.log('LOAD COMPLETE'); },
			onProgress: function(val) { if(_this.debugLevel>=1) console.log('LOAD PROGRESS:', val); },
			debugLevel: 0
		}

		for(var key in defaults) {
			this[key] = props[key] !== undefined ? props[key] : defaults[key];
		}
		

		this.pathBase = this.path.substring(0, this.path.lastIndexOf('/')+1);
		this.path = this.pathCropBase(this.path);
		this.objectsByPath = {};
		this.geometries = {};
		this.cancelling = [];
		this.objectPaths = [];
		this.objectsWaitingForGeometriesByGeometryPaths = {};
		this.loadersByGeometryPaths = {};
		this.threeGeometryJSONLoader = new THREE.JSONLoader();
		this.threeObjectJSONLoader = new THREE.ObjectLoader();
		this.hierarchyRecieved = this.hierarchyRecieved.bind(this);
		this.geometryRecieved = this.geometryRecieved.bind(this);
		this.showByName = this.showByName.bind(this);
		this.hideByName = this.hideByName.bind(this);
		var url = this.pathBase + this.path;
		var loader = loadJSON(url + '.hierarchy.json', this.hierarchyRecieved.bind(this, url));
		var sceneProgress = 0;
		loader.onprogress = function(event) {
			if(event.lengthComputable) {
				sceneProgress = event.loaded / event.total;
			} else {
				sceneProgress = (1 - (1 - sceneProgress) * .5);
			}
			_this.onProgress(sceneProgress);
		}
	},

	hierarchyRecieved: function(path, err, jsonData) {
		if(err) {
			throw err;
			return;
		};
		this.root = new THREE.Object3D();
		for(var childName in jsonData) {
			this.root.add(this.createObject(jsonData[childName], path + '/' + childName));
		}
		if(this.targetParent) {
			this.targetParent.add(this.root);
		}
		this.onComplete();
	},

	geometryRecieved: function(path, err, jsonData) {
		if(err) {
			throw err;
			return;
		};
		path = this.pathCropGeometries(path);
		path = path.substring(0, path.lastIndexOf('.json'));
		// console.log(jsonData);
		if(this.debugLevel>=2) console.log('loaded', path);

		var geometry = this.threeGeometryJSONLoader.parse(jsonData).geometry;
		this.integrateGeometry(geometry, path);
	},

	integrateGeometry: function(geometry, path) {
		if(this.debugLevel>=2) console.log('integrate geometry', path);
		this.geometries[path] = geometry;
		var objectsToPromote = this.objectsWaitingForGeometriesByGeometryPaths[path];
		if(objectsToPromote) {
			for (var i = objectsToPromote.length - 1; i >= 0; i--) {
				var object = objectsToPromote[i];
				var mesh = this.promoteObjectToMesh(object, geometry);
				if(object.geometryLoadCompleteCallback) {
					// if(i != 0) debugger;
					object.geometryLoadCompleteCallback();
					delete object.geometryLoadCompleteCallback;
				}
				delete this.loadersByGeometryPaths[object.geometryName];
				delete object.geometryName;
				// this.isolationTest(mesh);
			};
		}
		delete this.objectsWaitingForGeometriesByGeometryPaths[path];
	},

	loadGeometryOf: function(object, progressCallback, callback) {
		// object.add(new THREE.Mesh(new THREE.SphereGeometry(10)));
		var geometryName = object.geometryName;
		var geometryPath = this.geometryPath + '/' + geometryName;
		var geometry = this.geometries[geometryName];
		if(this.debugLevel>=2) console.log('REQUEST', geometryName);
		if(geometry) {
			if(this.debugLevel>=2) console.log('reusing', geometryName);
			object = this.promoteObjectToMesh(object, geometry);
			return false;
		} else {
			if(!this.objectsWaitingForGeometriesByGeometryPaths[geometryPath]) {
				if(this.debugLevel>=2) console.log('loading', geometryName);
				object.geometryLoadCompleteCallback = callback;
				this.objectsWaitingForGeometriesByGeometryPaths[geometryPath] = [object];
				loader = loadJSON(geometryPath + '.json', this.geometryRecieved.bind(this, geometryPath + '.json'));
				loader.onprogress = progressCallback;
				this.loadersByGeometryPaths[geometryName] = loader;
				return true;
			} else {
				if(this.debugLevel>=2) console.log('waiting for', geometryName);
				this.objectsWaitingForGeometriesByGeometryPaths[geometryPath].push(object);
				object.loadStatus = LOADING;
				return false;
			}
		}
	},

	cancelLoadGeometryOf: function(object) {
		// object.add(new THREE.Mesh(new THREE.SphereGeometry(10)));
		var geometryName = object.geometryName;
		if(this.debugLevel>=2) console.log('cancelling', geometryName);
		var geometryPath = this.geometryPath + '/' + geometryName;
		var objectsWaitingForGeometry = this.objectsWaitingForGeometriesByGeometryPaths[geometryName]
		if(objectsWaitingForGeometry) {
			for (var i = objectsWaitingForGeometry.length - 1; i >= 0; i--) {
				var objectWaiting = objectsWaitingForGeometry.splice(i, 1)[0];
				delete objectWaiting.geometryLoadCompleteCallback;
			};
		}
		delete this.objectsWaitingForGeometriesByGeometryPaths[geometryName];
		this.cancelling.push(this.loadersByGeometryPaths[geometryName]);
		this.loadersByGeometryPaths[geometryName].abort();
		delete this.loadersByGeometryPaths[geometryName];
	},

	storeObject: function(path, object) {
		this.objectsByPath[path] = object;
		this.objectPaths.push(path);

		//fix the alias for notFound
		var slices = path.split('/');
		if(slices[slices.length-1].indexOf("notFound") != -1){
			slices[slices.length-1] = "notFound";
		}
		path = slices.join('/');

		this.objectsByPath[path] = object;
		this.objectPaths.push(path);
	},

	createObject: function(jsonData, path) {
		var object = this.threeObjectJSONLoader.parseObject(jsonData);
		while(object.children.length > 0) object.remove(object.children[0]);	//I only want the object
		object.path = path;
		object.materialName = jsonData.material;
		this.storeObject(path, object);
		var name = path.substring(path.lastIndexOf('/')+1, path.length);
		object.name = name;

		for(var childName in jsonData.children) {
			object.add(this.createObject(jsonData.children[childName], path + '/' + childName));
		}

		var geometryName = jsonData.geometry;
		if(geometryName) {
			object.loadStatus = LOAD_AVAILABLE;
			object.geometryName = geometryName;

			this.decorateObjectWithJITGeometryAPI(object);
		
		} else {
			object.loadStatus = LOAD_UNAVAILABLE;
		}
		
		if(jsonData.quaternion) {
			object.quaternion.x = jsonData.quaternion[0];
			object.quaternion.y = jsonData.quaternion[1];
			object.quaternion.z = jsonData.quaternion[2];
			object.quaternion.w = jsonData.quaternion[3];
		}
		return object;
	},

	promoteObjectToMesh: function(object, geometry) {
		var mesh = new THREE.Mesh(geometry);
		mesh.path = object.path;
		mesh.name = object.name;
		var parent = object.parent;
		object.loadStatus = SHOULDNT_EVEN_EXIST;
		mesh.loadStatus = LOADED;
		mesh.materialName = object.materialName;
		mesh.position.copy(object.position);
		mesh.scale.copy(object.scale);
		mesh.rotation.x = object.rotation.x;
		mesh.rotation.y = object.rotation.y;
		mesh.rotation.z = object.rotation.z;
		mesh.visible = object.visible;
		if(parent) {
			parent.remove(object);
			parent.add(mesh);
		} else {
			throw new Error('wtf');
		}

		for (var i = object.children.length - 1; i >= 0; i--) {
			mesh.add(object.children[i]);
		};
		var path = object.path;
		this.storeObject(path, mesh);

		if(object === this.root) {
			this.root = mesh;
		}

		this.decorateObjectWithJITGeometryAPI(mesh);
		this.onMeshComplete(mesh); 
		return mesh;
	},

	pathCropBase: function(path) {
		return path.substring(this.pathBase.length, path.length);
	},

	pathCropGeometries: function(path) {
		return path.substring(this.geometryPath + '/'.length, path.length);
	},

	notFound: function(name) {
		console.log(name, 'does not exist');
		if(name) {
			var slices = name.split('/');
			slices[slices.length-1] = 'notFound';
			name = slices.join('/');
		} else {
			name = 'notFound'
		}
		return this.objectsByPath[this.path + '/' + name];
	},

	showByName: function(name, recursive, childrenOnly) {
		this.setVisibilityByName(name, true, recursive, childrenOnly);
	},

	hideByName: function(name, recursive, childrenOnly) {
		this.setVisibilityByName(name, false, recursive, childrenOnly);
	},

	setVisibilityByName: function(name, state, recursive, childrenOnly) {
		var object = this.getObjectByName(name);
		if(!object) {
			object = this.notFound(name);
		}
		if(object) {
			if(!childrenOnly) {
				object.visible = state;
			}
			// if(state, console.log(name));
			if(recursive) {
				object.traverse(function(obj) {
					if(obj === object) return;
					obj.visible = state;
				});
			}
		}
	},

	loadByName: function(name, recursive, progressCallback, callback) {
		var object = this.getObjectByName(name);
		var geometriesToLoadCount = 0;
		var geometriesLoadedCount = 0;
		var loading = 0;
		var _this = this;
		var progressOfEachGeometry = [];
		function reportProgress() {
			var aggregatedProgress = 0;
			progressOfEachGeometry.forEach(function(val){
				aggregatedProgress += val;
			})
			aggregatedProgress /= geometriesToLoadCount;
			if(progressCallback) {
				progressCallback(aggregatedProgress);
			}
			if(_this.debugLevel>=1) console.log('geometry loading progress:', aggregatedProgress);
		}
		function geometryLoadProgressCallback(whichUniqueGeometry, event) {
			if(event.lengthComputable) {
				progressOfEachGeometry[whichUniqueGeometry] = event.loaded / event.total;
			} else {
				progressOfEachGeometry[whichUniqueGeometry] = event.loaded === 0 ? 0 : (1 - (1 - progressOfEachGeometry[whichUniqueGeometry]) * .5);
			}
			reportProgress();
		}
		function geometryLoadCompleteCallback(whichUniqueGeometry) {
			geometriesLoadedCount++;
			//courtesy progress
			progressOfEachGeometry[whichUniqueGeometry] = 1;
			reportProgress();

			if(_this.debugLevel>=1) console.log(name+'\'s geometry objects loaded:', geometriesLoadedCount + '/' + geometriesToLoadCount);
			if(geometriesToLoadCount === geometriesLoadedCount) {
				if(callback) {
					callback();
				}
			}
		}

		if(!object) {
			object = this.notFound(name);
		}

		function attemptToLoadGeometry(obj) {
			if(obj.load) {
				var actuallyGonnaLoad = obj.load(
					geometryLoadProgressCallback.bind(this, geometriesToLoadCount), 
					geometryLoadCompleteCallback.bind(this, geometriesToLoadCount)
				) ? 1 : 0;
				if(actuallyGonnaLoad) {
					geometriesToLoadCount ++;
					progressOfEachGeometry.push(0);
				}
			}
		}

		if(object) {
			if(object.load) { 
				attemptToLoadGeometry(object);
			}
			if(recursive) {
				object.traverse(function(obj) {
					if(object === obj) return;
					attemptToLoadGeometry(obj);
				});
			}
			if(this.debugLevel>=1) console.log('geometries to load:', geometriesToLoadCount)
			if(geometriesToLoadCount == 0 && callback) {
				callback();
			}
		}
	},

	cancelLoadByName: function(name, recursive, callback) {
		throw new Error('Not implemented yet');
	},

	checkIfLoadedByName: function(name, recursive) {
		var object = this.getObjectByName(name);
		var loaded = object.loadStatus == LOADED || object.loadStatus == LOAD_UNAVAILABLE;
		var _this = this;
		if(loaded && recursive) {
			object.traverse(function(obj) {
				if(obj.loadStatus != LOADED && obj.loadStatus != LOAD_UNAVAILABLE) {
					if(_this.debugLevel > 0) {
						console.log('loaded?', obj.name, obj.loadStatus);
					}
					loaded = loaded && false;
				}
			})
		}
		return loaded;
	},

	decorateObjectWithJITGeometryAPI: function(object){
		var _this = this;
		object.load = function(progressCallback, callback) {
			if(object.loadStatus === LOAD_AVAILABLE) {
				object.loadStatus = LOADING;
				return _this.loadGeometryOf(object, progressCallback, callback);
			}
			return false;
		};
		object.unload = function(callback) {
			throw new Error('not implemented yet');
		};
		object.cancelLoad = function(callback) {
			throw new Error('not implemented yet');
		};
	},

	getObjectByName: function(name) {
		var objPath = this.pathBase + this.path + '/' + name;
		return this.objectsByPath[objPath];
	}
}

module.exports = JITGeometrySceneLoader;