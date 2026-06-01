// ======================================================
// HYDRORANDO -
// ======================================================


// ======================================================
// PROJECTION SUISSE EPSG:2056
//
//qui Permet à OpenLayers de convertir les coordonnées
// EPSG:2056 (suisse) vers la projection de la carte (EPSG:3857)
// afin d'afficher correctement les objets géographiques
// ======================================================

proj4.defs(

  "EPSG:2056",

  "+proj=somerc +lat_0=46.95240555555556 " +
  "+lon_0=7.439583333333333 +k_0=1 " +
  "+x_0=2600000 +y_0=1200000 " +
  "+ellps=bessel +units=m +no_defs"

);

ol.proj.proj4.register(proj4);


// ======================================================
// VARIABLES
// la définition de ces  variables permettent de gérer le mode actif,
// l'historique des actions, le dessin des sentiers,
// l'itinéraire de randonnée et le suivi GPS en temps réel.
//(modes, dessin,randonnée, GPS et historique).
// ======================================================

let currentMode = "search";  // Mode actuellement actif dans l'application

let history = [];  // Historique des actions pour la fonction Annuler

let sketch = null;   // Géométrie actuellement en cours de dessin

let hikePoints = [];   // Liste des points de randonnée
						// (départ, étapes intermédiaires, arrivée)

let gpsWatchId = null; // Identifiant du suivi GPS du navigateur

let userPositionFeature = null; // Objet représentant la position actuelle
								// de l'utilisateur sur la carte

let nextStepFeature = null; // Objet représentant la prochaine étape
							// ou direction à suivre pendant la randonnée


// ======================================================
// CARTE
// Création de la carte OpenLayers avec le fond
// OpenStreetMap et une vue initiale centrée sur Lausanne.
// ======================================================

const map = new ol.Map({

  target: "map",  // élément HTML qui recevra la carte

  layers: [

// fond cartographique OpenStreetMap
    new ol.layer.Tile({

      source: new ol.source.OSM()

    })

  ],

  view: new ol.View({
	  
// centre de la carte (Lausanne)
    center: ol.proj.fromLonLat([6.63, 46.52]),

// niveau de zoom initial
    zoom: 12

  })

});


// ======================================================
// STYLES
// Définition de l'apparence graphique des différents
// objets affichés sur la carte : sentiers, fontaines,
// lacs, rivières, limites administratives et tracés
// créés par les utilisateurs
// ======================================================

// cette fonction qui est en bas est un Style utilisé pour mettre en évidence
// un sentier sélectionné par l'utilisateur
function highlightStyle(){

  return new ol.style.Style({

    stroke: new ol.style.Stroke({

      color: "#ffc400",

      width: 6

    })

  });

}


const sentierStyle = new ol.style.Style({

  stroke: new ol.style.Stroke({

    color: "#f59e0b",

    width: 3,

    lineDash: [8, 8]

  })

});


const fontaineStyle = new ol.style.Style({

  image: new ol.style.Circle({

    radius: 7,

    fill: new ol.style.Fill({ color: "#2d95e8" }),

    stroke: new ol.style.Stroke({ color: "white", width: 3 })

  })

});


const lacStyle = new ol.style.Style({

  fill: new ol.style.Fill({ color: "rgba(0,150,255,0.45)" }),

  stroke: new ol.style.Stroke({ color: "#2d95e8", width: 1.5 })

});


const riviereStyle = new ol.style.Style({

  stroke: new ol.style.Stroke({ color: "#1aa7ec", width: 3 })

});


const limiteStyle = new ol.style.Style({

  stroke: new ol.style.Stroke({

    color: "#1f2937",

    width: 2.5,

    lineDash: [10, 6]

  })

});

// pour definir le Style des sentiers créés ou modifiés par les contributeurs
// Affichage sous forme de ligne violette épaisse
const drawStyle = new ol.style.Style({

  stroke: new ol.style.Stroke({ color: "#7c3aed", width: 4 })

});


//// Style randonnée + GPS
// Définit l'apparence des éléments liés à la randonnée :
// - la ligne représentant l'itinéraire ;
// - la position GPS de l'utilisateur ;
// - les points de départ, d'arrivée et les étapes intermédiaires.


function hikeStyle(feature){       // Retourne le style graphique adapté
									// selon le type d'objet de randonnée

  const type = feature.get("hike_type");  


  if(type === "line"){

    return new ol.style.Style({

      stroke: new ol.style.Stroke({

        color: "#16864c",

        width: 5

      })

    });

  }


  if(type === "gps"){

    return new ol.style.Style({

      image: new ol.style.RegularShape({

        points: 3,

        radius: 13,

        rotation: feature.get("rotation") || 0,

        fill: new ol.style.Fill({ color: "#0b68bf" }),

        stroke: new ol.style.Stroke({ color: "white", width: 3 })

      })

    });

  }


  let color = "#0b68bf";

  if(type === "depart")
    color = "#16864c";

  if(type === "arrivee")
    color = "#d94848";


  return new ol.style.Style({

    image: new ol.style.Circle({

      radius: 8,

      fill: new ol.style.Fill({ color: color }),

      stroke: new ol.style.Stroke({ color: "white", width: 3 })

    }),

    text: new ol.style.Text({

      text: feature.get("label") || "",

      offsetY: -20,

      font: "bold 12px Arial",

      fill: new ol.style.Fill({ color: "#111827" }),

      stroke: new ol.style.Stroke({ color: "white", width: 3 })

    })

  });

}


// ======================================================
// SOURCES :stockage des données géographiques
//
// Sources utilisées pour stocker les différents objets
// géographiques affichés sur la carte : sentiers,
// fontaines, lacs, rivières, limites administratives,
// contributions des utilisateurs et itinéraires de randonnée

// ======================================================

const sentiersSource = new ol.source.Vector();

const fontaineSource = new ol.source.Vector();

const lacSource = new ol.source.Vector();

const riviereSource = new ol.source.Vector();

const limiteSource = new ol.source.Vector();

const drawSource = new ol.source.Vector();

const hikeSource = new ol.source.Vector();


// ======================================================
// COUCHES : affichage de ces données
// ======================================================

const sentiersLayer = new ol.layer.Vector({

  source: sentiersSource,

  style: sentierStyle

});


const fontaineLayer = new ol.layer.Vector({

  source: fontaineSource,

  style: fontaineStyle

});


const lacLayer = new ol.layer.Vector({

  source: lacSource,

  style: lacStyle

});


const riviereLayer = new ol.layer.Vector({

  source: riviereSource,

  style: riviereStyle

});


const limiteLayer = new ol.layer.Vector({

  source: limiteSource,

  style: limiteStyle

});


const drawLayer = new ol.layer.Vector({

  source: drawSource,

  style: drawStyle

});


const hikeLayer = new ol.layer.Vector({

  source: hikeSource,

  style: hikeStyle

});


// ======================================================
// AJOUT COUCHES: pour l'ajout des differentes couches 
// ======================================================

map.addLayer(limiteLayer);

map.addLayer(lacLayer);

map.addLayer(riviereLayer);

map.addLayer(fontaineLayer);

map.addLayer(sentiersLayer);

map.addLayer(drawLayer);

map.addLayer(hikeLayer);


// ======================================================
// OUTILS CONTRIBUTION
// ======================================================

const draw = new ol.interaction.Draw({

  source: drawSource,

  type: "LineString"

});


const modify = new ol.interaction.Modify({

  source: drawSource

});


const selectInteraction = new ol.interaction.Select({

  layers: [drawLayer]

});


map.addInteraction(selectInteraction);


// ======================================================
// CHARGEMENT DONNEES
// ======================================================

fetch("/api/limite")

.then(r => r.json())

.then(data => {

  const features =
    new ol.format.GeoJSON()
    .readFeatures(data, { featureProjection: "EPSG:3857" });

  limiteSource.addFeatures(features);

});


fetch("/api/sentiers")

.then(r => r.json())

.then(data => {

  data.forEach(g => {

    const features =
      new ol.format.GeoJSON()
      .readFeatures(g, {

        dataProjection: "EPSG:2056",

        featureProjection: "EPSG:3857"

      });

    sentiersSource.addFeatures(features);

  });

  updateStats();

});


fetch("/api/fontaines")

.then(r => r.json())

.then(data => {

  const features =
    new ol.format.GeoJSON()
    .readFeatures(data, { featureProjection: "EPSG:3857" });

  fontaineSource.addFeatures(features);

  updateStats();

});


fetch("/api/lacs")

.then(r => r.json())

.then(data => {

  const features =
    new ol.format.GeoJSON()
    .readFeatures(data, { featureProjection: "EPSG:3857" });

  lacSource.addFeatures(features);

  updateStats();

});


fetch("/api/rivieres")

.then(r => r.json())

.then(data => {

  const features =
    new ol.format.GeoJSON()
    .readFeatures(data, { featureProjection: "EPSG:3857" });

  riviereSource.addFeatures(features);

});


// ======================================================
//// MODES
// Cette fonction nous permet d'activer le mode sélectionné par
// l'utilisateur (exploration, randonnée ou contribution),
// met à jour l'interface graphique et active ou désactive
// les outils nécessaires sur la carte.
// ======================================================

function setMode(mode){          // Change le mode actif de l'application et aussi, on sait alors quel comportement adopter (rando etc..)

  currentMode = mode;

  map.removeInteraction(draw); //pour repartir toujours  

  map.removeInteraction(modify); //d'un état propre avant d'activer un nouveau mode

  document.querySelectorAll(".tab")   //Retire la couleur active de tous les onglets.
  .forEach(btn => btn.classList.remove("active"));

  const tab = document.getElementById("tab-" + mode); //Active visuellement l'onglet sélectionné

  if(tab)
    tab.classList.add("active");

//Affichage du bon panneau
  document.querySelectorAll(".panel")  //Cache tous les panneaux
  .forEach(panel => panel.classList.remove("active-panel"));

  const panel = document.getElementById("panel-" + mode); //affiche uniquement celui correspondant au mode.

  if(panel)
    panel.classList.add("active-panel");


  if(mode === "contribution"){ // permettant a l'utilisateur de dessiner un sentier, modifier un sentier et sauvergarder sa contribution 
  

    map.addInteraction(draw);

    map.addInteraction(modify);

    setStatus("➕ Mode contribution : dessinez ou modifiez un sentier.");

    return;

  }


  if(mode === "navigation"){      ////pour permettre le lancement de l'application pour navigation en mettant des points de départ, étapes et d'arriver avant de lancer le GPS

    setStatus("🥾 Mode Rando : cliquez départ, étapes, arrivée.");

    return;

  }


  setStatus("🔍 Mode exploration actif.");

}


// ======================================================
// CLIC CARTE
// Lorsque l'utilisateur clique sur la carte en mode
// exploration, le programme recherche les sentiers
// situés à proximité du point sélectionné.
// ======================================================

map.on("click", function(evt){

  if(currentMode === "navigation"){

    addHikePoint(evt.coordinate);

    return;

  }


  if(currentMode !== "search")
    return;


  const clicked = evt.coordinate;

  const features = sentiersSource.getFeatures();

  features.forEach(f => f.setStyle(sentierStyle));


  const difficulty = document.getElementById("difficulty").value;

  let maxDistance = Infinity;

  if(difficulty === "facile")
    maxDistance = 5000;

  if(difficulty === "moyenne")
    maxDistance = 8000;


  let count = 0;


  features.forEach(f => {

    const closest = f.getGeometry().getClosestPoint(clicked);
	
    const dx = clicked[0] - closest[0];// Calcul des écarts horizontaux et verticaux

    const dy = clicked[1] - closest[1];// entre le clic et le sentier.	

    const d = Math.sqrt(dx * dx + dy * dy);


    if(d > maxDistance)
      return;


    f.setStyle(highlightStyle());

    count++;

  });


  setStatus("🔍 " + count + " sentier(s) proche(s) trouvé(s).");

});


// ======================================================
// RANDONNEE
// A chaque clic en mode randonnée :
// - le point cliqué est ajouté à la liste hikePoints ;
// - la ligne de l'itinéraire est reconstruite ;
// - les points départ, étapes et arrivée sont réaffichés ;
// - les résultats de distance et de temps sont mis à jour.
// ======================================================

// Ajoute un nouveau point à l'itinéraire
// puis met à jour l'affichage de la randonnée.
function addHikePoint(coord){

  hikePoints.push(coord);

  rebuildHikeLayer();

  updateHikeResults();

}


function rebuildHikeLayer(){  //redessine l’itinéraire au fur et mesure des clic sur la carte

  hikeSource.getFeatures()
  .filter(f => f.get("hike_group") === "planner")
  .forEach(f => hikeSource.removeFeature(f));


  if(hikePoints.length >= 2){

    const line = new ol.Feature({

      geometry: new ol.geom.LineString(hikePoints)

    });

    line.set("hike_type", "line");

    line.set("hike_group", "planner");

    hikeSource.addFeature(line);

  }


  hikePoints.forEach((coord, index) => {

    const point = new ol.Feature({

      geometry: new ol.geom.Point(coord)

    });


    let type = "etape";

    let label = "Étape " + index;


    if(index === 0){

      type = "depart";

      label = "Départ";

    }

    else if(index === hikePoints.length - 1){

      type = "arrivee";

      label = "Arrivée";

    }


    point.set("hike_type", type);

    point.set("hike_group", "planner");

    point.set("label", label);

    hikeSource.addFeature(point);

  });

}


function updateHikeResults(){  //recalcule la distance et temps

  const resultDiv = document.getElementById("hike-results");

  if(!resultDiv)
    return;


  if(hikePoints.length === 0){

    resultDiv.innerHTML = "Aucun point sélectionné.";

    return;

  }


  let total = 0;

  for(let i = 1; i < hikePoints.length; i++){

    total += ol.sphere.getDistance(

      ol.proj.toLonLat(hikePoints[i - 1]),

      ol.proj.toLonLat(hikePoints[i])

    );

  }


  const km = total / 1000;

  const hours = km / 4; // Estimation du temps de marche
						// en supposant une vitesse moyenne de 4 km/h en suposant que 1h=4km

  const h = Math.floor(hours);

  const min = Math.round((hours - h) * 60);

// Construction du tableau récapitulatif qui pourra permettre 
// d'affiché dans le panneau de randonnée les resultats ( distance, temps de parcours)
  resultDiv.innerHTML =
    "<table>" +
    "<tr><td><b>Distance</b></td><td>" + km.toFixed(2) + " km</td></tr>" +
    "<tr><td><b>Temps estimé</b></td><td>" + h + " h " + min + " min</td></tr>" +
    "<tr><td><b>Points</b></td><td>" + hikePoints.length + "</td></tr>" +
    "<tr><td><b>GPS</b></td><td>" + (gpsWatchId ? "Actif" : "Inactif") + "</td></tr>" +
    "</table>";

}


function startHike(){   // Lance le suivi GPS et démarre la navigation
						// le long de l'itinéraire sélectionné.

  if(hikePoints.length < 2){

    alert("Placez au minimum un départ et une arrivée.");

    return;

  }


  if(!navigator.geolocation){

    alert("GPS indisponible sur ce navigateur.");

    return;

  }


  if(gpsWatchId){      // Empêche de lancer plusieurs suivis GPS

    setStatus("📍 GPS déjà actif.");  

    return;

  }


  gpsWatchId = navigator.geolocation.watchPosition(         // Démarre le suivi GPS continu.
															// La fonction updateGpsPosition sera appelée
															// à chaque changement de position pour notre guidage pendant la rando


    updateGpsPosition,

    gpsError,

    {

      enableHighAccuracy: true,   // Demande la meilleure précision GPS possible.

      maximumAge: 0, // Force l'utilisation d'une position récente.

      timeout: 10000  // Temps maximal d'attente de la position GPS (10sec)

    }

  );


  updateHikeResults();    // Actualise les informations de randonnée.

  setStatus("📍 GPS lancé. Suivez la flèche bleue.");

}



function updateGpsPosition(position){  // Met à jour la position GPS de l'utilisateur,oriente la flèche vers la prochaine étape et vérifie l'arrivée à destination.

//Convertit les coordonnées GPS en coordonnées utilisables par OpenLayers
  const coord = ol.proj.fromLonLat([

    position.coords.longitude,

    position.coords.latitude

  ]);

//Cherche la prochaine étape et calcule l’orientation de la flèche.
  const target = getNextTarget(coord);

  const rotation = getRotation(coord, target);


  if(!userPositionFeature){

    userPositionFeature = new ol.Feature({

      geometry: new ol.geom.Point(coord)

    });

    userPositionFeature.set("hike_type", "gps");

    hikeSource.addFeature(userPositionFeature);

  }

  else{

    userPositionFeature.getGeometry().setCoordinates(coord);

  }


  userPositionFeature.set("rotation", rotation);  //Oriente la flèche bleue

  userPositionFeature.changed();


  map.getView().animate({  //Recentre la carte sur l’utilisateur

    center: coord,

    duration: 400

  });


  checkArrival(coord);

}


function getNextTarget(currentCoord){   // Détermine la prochaine étape à atteindre
// à partir de la position actuelle de l'utilisateur.

  if(hikePoints.length === 0)
    return currentCoord;


  let nearestIndex = 0;

  let nearestDistance = Infinity;  //afin que le premier point trouvé soit plus proche


  hikePoints.forEach((p, index) => {

    const d = ol.sphere.getDistance(     // Calcule la distance réelle entre
										// la position GPS et le point étudié.

      ol.proj.toLonLat(currentCoord),

      ol.proj.toLonLat(p)

    );


    if(d < nearestDistance){       // Si un point plus proche est trouvé,il devient la nouvelle référence.

      nearestDistance = d;

      nearestIndex = index;

    }

  });


  const nextIndex = Math.min(nearestIndex + 1, hikePoints.length - 1);  //Détermination de la prochaine étape

  return hikePoints[nextIndex];

}


function getRotation(fromCoord, toCoord){   //calculer l'orientation de la flèche GPS

  const dx = toCoord[0] - fromCoord[0]; // Différence horizontale 

  const dy = toCoord[1] - fromCoord[1];  //Différence vertical


  return Math.atan2(dx, dy);

}


function checkArrival(coord){         // Vérifie si l'utilisateur a atteint
// la destination finale de la randonnée.

  const destination = hikePoints[hikePoints.length - 1];

  const distance = ol.sphere.getDistance(

    ol.proj.toLonLat(coord),

    ol.proj.toLonLat(destination)

  );

// Si l'utilisateur se trouve à moins de 30 mètres
// de l'arrivée, la randonnée est automatiquement
// arrêtée et un message de confirmation est affiché

  if(distance <= 30){

    stopHike();

    setStatus("🏁 Vous êtes arrivé à destination.");

    alert("🏁 Vous êtes arrivé à destination.");

  }

}


function gpsError(error){

  alert("Impossible d'obtenir la position GPS.");

  console.error(error);

}


function stopHike(){  // Arrête le suivi GPS et met à jour l'interface de randonnée.


  if(gpsWatchId){  // Vérifie qu'un suivi GPS est actuellement actif.

    navigator.geolocation.clearWatch(gpsWatchId);

    gpsWatchId = null;

    updateHikeResults();

    setStatus("⏹ GPS arrêté.");

  }

}


function clearHike(){   // Supprime l'itinéraire de randonnée
// et réinitialise l'affichage.

  hikePoints = [];

  hikeSource.getFeatures()
  .filter(f => f.get("hike_group") === "planner")
  .forEach(f => hikeSource.removeFeature(f));

  updateHikeResults();

  setStatus("🥾 Itinéraire effacé.");

}


// ======================================================
// CONTRIBUTIONS
//Pendant le dessin :
// - la géométrie en cours est mémorisée ;
// - l'historique est sauvegardé pour l'annulation ;
// - la longueur du sentier est calculée en temps réel ;
// - la distance est affichée à côté du curseur.
//
// Lorsque le dessin est terminé, les statistiques
// de l'application sont mises à jour.
// ======================================================

const tooltip = document.createElement("div");  // Création de la fenêtre d'informationet  affichant la distance du sentier.


tooltip.style.background = "white";

tooltip.style.padding = "7px 10px";

tooltip.style.borderRadius = "8px";

tooltip.style.boxShadow = "0 0 12px rgba(0,0,0,0.22)";

const overlay = new ol.Overlay({  // Création d'un élément flottant OpenLayers qui suivra le curseur sur la carte.


  element: tooltip,

  offset: [15, 0],

  positioning: "center-left"

});

map.addOverlay(overlay);


draw.on("drawstart", function(e){  // Déclenché au début du dessin d'un nouveau sentier.

  sketch = e.feature;  // Stocke temporairement le sentier actuellement en cours de création.


  const clone = drawSource.getFeatures().map(f => f.clone());

  history.push(clone);

});


map.on("pointermove", function(evt){

  overlay.setPosition(evt.coordinate);

  if(!sketch || currentMode !== "contribution")
    return;


  const coords = sketch.getGeometry().getCoordinates();

  let dist = 0;


  for(let i = 1; i < coords.length; i++){

    dist += ol.sphere.getDistance(

      ol.proj.toLonLat(coords[i - 1]),

      ol.proj.toLonLat(coords[i])

    );

  }


  tooltip.innerHTML = (dist / 1000).toFixed(2) + " km";

});


draw.on("drawend", function(){

  sketch = null;

  updateStats();

});


function saveRoute(){

  const features = drawSource.getFeatures();

  if(features.length === 0){

    alert("Aucun sentier à sauvegarder.");

    return;

  }


  const geojson = new ol.format.GeoJSON().writeFeatures(features);

  const distance = calculateFeaturesDistance(features);


  fetch("/api/save_route", {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({

      geometry: geojson,

      distance: distance

    })

  })

  .then(r => r.json())

  .then(data => {

    console.log(data);

    alert("✅ Sentier sauvegardé.");

    updateStats();

  });

}


function updateSelectedRoute(){ // Permet de modifier un sentier contribué
// déjà enregistré dans la base de données

  const selected = selectInteraction.getFeatures();

  if(selected.getLength() === 0){

    alert("Sélectionnez un sentier contribué à modifier.");

    return;

  }


  const feature = selected.item(0);

  const routeId = feature.get("route_id");


  if(!routeId){

    alert("Ce sentier n'a pas encore d'identifiant. Sauvegardez-le d'abord.");

    return;

  }


  const geojson = new ol.format.GeoJSON().writeFeature(feature);

  const featureCollection = JSON.stringify({

    type: "FeatureCollection",

    features: [JSON.parse(geojson)]

  });


  fetch("/api/update_route", {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({

      id: routeId,

      geometry: featureCollection,

      distance: calculateFeaturesDistance([feature])

    })

  })

  .then(r => r.json())

  .then(data => {

    console.log(data);

    alert("✅ Sentier mis à jour.");

  });

}


function loadRoutes(){ //charger tous les sentiers contributeurs enregistrés dans la base SQLite et les afficher sur la carte.

  fetch("/api/routes")

  .then(r => r.json())

  .then(data => {

    drawSource.clear();

    data.forEach(g => {

      const routeId = g.route_id;

      delete g.route_id;

      const features = new ol.format.GeoJSON().readFeatures(g);

      features.forEach(f => {

        f.set("route_id", routeId);

        drawSource.addFeature(f);

      });

    });


    updateStats();

  });

}


function deleteSelected(){

  const selected = selectInteraction.getFeatures();

  if(selected.getLength() === 0){

    alert("Sélectionnez un sentier contribué.");

    return;

  }


  selected.forEach(feature => {

    const routeId = feature.get("route_id");


    if(routeId){

      fetch("/api/delete_route", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ id: routeId })

      });

    }


    drawSource.removeFeature(feature);

  });


  selected.clear();

  updateStats();

  alert("✅ Sentier supprimé.");

}


function undoLastAction(){   //annuler la dernière modification réalisée sur les sentiers contributeurs, comme un CTRL + Z avec nos ordinateur .

  if(history.length === 0){

    alert("Aucune action à annuler.");

    return;

  }


  drawSource.clear();

  const previous = history.pop();

  previous.forEach(f => drawSource.addFeature(f));

  updateStats();

}


// ======================================================
// OUTILS
// ======================================================

function toggleLayer(layer, visible){ //sert à afficher ou masquer une couche de la carte

  layer.setVisible(visible);

}


function zoomIn(){

  const view = map.getView();

  view.animate({

    zoom: view.getZoom() + 1,

    duration: 250

  });

}


function zoomOut(){

  const view = map.getView();

  view.animate({

    zoom: view.getZoom() - 1,

    duration: 250

  });

}


function centerOnLausanne(){

  map.getView().animate({

    center: ol.proj.fromLonLat([6.63, 46.52]),

    zoom: 12,

    duration: 500

  });

}


function setStatus(message){

  const div = document.getElementById("distance-info");

  if(div)
    div.innerHTML = message;

}


function updateStats(){ //mettre à jour automatiquement les statistiques affichées dans l'interface .

  setText("stat-fontaines", fontaineSource.getFeatures().length);

  setText("top-fontaines", fontaineSource.getFeatures().length);

  setText("stat-lacs", lacSource.getFeatures().length);

  setText("stat-sentiers", sentiersSource.getFeatures().length);

  setText("top-sentiers", sentiersSource.getFeatures().length);

  setText("stat-routes", drawSource.getFeatures().length);

}


function setText(id, value){   //qui sert à modifier facilement le contenu d'un élément HTML.

  const el = document.getElementById(id);

  if(el)
    el.innerHTML = value;

}


function calculateFeaturesDistance(features){

  let total = 0;


  features.forEach(f => {

    const geom = f.getGeometry();

    if(geom.getType() !== "LineString")
      return;


    const coords = geom.getCoordinates();


    for(let i = 1; i < coords.length; i++){

      total += ol.sphere.getDistance(

        ol.proj.toLonLat(coords[i - 1]),

        ol.proj.toLonLat(coords[i])

      );

    }

  });


  return total;

}


// Chargement automatique des contributions au démarrage
loadRoutes();
