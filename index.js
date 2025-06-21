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
data["Airports"].forEach(function (data, index) {
    const marker = L.marker(L.latLng(data.lat, data.lng), { icon: airportIcon, rotationAngle: 0 });
    marker.addTo(map)
    marker.bindPopup(`${data.name} (${data.code})`)
})

// generate flights
const now = new Date();
const flights = [];
const FLIGHT_SPEED = 50;
for (let i = 0; i < 1000; i++) {
    var flight = {}
    var airportData = []
    var airports = [...data["Airports"]]

    var random1 = Math.floor(seededRandom(i * 100)() * airports.length);
    airportData.push(airports[random1])
    flight.from = L.latLng(airportData[0].lat, airportData[0].lng)
    airports.splice(random1, 1)

    var random2 = Math.floor(seededRandom(i * 100)() * airports.length);
    airportData.push(airports[random2])
    flight.to = L.latLng(airportData[1].lat, airportData[1].lng)

    flight.depart = new Date(now.getTime() - Math.floor(seededRandom(i * 100)()) * 1000)
    flight.id = `${airportData[0].code} -> ${airportData[1].code}`

    var distance = getDistance(flight.from, flight.to);
    flight.airline = data.airliners[Math.floor(seededRandom(i * 100)() * data.airliners.length)]
    flight.arrive = new Date(flight.depart.getTime() + (distance / FLIGHT_SPEED) * 10);
    flight.marker = L.marker(flight.from, { icon: planeIcon, rotationAngle: 0 });
    flight.marker.addTo(map)
    flight.marker.bindPopup(`<b>${flight.airline.name}</b><br>${flight.id}<br>From: ${airportData[0].name}<br>To: ${airportData[1].name}`)

    flights.push(flight)
}

//move the planes
function updatePlanes() {
    const currentTime = new Date();
    let allDone = true;

    flights.forEach(flight => {
        if (flight.boardingUntil && currentTime < flight.boardingUntil) {
            allDone = false;
            return;
        }

        if (flight.boardingUntil && currentTime >= flight.boardingUntil) {
            let airports = [...data["Airports"]];
            airports = airports.filter(a => a.code !== flight.to.code);
            const randomIdx = Math.floor(Math.random() * airports.length);
            const newAirport = airports[randomIdx];

            flight.from = L.latLng(flight.to.lat, flight.to.lng);
            flight.to = L.latLng(newAirport.lat, newAirport.lng);
            flight.depart = new Date(currentTime);
            flight.id = `${flight.to.code} -> ${newAirport.code}`;
            const distance = getDistance(flight.from, flight.to);
            flight.arrive = new Date(flight.depart.getTime() + (distance / FLIGHT_SPEED) * 10);
            flight.marker.setLatLng(flight.from);
            flight.marker.setRotationAngle(0);
            flight.marker.bindPopup(`${flight.id}`);
            delete flight.boardingUntil;
            delete flight.arrived;
        }

        const total = flight.arrive - flight.depart;
        const elapsed = currentTime - flight.depart;
        let progress = elapsed / total;

        progress = Math.max(0, Math.min(1, progress));

        if (progress < 1) {
            allDone = false;

            const pos = interpolatePosition(flight.from, flight.to, progress);
            const heading = getHeading(flight.from, flight.to);

            flight.marker.setLatLng(pos);
            flight.marker.setRotationAngle(heading);
        } else {
            if (!flight.arrived && !flight.boardingUntil) {
                flight.arrived = true;
                flight.marker.setLatLng(flight.to);
                flight.boardingUntil = new Date(currentTime.getTime() + 10 * 60 * 1000);
            } else if (flight.boardingUntil) {
                allDone = false;
            }
        }
    });

    if (!allDone) {
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