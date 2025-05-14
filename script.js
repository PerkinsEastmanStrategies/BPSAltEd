mapboxgl.accessToken = 'pk.eyJ1IjoicGF0d2QwNSIsImEiOiJjbTZ2bGVhajIwMTlvMnFwc2owa3BxZHRoIn0.moDNfqMUolnHphdwsIF87w';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-71.0589, 42.3601],
  zoom: 11
});

let boundary = null;
let allSchools = [];
let allAltSchools
let addedPoints = [];
let addingPoint = false;
let chart; // reference to Chart.js instance
let clippedIsochrones = []; // Make this global
let isScenarioRunning = false;




map.on('load', async () => {
  // Load boundary
  const boundaryRes = await fetch('BPS_Boundary2.geojson');
  boundary = await boundaryRes.json();

  map.addSource('boundary', { type: 'geojson', data: boundary });

  map.addLayer({
    id: 'boundary-fill',
    type: 'fill',
    source: 'boundary',
    paint: {
      'fill-color': '#003366',
      'fill-opacity': 0.1
    }
    
  });

  // Optional: boundary outline
  map.addLayer({
    id: 'boundary-outline',
    type: 'line',
    source: 'boundary',
    paint: {
      'line-color': '#ffffff',
      'line-width': 1.5
    }
  });


  // Fit to boundary
const bbox = turf.bbox(boundary);
map.fitBounds(bbox, { padding: 40 });

document.getElementById('reset-view-btn').onclick = () => {
  map.fitBounds(bbox, { padding: 40 });
};
  // Load school points
  const schoolRes = await fetch('BPS_AltSchools.geojson');
  const schoolData = await schoolRes.json();
  allSchools = schoolData.features;
  updateChart();

  map.addSource('schools', { type: 'geojson', data: schoolData });
  map.addLayer({
    id: 'schools-layer',
    type: 'circle',
    source: 'schools',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'Room Capacity'],
        0, 4,          // Minimum capacity, minimum radius
        61, 8,         // Small schools, small radius
        130, 14,       // Medium schools, medium radius
        200, 16,       // Medium schools, medium radius
        400, 18,       // Larger schools, larger radius
      ],
      'circle-color': [
        'match',
        ['get', 'Program Type'],
        'Shared', '#1f78b4',      // 🔵 Blue for "Shared" (Keep the existing blue)
        'Standalone', '#ffa500',  // 🟠 Orange for "Standalone"
        '#888888'                 // Default grey if neither matches
      ],
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2
    }
  });
  map.addLayer({
    id: 'schools-labels',
    type: 'symbol',
    source: 'schools',
    layout: {
      'text-field': ['get', 'School'],   // 👈 Use the 'School' field for the label
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 12,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'visibility': 'visible'
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#003366',
      'text-halo-width': 1.5
    },
    minzoom: 14  // 👈 Only show labels when zoomed in
  });
  
// ✅ Add this popup logic after the schools-layer is added
map.on('click', 'schools-layer', (e) => {
  const props = e.features[0].properties;

  // Remove any existing popup before adding new one
document.querySelectorAll('.mapboxgl-popup').forEach(p => p.remove());

  const popupHTML = `
    <div style="border: 1px solid #ccc; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: sans-serif; min-width: 240px;">
      <div style="background-color: #1f78b4; color: white; padding: 10px; font-size: 16px; font-weight: bold;">
        ${props.School}
      </div>
      <div style="padding: 10px; background-color: #fff;">

        <div><strong>Program Capacity:</strong> ${props['Program Capacity'] || 'N/A'}</div>
        <div><strong>Room Capacity:</strong> ${props['Room Capacity'] || 'N/A'}</div>
        <div><strong>Walk Score:</strong> ${props['Walk Score'] || 'N/A'}</div>
        <div><strong>Transit Score:</strong> ${props['Transit Score'] || 'N/A'}</div>
        <div><strong>Building Experience Score:</strong> ${props['Building Experience Score'] || 'N/A'}</div>
        <div><strong>EAQ Score:</strong> ${props['EAQ Score'] || 'N/A'}</div>
      </div>
    </div>
  `;
  map.on('mouseenter', 'schools-layer', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'schools-layer', () => map.getCanvas().style.cursor = '');
  
  new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(popupHTML)
    .addTo(map);

   // Load All Schools for Relocate Dropdown

// ✅ Debounce function to limit rapid event firing
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

 
});

function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  return function(...args) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function() {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}


  // Layer for added locations
  map.addSource('added-points', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  map.addLayer({
    id: 'added-layer',
    type: 'circle',
    source: 'added-points',
    paint: {
      'circle-radius': 4,
      'circle-color': '#2ecc71',
      'circle-stroke-color': '#145a32',
      'circle-stroke-width': 2
    }
  });

  // Layer for closed schools
  map.addSource('closed-points', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  map.addLayer({
    id: 'closed-layer',
    type: 'circle',
    source: 'closed-points',
    paint: {
      'circle-radius': 6,
      'circle-color': '#bbbbbb',
      'circle-stroke-color': '#000000',
      'circle-stroke-width': 1.5
    }
  });
  let studentsVisible = false;

  const studentRes = await fetch('BPS_Students.geojson');
  const studentData = await studentRes.json();
  
  map.addSource('students', {
    type: 'geojson',
    data: studentData
  });
  
  map.addLayer({
    id: 'students-layer',
    type: 'fill-extrusion',
    source: 'students',
    paint: {
      'fill-extrusion-color': '#ffffff',
      'fill-extrusion-opacity': 0.5, // nearly invisible
      'fill-extrusion-height': ['*', ['get', 'JOIN_COUNT'], 3],
      'fill-extrusion-base': 0
    },
    layout: {
      visibility: 'none'
    }
    
  });
  
  console.log(map.getLayer('students-layer'));

  document.getElementById('students-btn').onclick = () => {
    studentsVisible = !studentsVisible;
    map.setLayoutProperty('students-layer', 'visibility', studentsVisible ? 'visible' : 'none');
    document.getElementById('students-btn').innerText = studentsVisible ? 'Hide Students' : 'Show Students';
  };
  let allSchoolsVisible = false;

// Load All Schools GeoJSON
const allSchoolsRes = await fetch('BPS_AllSchools.geojson');
const allSchoolsData = await allSchoolsRes.json();
allSchools = allSchoolsData.features; 

try {
  const altSchoolRes = await fetch('BPS_AltSchools.geojson');
  if (!altSchoolRes.ok) {
    throw new Error(`HTTP error! status: ${altSchoolRes.status}`);
  }
  
  const altSchoolData = await altSchoolRes.json();
  allAltSchools = altSchoolData.features;

  // ✅ Debugging Logs
  console.log("✅ Successfully fetched BPS_AltSchools.geojson");
  console.log("Number of Schools Loaded:", allAltSchools.length);

  // ✅ Call `updateChart()` only if the data is loaded
  if (allAltSchools && allAltSchools.length > 0) {
    console.log("🔄 Running updateChart()");
    updateChart();
  } else {
    console.warn("⚠️ No schools loaded from BPS_AltSchools.geojson.");
  }

} catch (error) {
  console.error("❌ Failed to fetch BPS_AltSchools.geojson:", error);
}



map.addSource('all-schools', {
  type: 'geojson',
  data: allSchoolsData
});

map.addLayer({
  id: 'all-schools-layer',
  type: 'circle',
  source: 'all-schools',
  paint: {
    'circle-radius': 5, // Set the default size
    'circle-color': [
      'match',
      ['get', 'School Type'],
      'Elementary', '#ffffff', // White for Elementary
      'Secondary', '#ff9933',  // Orange for Secondary
      'ELC', '#ffffff',        // Teal for ELC
      '#cccccc'                // Default grey if it doesn't match
    ],
    'circle-stroke-color': '#333333',
    'circle-stroke-width': 1
  },
  layout: {
    visibility: 'none' // ✅ Changed to visible for testing
  }
});


// ✅ Populate search dropdown from SCH_LABEL field
const schoolList = document.getElementById('school-list');
allSchoolsData.features.forEach(f => {
  const label = f.properties.SCH_LABEL;
  
  if (label) {
    const option = document.createElement('option');
    option.value = label;
    schoolList.appendChild(option);
  }
 
});

// ✅ Handle search selection
document.getElementById('school-search').addEventListener('change', function () {
  const selectedName = this.value;
  const match = allSchoolsData.features.find(f => f.properties.SCH_LABEL === selectedName);
  if (match) {
    const coords = match.geometry.coordinates;
    map.flyTo({ center: coords, zoom: 15 });
    new mapboxgl.Popup()
      .setLngLat(coords)
      .setHTML(`<strong>${match.properties.SCH_LABEL}</strong>`)
      .addTo(map);
  }
});

// Add basic popup
map.on('click', 'all-schools-layer', (e) => {
  const props = e.features[0].properties;

  const popupHTML = `
    <div style="border: 1px solid #ccc; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: sans-serif; min-width: 240px;">
      <div style="background-color: #34495e; color: white; padding: 10px; font-size: 16px; font-weight: bold;">
        ${props['SCH_NAME'] || 'School'}
      </div>
      <div style="padding: 10px; background-color: #fff;">
        <div><strong>Type:</strong> ${props['SCH_TYPE'] || 'N/A'}</div>
        <div><strong>Experience Score:</strong> ${props['Building Experience Score'] || 'N/A'}</div>
        <div><strong>Enrollment:</strong> ${props['Enrollment'] || 'N/A'}</div>
        <div><strong>Capacity:</strong> ${props['Current Capacity'] || 'N/A'}</div>
        <div><strong>Utilization %:</strong> ${props['Utilization %'] || 'N/A'}</div>
        <div><strong>Model Space:</strong> ${props['Model Space Summary'] || 'N/A'}</div>
      </div>
    </div>
  `;

  new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(popupHTML)
    .addTo(map);
});

// Load MBTA GeoJSON
const mbtaLineRes = await fetch('MBTA_Line.geojson');
const mbtaLineData = await mbtaLineRes.json();

const mbtaStopsRes = await fetch('MBTA_Stops.geojson');
const mbtaStopsData = await mbtaStopsRes.json();

// Add Line Source
map.addSource('mbta-lines', {
  type: 'geojson',
  data: mbtaLineData
});

// Add Stops Source
map.addSource('mbta-stops', {
  type: 'geojson',
  data: mbtaStopsData
});

// Add Line Layer with Coloring Logic
map.addLayer({
  id: 'mbta-lines-layer',
  type: 'line',
  source: 'mbta-lines',
  layout: {
    'line-join': 'round',
    'line-cap': 'round'
  },
  paint: {
    'line-width': 3,
    'line-color': [
      'match',
      ['get', 'LINE'], // <-- Matching based on the "LINE" field
      'RED', '#ff4d4d',
      'ORANGE', '#ff9933',
      'GREEN', '#4dff88',
      'SILVER', '#b3b3b3',
      'BLUE', '#4d79ff',
      '#000000' // Default color if it doesn't match
    ]
  },
  layout: {
    visibility: 'none' // Initially hidden
  }
});


// Add Stop Layer
map.addLayer({
  id: 'mbta-stops-layer',
  type: 'circle',
  source: 'mbta-stops',
  paint: {
    'circle-radius': 4,
    'circle-color': '#708090',
    'circle-stroke-color': '#333333',
    'circle-stroke-width': 1
  },
  layout: {
    visibility: 'none' // Initially hidden
  }
});

// Toggle Logic
let transitVisible = false;

document.getElementById('transit-btn').onclick = () => {
  transitVisible = !transitVisible;

  // Toggle layers visibility
  map.setLayoutProperty('mbta-lines-layer', 'visibility', transitVisible ? 'visible' : 'none');
  map.setLayoutProperty('mbta-stops-layer', 'visibility', transitVisible ? 'visible' : 'none');

  // Update button text
  document.getElementById('transit-btn').innerText = transitVisible ? 'Hide Transit' : 'Show Transit';
};

map.on('mouseenter', 'all-schools-layer', () => map.getCanvas().style.cursor = 'pointer');
map.on('mouseleave', 'all-schools-layer', () => map.getCanvas().style.cursor = '');

// ✅ Toggle all schools layer visibility
document.getElementById('allschools-btn').onclick = () => {
  allSchoolsVisible = !allSchoolsVisible;
  map.setLayoutProperty('all-schools-layer', 'visibility', allSchoolsVisible ? 'visible' : 'none');
  document.getElementById('allschools-btn').innerText = allSchoolsVisible ? 'Hide All Schools' : 'Show All Schools';
};

  // Populate UI
  populateActionPanel();
});

function populateActionPanel() {
  const actionsDiv = document.getElementById('actions');
  actionsDiv.innerHTML = ''; // Clear existing content

  for (let i = 0; i < 4; i++) {
    const row = document.createElement('div');

    // School dropdown
   // "Select School" dropdown populated from BPS_AltSchools.geojson
const selectSchool = document.createElement('select');
selectSchool.className = 'school-select';
selectSchool.innerHTML = '<option value="">-- Select School --</option>';

allAltSchools.forEach(f => {
  const name = f.properties.School || f.properties.school_name || f.id; // Use SCH_LABEL
  selectSchool.innerHTML += `<option value="${name}">${name}</option>`;
});


    // Toggle row for action (Maintain, Close, Relocate)
    const toggleRow = document.createElement('div');
    toggleRow.className = 'toggle-row';
    toggleRow.innerHTML = `
      <label style="margin-left: 0;">
        <input type="radio" name="action-${i}" value="maintain" checked> Maintain
      </label>
      <label style="margin-left: 8px;">
        <input type="radio" name="action-${i}" value="close"> Close
      </label>
      <label style="margin-left: 8px;">
        <input type="radio" name="action-${i}" value="relocate"> Relocate
      </label>
      <select class="relocate-select" data-index="${i}" style="display:none; margin-left: 8px;">
        <option value="">-- Select New Site --</option>
      </select>
    `;

    // Handle "Relocate" radio button selection
    toggleRow.querySelectorAll('input[name="action-' + i + '"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const relocateSelect = toggleRow.querySelector('.relocate-select');
        if (radio.value === 'relocate' && radio.checked) {
          relocateSelect.style.display = 'inline-block';  // Show dropdown when 'Relocate' is selected
          
          // ✅ Clear previous options
          relocateSelect.innerHTML = '<option value="">-- Select New Site --</option>';
    
          // ✅ Sort the schools alphabetically by 'SCH_LABEL'
          const sortedSchools = [...allSchools].sort((a, b) =>
            a.properties.SCH_LABEL.localeCompare(b.properties.SCH_LABEL)
          );
    
          // ✅ Populate the dropdown with schools
          sortedSchools.forEach(f => {
            const label = f.properties.SCH_LABEL;  // Use SCH_LABEL to populate the dropdown
            if (label) {
              const option = document.createElement('option');
              option.value = label;  // Set the value to SCH_LABEL
              option.textContent = label;  // Display SCH_LABEL in the dropdown
              relocateSelect.appendChild(option);
            }
          });
        } else {
          relocateSelect.style.display = 'none';  // Hide dropdown when other options are selected
        }
      });
    });
    
    row.appendChild(selectSchool);  // Add the school dropdown to the row
    row.appendChild(toggleRow);     // Add the toggle actions row to the row
    actionsDiv.appendChild(row);    // Add the row to the actions div
  }

  // Handle the chart toggle change event
  document.querySelectorAll('input[name="chart-toggle"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const selectedChart = e.target.value;

      if (chart) {
        chart.destroy();
        chart = null;
      }

      if (selectedChart === 'capacity') {
        updateChart();
      } else if (selectedChart === 'covered') {
        updateCoveredChart(clippedIsochrones, boundary);
      } else if (selectedChart === 'students') {
        updateStudentChart(clippedIsochrones);
      }
    });
  });
}
  
// Close the populateActionPanel function


  
// Add new location on map
document.getElementById('add-location-btn').onclick = () => {
  addingPoint = true;
  alert('Click the map to add a new location');
};

map.on('click', (e) => {
  if (addingPoint) {
    const pt = turf.point([e.lngLat.lng, e.lngLat.lat], { name: 'New Location' });
    addedPoints.push(pt);
    map.getSource('added-points').setData({
      type: 'FeatureCollection',
      features: addedPoints
    });
    addingPoint = false;
    alert('New location added');
  }
});
function refreshIsochroneCharts() {
  console.log("🔄 [refreshIsochroneCharts] Triggered - Fetching latest isochrone data...");

  // 🛠️ Get the actual data from the Mapbox source
  const isochroneSource = map.getSource('isochrones');
  
  if (!isochroneSource) {
    console.warn("⚠️ [refreshIsochroneCharts] Isochrone source not found!");
    return;
  }

  // ✅ Get the live data from Mapbox
  clippedIsochrones = isochroneSource._data.features;

  if (clippedIsochrones.length === 0) {
    console.warn("⚠️ [refreshIsochroneCharts] No features found in isochrones.");
    return;
  }

  console.log("✅ [refreshIsochroneCharts] Found features:", clippedIsochrones.length);
  console.log(clippedIsochrones);

  // ✅ Now update the charts
  console.log("🔄 [refreshIsochroneCharts] Updating Coverage Chart...");
  updateCoveredChart(clippedIsochrones, boundary);

  console.log("🔄 [refreshIsochroneCharts] Updating Student Chart...");
  updateStudentChart(clippedIsochrones);
}

document.getElementById('run-btn').onclick = async () => {
  const closedNames = new Set();
  const relocateNames = new Set();
  const schoolSelects = document.querySelectorAll('.school-select');
  const relocateSelects = document.querySelectorAll('.relocate-select');
  isScenarioRunning = true; // 🔄 Enable the flag
  

  // Clear out previous closed and relocated points
  const closedFeatures = [];
  addedPoints = addedPoints.filter(pt => pt.properties.name !== 'Relocated'); // Keep only manually added

  // 🔹 Loop through all action panel selections
  for (let i = 0; i < schoolSelects.length; i++) {
    const school = schoolSelects[i].value;
    const action = document.querySelector(`input[name="action-${i}"]:checked`);

    if (school && action) {
      if (action.value === 'close') {
        closedNames.add(school);
      }
      if (action.value === 'relocate') {
        const newSite = relocateSelects[i].value;
        relocateNames.add(school);

        // ✅ Find the coordinates of the new relocation site
        if (newSite) {
          const match = allSchools.find(f => f.properties.SCH_LABEL === newSite);

          if (match) {
            const coordinates = match.geometry.coordinates;
            const newPoint = turf.point(coordinates, {
              name: 'Relocated',
              color: '#2ecc71' // Green color
            });
            addedPoints.push(newPoint); // Only add the relocated point
          }
        }
      }
    }
  }

  // ✅ Filter out the matching features for 'close' and 'relocate'
  allAltSchools.forEach((school) => {
    if (closedNames.has(school.properties.School) || relocateNames.has(school.properties.School)) {
      closedFeatures.push(school);
    }
  });

  // ✅ Update the closed-points source with the red dots
  if (map.getSource('closed-points')) {
    map.getSource('closed-points').setData({
      type: 'FeatureCollection',
      features: closedFeatures
    });
  } else {
    map.addSource('closed-points', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: closedFeatures
      }
    });
// ✅ Update the closed-points source with the red dots
if (map.getSource('closed-points')) {
  map.getSource('closed-points').setData({
    type: 'FeatureCollection',
    features: closedFeatures
  });
// ➡️ After you add the 'isochrones' source to the map:
map.addSource('isochrones', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: clippedIsochrones }
});

map.on('sourcedata', throttle((e) => {
  if (
    e.sourceId === 'isochrones' &&
    e.isSourceLoaded &&
    map.getLayoutProperty('iso-layer', 'visibility') === 'visible'
  ) {
    console.log("🔄 [Mapbox Event] Isochrones source updated on the map.");
    refreshIsochroneCharts();
  }
}, 1000)); // 1000ms (1 second) throttle delay



    // ✅ Trigger chart updates after isochrone generation
    updateChart();                          // Adjusted capacity and enrollment
    updateCoveredChart(clippedIsochrones, boundary); // Coverage analysis
    updateStudentChart(clippedIsochrones);           // Student analysis
  };
  


    // ✅ Add a red circle for closed points (only once)
    map.addLayer({
      id: 'closed-layer',
      type: 'circle',
      source: 'closed-points',
      paint: {
        'circle-radius': 6,
        'circle-color': '#bbbbbb',
        'circle-stroke-color': '#333333',
        'circle-stroke-width': 1
      }
    });
  }

  // ✅ Ensure added-points are updated too
  map.getSource('added-points').setData({
    type: 'FeatureCollection',
    features: addedPoints
  });

  // ✅ Get all Active Schools (BPS_AltSchools minus the closed and relocated ones)
  const activeSchools = allAltSchools.filter(f =>
    !closedNames.has(f.properties.School) && !relocateNames.has(f.properties.School)

  );

  // ✅ Combine all points: Active Schools + Manually Added + Relocated
  const allPoints = activeSchools.map(f =>
    turf.point(f.geometry.coordinates, f.properties)
  ).concat(addedPoints);

  // ✅ Clear previous isochrone layers safely
  if (map.getLayer('iso-layer')) map.removeLayer('iso-layer');
  if (map.getSource('isochrones')) map.removeSource('isochrones');

  // ✅ Run isochrone analysis for all active schools + relocated + manually added points
  const isoFeatures = [];

  for (const pt of allPoints) {
    const coords = pt.geometry.coordinates;
    try {
      const res = await fetch(`https://api.mapbox.com/isochrone/v1/mapbox/driving/${coords[0]},${coords[1]}?contours_meters=1609,4828,8046&polygons=true&access_token=${mapboxgl.accessToken}`);
      const data = await res.json();

      if (data && data.features && data.features.length > 0) {
        data.features.forEach(f => {
          isoFeatures.push(f);
        });
      }
    } catch (err) {
      console.error('Isochrone fetch error:', err);
    }
  }

  // ✅ Sort the isochrones to make sure smaller radii are on top
  isoFeatures.sort((a, b) => {
    const order = { '1609': 3, '4828': 2, '8046': 1 };
    return order[a.properties.contour] - order[b.properties.contour];
  });

  // ✅ Clip Isochrones to Boundary
  clippedIsochrones = [];
  const boundaryFeatures = boundary.type === 'FeatureCollection' ? boundary.features : [boundary];

  isoFeatures.forEach(iso => {
    boundaryFeatures.forEach(boundaryFeature => {
      const clipped = turf.intersect(iso, boundaryFeature);
      if (clipped) {
        clipped.properties = { ...iso.properties };
        clippedIsochrones.push(clipped);
      }
      // ✅ Update the charts with the new clipped isochrones and boundary

    });
  });

  // ✅ Add the isochrone layer back to the map
  // ➡️ After you add the 'isochrones' source to the map:
map.addSource('isochrones', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: clippedIsochrones }
});

// ⬇️⬇️ ADD THE LISTENER HERE ⬇️⬇️
map.on('sourcedata', (e) => {
  if (e.sourceId === 'isochrones' && e.isSourceLoaded) {
    console.log("🔄 [Mapbox Event] Isochrones source updated on the map.");
    refreshIsochroneCharts();
  }
});

  if (!map.getLayer('iso-layer')) {
    map.addLayer({
      id: 'iso-layer',
      type: 'fill',
      source: 'isochrones',
      paint: {
        'fill-color': ['match', ['get', 'contour'],
          1609, '#2ecc71',
          4828, '#f1c40f',
          8046, '#c0392b',
          '#ccc'
        ],
        'fill-opacity': 0.7
      }
    }, 'boundary-outline');
  }
};

let isochronesVisible = true; // Default is visible

document.getElementById('isochrones-btn').onclick = () => {
  isochronesVisible = !isochronesVisible;

  if (map.getLayer('iso-layer')) {
    map.setLayoutProperty('iso-layer', 'visibility', isochronesVisible ? 'visible' : 'none');
  }

  document.getElementById('isochrones-btn').innerText = isochronesVisible ? 'Hide Isochrones' : 'Show Isochrones';
};


 // ⬅ Add BEFORE the boundary outline layer
 // 👈 insert below point markers
 // ✅ Call chart update here
// ✅ Call the correct chart based on selected toggle
const selectedChart = document.querySelector('input[name="chart-toggle"]:checked').value;
if (selectedChart === 'capacity') {
  updateChart();
} else if (selectedChart === 'covered') {
  updateCoveredChart(clippedIsochrones, boundary);
} else if (selectedChart === 'students') {
  updateStudentChart(clippedIsochrones);
}


function updateChart() {
  // 🛠️ Ensure allAltSchools is loaded before running
  if (!allAltSchools || allAltSchools.length === 0) {
    console.warn("⚠️ allAltSchools is not loaded yet. Skipping chart update.");
    return;
  }

  console.log("🔄 Updating Chart with allAltSchools data");

  const enrollmentTotal = allAltSchools.reduce((sum, f) => sum + (f.properties.Enrollment || 0), 0);
  const totalCapacity = allAltSchools.reduce((sum, f) => sum + (f.properties['Room Capacity'] || 0), 0);

  const closedNames = new Set();
  const schoolSelects = document.querySelectorAll('.school-select');
  const toggleSwitches = document.querySelectorAll('.action-toggle');
  for (let i = 0; i < schoolSelects.length; i++) {
    if (schoolSelects[i].value && toggleSwitches[i].checked) {
      closedNames.add(schoolSelects[i].value);
    }
  }

  const openCapacity = allAltSchools
    .filter(f => !closedNames.has(f.properties.School))
    .reduce((sum, f) => sum + (f.properties['Room Capacity'] || 0), 0);

  console.log("📊 Enrollment Total:", enrollmentTotal);
  console.log("📊 Total Capacity:", totalCapacity);
  console.log("📊 Open Capacity:", openCapacity);

  const data = {
    labels: ['Enrollment', 'Total Capacity', 'Adjusted Capacity'],
    datasets: [{
      label: 'Student Count',
      data: [enrollmentTotal, totalCapacity, openCapacity],
      backgroundColor: ['#1e90ff', '#ba55d3', '#ff6347']
    }]
  };

  const config = {
    type: 'bar',
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
        title: {
          display: true,
          text: 'Enrollment and Capacity'
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  };

  if (chart) {
    chart.data = data;
    chart.update();
  } else {
    const ctx = document.getElementById('capacityChart').getContext('2d');
    chart = new Chart(ctx, config);
  }
}

function updateCoveredChart(clippedIsochrones, boundary) {
  console.log("🛰️ Running updateCoveredChart...");
  console.log("📌 Clipped Isochrones Provided: ", clippedIsochrones);
  console.log("📌 Boundary Provided: ", boundary);

  if (clippedIsochrones.length === 0) {
    console.warn("⚠️ No clipped isochrones found. Chart will not populate.");
    return;
  }

  const totalArea = boundary.features
    .map(f => turf.area(f))
    .reduce((sum, a) => sum + a, 0);

  const bands = { '1609': 0, '4828': 0, '8046': 0 };
  const grouped = { '1609': [], '4828': [], '8046': [] };

  clippedIsochrones.forEach(f => {
    const contour = f.properties.contour.toString();
    if (grouped[contour]) grouped[contour].push(f);
  });

  Object.keys(grouped).forEach(contour => {
    if (grouped[contour].length > 0) {
      const unioned = grouped[contour].reduce((acc, curr) => {
        return acc ? turf.union(acc, curr) : curr;
      }, null);
      if (unioned) {
        bands[contour] = turf.area(unioned);
        console.log(`✅ Area for ${contour}: ${bands[contour]}`);
      } else {
        console.warn(`⚠️ Failed to union isochrones for contour ${contour}`);
      }
    }
  });

  const coveredPercents = [
    Math.min(100, (bands['1609'] / totalArea) * 100),
    Math.min(100, (bands['4828'] / totalArea) * 100),
    Math.min(100, (bands['8046'] / totalArea) * 100)
  ];

  console.log("✅ Covered Percentages: ", coveredPercents);

  const data = {
    labels: ['1 mi', '3 mi', '5 mi'],
    datasets: [{
      label: '% of Area Covered',
      data: coveredPercents,
      backgroundColor: ['#2ecc71', '#f1c40f', '#c0392b']
    }]
  };

  const config = {
    type: 'bar',
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: '% of Boundary Area Covered by Distance Band'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: value => value + "%" }
        }
      }
    }
  };

  const ctx = document.getElementById('capacityChart').getContext('2d');
  if (chart) {
    chart.destroy(); // important to destroy previous chart
  }
  chart = new Chart(ctx, config);
}



function updateStudentChart(clippedIsochrones) {
  // Get centroids of student polygons
  const centroids = [];
  map.getSource('students')._data.features.forEach(f => {
    const center = turf.centroid(f);
    const count = f.properties['JOIN_COUNT'] || 0;
    centroids.push({ point: center, count });
  });

  const bands = { '1609': 0, '4828': 0, '8046': 0 };
  let total = 0;

  centroids.forEach(({ point, count }) => {
    total += count;
    
    // Sort contours from smallest to largest
    const ordered = clippedIsochrones
      .slice()
      .sort((a, b) => a.properties.contour - b.properties.contour);
  
    for (const iso of ordered) {
      if (turf.booleanPointInPolygon(point, iso)) {
        bands[iso.properties.contour] += count;
        break; // assign to smallest enclosing band
      }
    }
  });
  

  const percents = [
    Math.round((bands['1609'] / total) * 100),
    Math.round((bands['4828'] / total) * 100),
    Math.round((bands['8046'] / total) * 100)
  ];

  const data = {
    labels: ['1 mi', '3 mi', '5 mi'],
    datasets: [{
      label: '% of Students Covered',
      data: percents,
      backgroundColor: ['#2ecc71', '#f1c40f', '#c0392b']

    }]
  };

  const config = {
    type: 'bar',
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: '% of Students Within Each Travel Distance Band'
        }
      },
      
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } }
      }
    }
  };

  const ctx = document.getElementById('capacityChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, config);
}