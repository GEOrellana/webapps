/**
 * Visor meteo de GeOrellana, Ecuador.
 * basado en el ejemplo de GIBS https://github.com/nasa-gibs/gibs-web-examples
 * y en ejemplos de OpenLayers 3.
 *
 * Sientate libre en usar lo que quieras, es software libre.
 */

$(function() {

	// Seven day slider based off today, remember what today is
	var today = new Date();

	// Selected day to show on the map
	var day = new Date(today.getTime());

	// When the day is changed, cache previous layers. This allows already
	// loaded tiles to be used when revisiting a day. Since this is a
	// simple example, layers never "expire" from the cache.
	var cache = {};

	// GIBS needs the day as a string parameter in the form of YYYY-MM-DD.
	// Date.toISOString returns YYYY-MM-DDTHH:MM:SSZ. Split at the "T" and
	// take the date which is the first part.

	// En Ecuador el satelite Terra pasa entre las 10 y 11 AM, la capa se actualiza ca. a las 1 PM. 
	// Por ello, al cargar la pagina antes de la 1 PM (ECT) se muestra el mapa inicial del dia anterior. 

	var valorInicial;
	var dayParameter = function() {
		if (valorInicial == null) {
			if (today.getUTCHours() < 18.00) {
				valorInicial = -1;
				day.setDate(today.getDate() - 1);
			} else {
				valorInicial = 0;
			};
		};
		return day.toISOString().split("T")[0];
	};

	var map = new ol.Map({
		view: new ol.View({
			maxResolution: 0.5625,
			projection: ol.proj.get("EPSG:4326"),
			extent: [-180, -90, 180, 90],
			center: [-76.5, -1],
			zoom: 7,
			maxZoom: 9
		}),
		target: "map",
		renderer: ["canvas", "dom"],
	});

	var update = function() {
		// Using the day as the cache key, see if the layer is already
		// in the cache.
		var key = dayParameter();
		var layerTerra = cache[key];

		// If not, create a new layer and add it to the cache.
		if (!layerTerra) {
			layerTerra = createLayerTerra();
			cache[key] = layerTerra;
		}

		// There is only one layer in this example, but remove them all
		// anyway
		clearLayers();

		// Add the new layer for the selected time
		map.addLayer(layerTerra);
		map.addLayer(provincia);
		map.addLayer(estMeteo);


		// Update the day label
		$("#day-label").html('Fecha mapa base (ECT): ' + dayParameter());
	};

	var clearLayers = function() {
		// Get a copy of the current layer list and then remove each
		// layer.
		var activeLayers = map.getLayers().getArray();
		for (var i = 0; i < activeLayers.length; i++) {
			map.removeLayer(activeLayers[i]);
		}
	};

	var createLayerTerra = function() {
		var sourceTerra = new ol.source.WMTS({
			url: "https://map1{a-c}.vis.earthdata.nasa.gov/wmts-geo/wmts.cgi?TIME=" + dayParameter(),
			layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
			format: "image/jpeg",
			matrixSet: "EPSG4326_250m",
			tileGrid: new ol.tilegrid.WMTS({
				origin: [-180, 90],
				resolutions: [
					0.5625,
					0.28125,
					0.140625,
					0.0703125,
					0.03515625,
					0.017578125,
					0.0087890625,
					0.00439453125,
					0.002197265625,
					0.0010986328125
				],
				matrixIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
				tileSize: 512
			})
		});

		var layerTerra = new ol.layer.Tile({
			source: sourceTerra
		});
		return layerTerra;
	};
	var provincia = new ol.layer.Tile({
		source: new ol.source.TileWMS({
			url: 'http://geo.gporellana.gob.ec/geoinfo/extern/wms',
			params: {
				'LAYERS': 'demarcacion_provincia',
				'TILED': true
			},
			serverType: 'geoserver'
		})
	});

	var estMeteo = new ol.layer.Vector({
		source: new ol.source.Vector({
			format: new ol.format.GeoJSON(),
			url: '../../geoinfo/datoslibres/wfs?service=WFS&version=1.1.0&request=GetFeature&typename=meteo_estacion&outputFormat=application/json&srsname=EPSG:4326'
		}),
		style: function(feature,resolution){
			var activa = new ol.style.Style( {
        			image: new ol.style.Circle( {
            				radius: 6,
            				fill: new ol.style.Fill( {
               					 color: 'rgba(138, 202, 238, 0.8)'
            				} ),
					stroke: new ol.style.Stroke({
						color: 'rgba(255, 224, 1, 0.8)',
						width: 3
	        			} )    
})
    			} );

    			var inactiva = new ol.style.Style( {
        			image: new ol.style.Circle( {
            				radius: 3,
            				fill: new ol.style.Fill( {
                				color: 'rgba(255, 32, 37, 0.8)'
            				} ),
                                        stroke: new ol.style.Stroke({  
                                                color: 'rgba(255, 224, 1, 0.8)',
                                                width: 1
                                        } )

        			} )
    			} );

    			if ( feature.get('efu') == 'activa') {
       				return [activa];
    			} else {
        			return [inactiva];
    			}
	}

	});

	update();

	// Al mover el raton encima de la estacion abrir ventana emergente con el nombre de la estacion
	var info = $('#info');
	info.tooltip({
		animation: false,
		trigger: 'manual'
	});
	var displayFeatureInfo = function(pixel) {
		info.css({
			left: pixel[0] + 'px',
			top: (pixel[1] - 15) + 'px'
		});
		var feature = map.forEachFeatureAtPixel(pixel, function(feature) {
			return feature;
		});
		if (feature) {
			info.tooltip('hide')
				.attr('data-original-title', 'Estaci&oacute;n meteorol&oacute;gica:<br><b>' + feature.get('nam') + '</b><br>' +'<i>' + feature.get('efu') + '</i>')
				.tooltip('fixTitle')
				.tooltip('show');
		} else {
			info.tooltip('hide');
		}
	};
	map.on('pointermove', function(evt) {
		if (evt.dragging) {
			info.tooltip('hide');
			return;
		}
		displayFeatureInfo(map.getEventPixel(evt.originalEvent));
	});


	// Al hacer click abrir la pagina web de la estacion
	var openWebMeteo = function(pixel) {
		var feature = map.forEachFeatureAtPixel(pixel, function(feature) {
			return feature;
		});
		if (feature) {
			if (feature.get('efu')=='activa'){
			window.open(feature.get('web'), "_self");}
		}
	};
	map.on('click', function(evt) {
		openWebMeteo(evt.pixel);
	});


	// Slider values are in "days from present".
	$("#day-slider").slider({
		value: valorInicial,
		min: -6,
		max: 0,
		step: 1,
		slide: function(event, ui) {
			// Add the slider value (effectively subracting) to today's date
			var newDay = new Date(today.getTime());
			newDay.setUTCDate(today.getUTCDate() + ui.value);
			day = newDay;
			update();
		}
	});
});

