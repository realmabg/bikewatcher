// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

console.log('Mapbox GL JS Loaded:', mapboxgl);

mapboxgl.accessToken = 'pk.eyJ1IjoiYWhrb25nIiwiYSI6ImNtaTB4NndjcjE2OXAycnExb2R5d3N4OXIifQ.IIQ7KsAuhYXqgh6fCiAZBA';



let trips = await d3.csv(
  'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
  (trip) => {
    trip.started_at = new Date(trip.started_at);
    trip.ended_at = new Date(trip.ended_at);
    return trip;
  },
);

function computeStationTraffic(stations, trips) {
  // Compute departures
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id,
  );

  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id,
  );

  // Computed arrivals as you did in step 4.2

  // Update each station..
  return stations.map((station) => {
    const id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterTripsByTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips
    : trips.filter((trip) => {
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);

        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
      });
}


function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
  const { x, y } = map.project(point); // Project to pixel coordinates
  return { cx: x, cy: y }; // Return as object for use in SVG attributes
}

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

let timeFilter = -1;

// Helper: format minutes → "HH:MM AM/PM"
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
  return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}
map.on('load', async () => {

  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });

  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });


  let jsonData;
  try {
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    jsonData = await d3.json(jsonurl);
    console.log('Loaded JSON Data:', jsonData);
  } catch (error) {
    console.error('Error loading JSON:', error);
    return; 
  }

   let stations = jsonData.data.stations;
  console.log('Stations Array:', stations);


  

stations = computeStationTraffic(stations, trips);

const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);


  const svg = d3.select('#map').select('svg');
  let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);



  let circles = svg
  .selectAll('circle')
  .data(stations, (d) => d.short_name) 
  .join('circle')
  .attr('fill', 'steelblue')
  .attr('stroke', 'white')
  .attr('stroke-width', 1)
  .attr('opacity', 0.8)
  .each(function (d) {
    d3.select(this)
      .append('title')
      .text(
        `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
      );
  })
  .style('--departure-ratio', (d) =>
    stationFlow(d.departures / d.totalTraffic)
  );




  console.log('Stations with traffic:', stations);


  

  
  


  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)
      .attr('cy', (d) => getCoords(d).cy)
      .attr('r', (d) => radiusScale(d.totalTraffic));
  }

  updatePositions();

  

  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  function updateScatterPlot(timeFilter) {
  // Get only the trips that match the selected time filter
  const filteredTrips = filterTripsByTime(trips, timeFilter);

  // Recompute station traffic based on the filtered trips
  const filteredStations = computeStationTraffic(stations, filteredTrips);

  timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

  
  circles = svg
      .selectAll('circle')
      .data(filteredStations, (d) => d.short_name)
      .join('circle')
      .attr('fill', 'steelblue')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)
      .each(function (d) {
        d3.select(this).select('title').remove();
        d3.select(this)
          .append('title')
          .text(
            `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
          );
      }).style('--departure-ratio', (d) =>
    stationFlow(d.departures / d.totalTraffic)
  );
    updatePositions();
}

  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');



  function updateTimeDisplay() {
  let timeFilter = Number(timeSlider.value); // Get slider value

  if (timeFilter === -1) {
    selectedTime.textContent = ''; // Clear time display
    anyTimeLabel.style.display = 'block'; // Show "(any time)"
  } else {
    selectedTime.textContent = formatTime(timeFilter); // Display formatted time
    anyTimeLabel.style.display = 'none'; // Hide "(any time)"
  }

  // Call updateScatterPlot to reflect the changes on the map
  updateScatterPlot(timeFilter);
}

  
  updateTimeDisplay();
  timeSlider.addEventListener('input', updateTimeDisplay);

  



});

