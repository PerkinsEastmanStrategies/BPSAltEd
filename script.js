mapboxgl.accessToken = 'pk.eyJ1IjoicGF0d2QwNSIsImEiOiJjbTZ2bGVhajIwMTlvMnFwc2owa3BxZHRoIn0.moDNfqMUolnHphdwsIF87w';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-71.0589, 42.3601],
  zoom: 11
});

let boundary = null;
let allSchools = [];
let addedPoints = [];
let addingPoint = false;
let chart; // reference to Chart.js instance
let trimmedIsochrones = []; // Make this global



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
      'circle-radius': 6,
      'circle-color': '#e74c3c',
      'circle-stroke-color': '#c0392b',
      'circle-stroke-width': 2
    }
    
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

        <div><strong>Program Capacity:</strong> ${props['Program Capcity'] || 'N/A'}</div>
        <div><strong>Room Capacity:</strong> ${props['Room Capacity'] || 'N/A'}</div>
        <div><strong>Walk Score:</strong> ${props['Walk Score'] || 'N/A'}</div>
        <div><strong>Transit Score:</strong> ${props['Transit Score'] || 'N/A'}</div>
        <div><strong>Student Experience Score:</strong> ${props['Student Experience Score'] || 'N/A'}</div>
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


 
});

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
      'circle-radius': 7,
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

// Load BPS_AltSchools.geojson for the "Select School" dropdown
const altSchoolRes = await fetch('BPS_AltSchools.geojson');
const altSchoolData = await altSchoolRes.json();
allAltSchools = altSchoolData.features;


map.addSource('all-schools', {
  type: 'geojson',
  data: allSchoolsData
});

map.addLayer({
  id: 'all-schools-layer',
  type: 'circle',
  source: 'all-schools',
  paint: {
    'circle-radius': 4,
    'circle-color': '#ffffff',
    'circle-stroke-color': '#000000',
    'circle-stroke-width': 1
  },
  layout: {
    visibility: 'none' // initially hidden
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
          
          // Populate the dropdown with schools from BPS_AllSchools.geojson
          relocateSelect.innerHTML = '<option value="">-- Select New Site --</option>';  // Clear previous options
          allSchools.forEach(f => {
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
        updateCoveredChart(trimmedIsochrones, boundary);
      } else if (selectedChart === 'students') {
        updateStudentChart(trimmedIsochrones);
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

// Run isochrone analysis
document.getElementById('run-btn').onclick = async () => {
  const closedNames = new Set();
  const schoolSelects = document.querySelectorAll('.school-select');
  const actionSelects = document.querySelectorAll('.action-select');

  for (let i = 0; i < schoolSelects.length; i++) {
    const school = schoolSelects[i].value;
    const action = document.querySelector(`input[name="action-${i}"]:checked`);
    if (school && action && (action.value === 'close' || action.value === 'relocate')) {
      closedNames.add(school);
    }
  }

  const closed = allAltSchools.filter(f =>
    closedNames.has(f.properties.School)
  );
  const active = allAltSchools.filter(f =>
    !closedNames.has(f.properties.School)
  );

  // Update closed schools layer
  map.getSource('closed-points').setData({
    type: 'FeatureCollection',
    features: closed
  });

  const allPoints = active.map(f =>
    turf.point(f.geometry.coordinates, f.properties)
  ).concat(addedPoints);

  // Clean up any previous isochrone layer
  if (map.getLayer('iso-layer')) map.removeLayer('iso-layer');
  if (map.getSource('isochrones')) map.removeSource('isochrones');

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
        
      } else {
        console.warn('No isochrone features returned for point:', coords);
      }
    } catch (err) {
      console.error('Isochrone fetch error:', err);
    }
  }

 if (isoFeatures.length === 0) {
  alert('No isochrone contours could be generated.');
  return;
}

// Sort so shorter contours draw on top
isoFeatures.sort((a, b) => {
  const order = { 8046: 1, 4828: 2, 1609: 3 };
  return order[a.properties.contour] - order[b.properties.contour];
});

/// Normalize boundary into individual features
const boundaryFeatures = boundary.type === 'FeatureCollection'
? boundary.features
: [boundary];

// Clip each isochrone polygon against all boundary features
trimmedIsochrones.length = 0; // clear it
isoFeatures.forEach(iso => {
boundaryFeatures.forEach(b => {
  const clipped = turf.intersect(iso, b);
  if (clipped) {
    clipped.properties = { ...iso.properties }; // retain contour property
    trimmedIsochrones.push(clipped);
  }
});
});


// Update map source
map.addSource('isochrones', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: trimmedIsochrones }
});


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
}, 'boundary-outline'); // ⬅ Add BEFORE the boundary outline layer
 // 👈 insert below point markers
 // ✅ Call chart update here
// ✅ Call the correct chart based on selected toggle
const selectedChart = document.querySelector('input[name="chart-toggle"]:checked').value;
if (selectedChart === 'capacity') {
  updateChart();
} else if (selectedChart === 'covered') {
  updateCoveredChart(trimmedIsochrones, boundary);
} else if (selectedChart === 'students') {
  updateStudentChart(trimmedIsochrones);
}

};
function updateChart() {
  const enrollmentTotal = allSchools.reduce((sum, f) => sum + (f.properties.Enrollment || 0), 0);
  const totalCapacity = allSchools.reduce((sum, f) => sum + (f.properties['Room Capacity'] || 0), 0);

  const closedNames = new Set();
  const schoolSelects = document.querySelectorAll('.school-select');
  const toggleSwitches = document.querySelectorAll('.action-toggle');
  for (let i = 0; i < schoolSelects.length; i++) {
    if (schoolSelects[i].value && toggleSwitches[i].checked) {
      closedNames.add(schoolSelects[i].value);
    }
  }

  const openCapacity = allSchools
    .filter(f => !closedNames.has(f.properties.School))
    .reduce((sum, f) => sum + (f.properties['Room Capacity'] || 0), 0);

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
function updateCoveredChart(trimmedIsochrones, boundary) {
  const totalArea = boundary.features
  .map(f => turf.area(f))
  .reduce((sum, a) => sum + a, 0);

const bands = {
  '1609': 0,
  '4828': 0,
  '8046': 0
};

const grouped = { '1609': [], '4828': [], '8046': [] };

trimmedIsochrones.forEach(f => {
  const contour = f.properties.contour.toString();
  if (grouped[contour]) grouped[contour].push(f);
});


// Union and calculate area once per group
Object.keys(grouped).forEach(contour => {
  if (grouped[contour].length > 0) {
    const unioned = grouped[contour].reduce((acc, curr) => {
      return acc ? turf.union(acc, curr) : curr;
    }, null);
    bands[contour] = turf.area(unioned);
  }
});


const coveredPercents = [
  Math.min(100, (bands['1609'] / totalArea) * 100),
  Math.min(100, (bands['4828'] / totalArea) * 100),
  Math.min(100, (bands['8046'] / totalArea) * 100)
];


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


function updateStudentChart(trimmedIsochrones) {
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
    const ordered = trimmedIsochrones
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