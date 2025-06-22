// init map
const map = L.map('map', {
    minZoom: 1,
    maxZoom: 4,
    center: [0, 0],
    zoom: 1,
    crs: L.CRS.Simple,
    zoomControl: false
});

// set up plab map projection
const w = 5120;
const h = 3072;
const bounds = new L.LatLngBounds(map.unproject([0, h], map.getMaxZoom() - 1), map.unproject([w, 0], map.getMaxZoom() - 1));
const plabMap = L.imageOverlay("States.svg", bounds).addTo(map);
const zoomer = new L.Control.Zoom({ position: 'bottomright' }).addTo(map);
map.setMaxBounds(bounds);

// plane icon
const planeIcon = L.icon({
    iconUrl: 'plane.png',
    iconSize: [15, 15],
    iconAnchor: [15, 15]
});

//airport icons
const airportIcon = L.icon({
    iconUrl: 'airport.png',
    iconSize: [12, 12],
    iconAnchor: [12, 12]
});

//show airports
data["Airports"].forEach(function (data, index) {
    const marker = L.marker(L.latLng(data.lat, data.lng), { icon: airportIcon, rotationAngle: 0 });
    marker.addTo(map)
    marker.bindPopup(`${data.name} (${data.code})`)
})

// data for generating planes
const now = new Date();
const flights = [];
const FLIGHT_SPEED = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const BOARDING_TIME = 10 * 60 * 1000;
const howMuchPlanes = 500
const today = new Date();
const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

function generateTimetable(seed, airports, airliners, startTime, endTime) {
    let timetable = [];
    let usedAirports = [...airports];
    let rng = seededRandom(seed);
    let currTime = new Date(startTime);
    let currAirportIdx = Math.floor(rng() * usedAirports.length);
    let currAirport = usedAirports[currAirportIdx];

    while (currTime < endTime) {
        let nextAirports = usedAirports.filter(a => a.code !== currAirport.code);
        if (nextAirports.length === 0) break;
        let nextIdx = Math.floor(rng() * nextAirports.length);
        let nextAirport = nextAirports[nextIdx];

        let from = L.latLng(currAirport.lat, currAirport.lng);
        let to = L.latLng(nextAirport.lat, nextAirport.lng);
        let distance = getDistance(from, to);
        let airline = airliners[Math.floor(rng() * airliners.length)];
        let model = data.brands[Math.floor(rng() * data.brands.length)];
        let depart = new Date(currTime);
        let arrive = new Date(depart.getTime() + (distance / FLIGHT_SPEED) * 10);

        if (arrive > endTime) break;

        timetable.push({
            from, to, depart, arrive, airline, model, data: [currAirport, nextAirport]
        });

        currTime = new Date(arrive.getTime() + BOARDING_TIME);
        currAirport = nextAirport;
    }
    return timetable;
}

// create planes 
for (let i = 0; i < howMuchPlanes; i++) {
    let timetable = generateTimetable(i * 100, data["Airports"], data.airliners, startOfDay, endOfDay);
    let firstLeg = timetable[0];
    let marker = L.marker(firstLeg.from, { icon: planeIcon, rotationAngle: 0 });

    marker.addTo(map);
    marker.bindPopup(`<b>${firstLeg.airline.name} (${firstLeg.model.brand} ${firstLeg.model.model})</b><br>${firstLeg.data[0].code} ➤ ${firstLeg.data[1].code}<br>From: ${firstLeg.data[0].name}<br>To: ${firstLeg.data[1].name}`);
    flights.push({ timetable, marker, currLeg: 0, arrived: false });
}

// update planes
function updatePlanes() {
    const currentTime = new Date();
    let allDone = false;

    for (let flight of flights) {
        let leg = flight.timetable[flight.currLeg];
        if (!leg) {
            allDone = true;
            break;
        }

        if (currentTime < leg.depart) {
            flight.marker.setLatLng(leg.from);
            flight.marker.setRotationAngle(0);
            continue;
        }

        if (currentTime >= leg.arrive) {
            flight.marker.setLatLng(leg.to);
            flight.marker.setRotationAngle(0);
            let nextLeg = flight.timetable[flight.currLeg + 1];
            if (nextLeg && currentTime >= nextLeg.depart) {
                flight.currLeg++;
                let newLeg = flight.timetable[flight.currLeg];
                flight.marker.bindPopup(`<b>${newLeg.airline.name} (${newLeg.model.brand} ${newLeg.model.model})</b><br>${newLeg.data[0].code} ➤ ${newLeg.data[1].code}<br>From: ${newLeg.data[0].name}<br>To: ${newLeg.data[1].name}`);
            } else if (!nextLeg) {
                allDone = true;
                break;
            }
            continue;
        }

        let total = leg.arrive - leg.depart;
        let elapsed = currentTime - leg.depart;
        let progress = Math.max(0, Math.min(1, elapsed / total));
        let pos = interpolatePosition(leg.from, leg.to, progress);
        let heading = getHeading(leg.from, leg.to);
        flight.marker.setLatLng(pos);
        flight.marker.setRotationAngle(heading);
    }

    if (allDone) {
        location.reload();
    } else {
        requestAnimationFrame(updatePlanes);
    }
}
updatePlanes();

// show coordinates
let Position = L.Control.extend({
    _container: null,
    options: {
        position: 'bottomleft'
    },

    onAdd: function (map) {
        var latlng = L.DomUtil.create('div', 'mouseposition');
        this._latlng = latlng;
        return latlng;
    },

    updateHTML: function (lat, lng) {
        this._latlng.innerHTML = `"lat": ` + lat + `,<br> "lng": ` + lng;
    }
});

let thisposition = new Position();
let currCoordinates = { lat: 0, lng: 0 }
map.addControl(thisposition);
map.addEventListener('mousemove', (event) => {
    let lat = Math.round(event.latlng.lat * 100000) / 100000;
    let lng = Math.round(event.latlng.lng * 100000) / 100000;
    thisposition.updateHTML(lat, lng);

    currCoordinates.lat = lat
    currCoordinates.lng = lng
});

document.addEventListener('keydown', async (e) => {
    if (e.key == 'c') {
        navigator.clipboard.writeText(`"lat": ` + currCoordinates.lat + `,\n "lng": ` + currCoordinates.lng)
    }
});