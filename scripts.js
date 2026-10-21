// Inicializa el mapa; el selector permite usar un solo mapa base o ninguno.
var map = L.map('map', {
  zoomControl: false,
  minZoom: 0,
  maxZoom: 22,
  scrollWheelZoom: true
}).setView([6.24, -75.58], 13);

// EPSG:9377 es el sistema MAGNA-SIRGAS / Origen-Nacional usado por los TIFF.
if (window.proj4 && window.proj4.defs) {
  window.proj4.defs('EPSG:9377', '+proj=tmerc +lat_0=4 +lon_0=-73 +k=0.9992 +x_0=5000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');
}

var satelliteLayer = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg', {
  minZoom: 0,
  maxZoom: 22,
  maxNativeZoom: 20,
  attribution: '&copy; CNES, Distribution Airbus DS, &copy; Airbus DS, &copy; PlanetObserver (Contains Copernicus Data) | &copy; <a href="https://stadiamaps.com/attribution/" target="_blank" rel="noopener">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
});

var streetsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  minZoom: 0,
  maxNativeZoom: 19,
  maxZoom: 22,
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
});

var capasBase = [
  { id: 'toggle-satellite', key: 'satellite', layer: satelliteLayer, label: 'imagen satelital' },
  { id: 'toggle-streets', key: 'streets', layer: streetsLayer, label: 'mapa de calles' }
];
var mapaBaseActivo = null;

function seleccionarMapaBase(tipo) {
  mapaBaseActivo = tipo;

  capasBase.forEach(function (base) {
    var boton = document.getElementById(base.id);
    var activo = mapaBaseActivo === base.key;
    if (activo) base.layer.addTo(map);
    else map.removeLayer(base.layer);

    if (boton) {
      var accion = activo ? 'Ocultar' : 'Mostrar';
      boton.setAttribute('aria-label', accion + ' ' + base.label);
      boton.setAttribute('title', accion + ' ' + base.label);
      boton.setAttribute('aria-pressed', String(activo));
      boton.classList.toggle('is-off', !activo);
    }
  });
}

['toggle-satellite', 'toggle-streets'].forEach(function (id) {
  var boton = document.getElementById(id);
  if (boton) {
    boton.addEventListener('click', function () {
      var key = id === 'toggle-satellite' ? 'satellite' : 'streets';
      seleccionarMapaBase(mapaBaseActivo === key ? null : key);
    });
  }
});
seleccionarMapaBase('satellite');

L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);
var northControl = L.control({ position: 'topleft' });
northControl.onAdd = function () {
  var control = L.DomUtil.create('div', 'north-control leaflet-control');
  control.setAttribute('role', 'img');
  control.setAttribute('aria-label', 'Norte');
  control.setAttribute('title', 'Norte');
  control.innerHTML = '<span class="north-label">N</span><svg viewBox="0 0 28 48" aria-hidden="true"><path d="M14 2 25 42 14 34 3 42Z"/><path class="north-arrow-highlight" d="M14 2 14 34 3 42Z"/></svg>';
  L.DomEvent.disableClickPropagation(control);
  return control;
};
northControl.addTo(map);
// Mantiene el buffer debajo de los polígonos de espacio público de 2024.
map.createPane('bufferPane');
map.getPane('bufferPane').style.zIndex = 410;
map.createPane('espacioPublico2024Pane');
map.getPane('espacioPublico2024Pane').style.zIndex = 420;
var shapeLayers = {};
var shapeButtons = {};
var boundsGlobal = L.latLngBounds();

var shapeConfigs = [
  { name: 'EQUIPAMIENTOS', description: 'CONJUNTO DE EQUIPAMIENTOS QUE COMPARTEN LOS 3 PERIODOS', zipPath: 'DATA/EQUIPAMIENTOS.zip', color: '#d84315', fill: '#ff6d00' },
  { name: 'ESPACIO_PUBLICO_2006', description: 'ESPACIO PUBLICO EXISTENTE DETERMINADO POR EL POT DEL 2006', zipPath: 'DATA/ESPACIO_PUBLICO_2006.zip', color: '#006b3c', fill: '#19a857' },
  { name: 'ESPACIO_PUBLICO_2014', description: 'ESPACIO PUBLICO EXISTENTE DETERMINADO POR EL POT DEL 2014', zipPath: 'DATA/ESPACIO_PUBLICO_2014.zip', color: '#b5121b', fill: '#f02d3a' },
  { name: 'ESPACIO_PUBLICO_2024', description: 'ESPACIO PUBLICO EXISTENTE DETERMINADO POR LA ALCALDIA DE MEDELLIN EN SU GEOVISOR (GEOMEDELLIN)', zipPath: 'DATA/ESPACIO_PUBLICO_2024.zip', color: '#003f8c', fill: '#1684e8', pane: 'espacioPublico2024Pane' },
  { name: 'ESPACIO_PUBLICO_BUFFER', description: 'AREA DE INFLUENCIA DE UN RADIO 300M PARA CADA ESPACIO PUBLICO DETERMINADO POR EL POT 2014 DE MEDELLIN', zipPath: 'DATA/ESPACIO_PUBLICO_BUFFER.zip', color: '#003f8c', fill: '#1684e8', fillOpacity: 0.2, weight: 2, pane: 'bufferPane' },
  { name: 'LIMITE BARRIO', description: 'LIMITE BARRIO LAS INDEPENDENCIAS COMUNA SAN JAVIER', zipPath: 'DATA/LIMITE BARRIO.zip', color: '#a64b24', fill: '#e5a16e' }
];

var multitemporalGroup = L.layerGroup().addTo(map);
var multitemporalLayers = [
  { year: 2006, title: '2006', path: 'DATA/2006.tif' },
  { year: 2014, title: '2014', path: 'DATA/2014.tif' },
  { year: 2024, title: '2024', path: 'DATA/2024.tif' }
];
var multitemporalTiles = [];
var rangeInput = document.getElementById('multitemporal-range');
var tiffToggle = document.getElementById('toggle-tiff');
var tiffVisible = true;

if (tiffToggle) {
  tiffToggle.addEventListener('click', function () {
    tiffVisible = !tiffVisible;
    if (tiffVisible) {
      multitemporalGroup.addTo(map);
    } else {
      map.removeLayer(multitemporalGroup);
    }

    var action = tiffVisible ? 'Ocultar' : 'Mostrar';
    tiffToggle.setAttribute('aria-label', action + ' imágenes TIFF');
    tiffToggle.setAttribute('title', action + ' imágenes TIFF');
    tiffToggle.setAttribute('aria-pressed', String(tiffVisible));
    tiffToggle.classList.toggle('is-off', !tiffVisible);
  });
}

function cargarTeselasMultitemporales() {
  var status = document.getElementById('raster-status');
  var loadedCount = 0;
  var rasterBoundsFocused = false;

  multitemporalLayers.forEach(function (layerInfo, index) {
    fetch(encodeURI(layerInfo.path))
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' al solicitar ' + layerInfo.path);
        }
        return response.arrayBuffer();
      })
      .then(function (buffer) {
        return parseGeoraster(buffer, { readOnDemand: true });
      })
      .then(function (georaster) {
        // Estos TIFF son de una banda con paleta; GeoRasterLayer la lee del GeoTIFF.
        var capa = new GeoRasterLayer({
          georaster: georaster,
          opacity: 0,
          minZoom: 0,
          maxZoom: 22,
          resolution: 256,
          resampleMethod: 'nearest'
        });

        capa.on('tileerror', function (event) {
          var detail = event.error && event.error.message ? event.error.message : 'error de proyeccion o renderizado';
          console.error('Error dibujando TIFF ' + layerInfo.year + ':', event.error || event);
          if (status) status.textContent = 'No se pudo dibujar el TIFF ' + layerInfo.year + ': ' + detail;
        });

        multitemporalGroup.addLayer(capa);
        if (!rasterBoundsFocused && capa.getBounds().isValid()) {
          map.fitBounds(capa.getBounds().pad(0.05), { maxZoom: 16 });
          rasterBoundsFocused = true;
        }
        // Guardar por índice mantiene el año correcto aunque los TIFF carguen desordenados.
        multitemporalTiles[index] = { year: layerInfo.year, layer: capa };
        loadedCount += 1;
        actualizarCapaMultitemporal(Number(rangeInput ? rangeInput.value : 0));

        if (status) {
          status.textContent = 'Imágenes TIFF disponibles: ' + loadedCount + ' de ' + multitemporalLayers.length;
        }
      })
      .catch(function (error) {
        console.error('Error cargando TIFF ' + layerInfo.path + ':', error);
        if (status) {
          status.textContent = 'Error en TIFF ' + layerInfo.year + ': ' + error.message + '. Revisa DATA y abre el visor con Live Server.';
        }
      });
  });
}
function actualizarCapaMultitemporal(index) {
  if (!multitemporalTiles.length) return;

  var safeIndex = Math.max(0, Math.min(multitemporalTiles.length - 1, index));

  multitemporalTiles.forEach(function (entry, idx) {
    if (entry.layer && entry.layer.setOpacity) {
      entry.layer.setOpacity(idx === safeIndex ? 0.8 : 0);
    }
  });

}

if (rangeInput) {
  rangeInput.addEventListener('input', function (event) {
    actualizarCapaMultitemporal(Number(event.target.value));
  });
}

function renderShapeButtons() {
  var toolbar = document.getElementById('shape-toolbar');
  if (!toolbar) return;

  toolbar.innerHTML = '';

  shapeConfigs.forEach(function (config) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'shape-toggle is-active';
    button.dataset.shape = config.name;
    button.style.setProperty('--shape-color', config.color);
    button.innerHTML = '<span class="shape-dot"></span>' + config.name;

    button.addEventListener('click', function () {
      var layer = shapeLayers[config.name];
      if (!layer) {
        button.classList.add('is-disabled');
        return;
      }

      button.classList.remove('is-disabled');

      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
        button.classList.remove('is-active');
      } else {
        map.addLayer(layer);
        button.classList.add('is-active');
      }
    });

    toolbar.appendChild(button);
    shapeButtons[config.name] = button;
  });
}

function mostrarAtributos(feature, layer, config) {
  var propiedades = feature.properties || {};
  var contenedor = document.createElement('div');
  var descripcion = document.createElement('p');
  descripcion.textContent = config.description;
  contenedor.appendChild(descripcion);

  if (Object.keys(propiedades).length) {
    var contenido = document.createElement('pre');
    contenido.textContent = Object.entries(propiedades)
      .map(function ([campo, valor]) {
        return campo + ': ' + valor;
      })
      .join('\n');
    contenedor.appendChild(contenido);
  }

  layer.bindPopup(contenedor);
}

function crearEstiloForma(config) {
  var esLimiteBarrio = config.name === 'LIMITE BARRIO';
  return {
    color: config.color,
    weight: config.weight || (esLimiteBarrio ? 2 : 3),
    fillColor: config.fill,
    fillOpacity: config.fillOpacity !== undefined ? config.fillOpacity : (esLimiteBarrio ? 0.24 : 0.62)
  };
}

function registrarCapaShape(config, capa) {
  shapeLayers[config.name] = capa;

  if (shapeButtons[config.name]) {
    shapeButtons[config.name].classList.remove('is-disabled');
    shapeButtons[config.name].classList.add('is-active');
  }

  var layerBounds = capa.getBounds ? capa.getBounds() : null;
  if (layerBounds && layerBounds.isValid && layerBounds.isValid()) {
    boundsGlobal.extend(layerBounds);
  }

  if (boundsGlobal.isValid()) {
    map.fitBounds(boundsGlobal.pad(0.45));
  }
}

function cargarFormaVectorial(config) {
  fetch(encodeURI(config.zipPath))
    .then(function (response) {
      if (!response.ok) throw new Error('No se pudo cargar ' + config.zipPath);
      return response.arrayBuffer();
    })
    .then(function (buffer) { return shp(buffer); })
    .then(function (geojson) {
      var capa = L.geoJSON(geojson, {
        pane: config.pane,
        style: function () { return crearEstiloForma(config); },
        pointToLayer: function (feature, latlng) {
          return L.circleMarker(latlng, {
            radius: 7,
            color: config.color,
            weight: 2,
            fillColor: config.fill,
            fillOpacity: 1
          });
        },
        onEachFeature: function (feature, layer) {
          mostrarAtributos(feature, layer, config);
          layer.bindTooltip(config.name, { sticky: true });
        }
      }).addTo(map);
      registrarCapaShape(config, capa);
    })
    .catch(function (error) {
      console.error('Error cargando shape ' + config.name + ':', error);
    });
}

renderShapeButtons();
shapeConfigs.forEach(cargarFormaVectorial);
cargarTeselasMultitemporales();


