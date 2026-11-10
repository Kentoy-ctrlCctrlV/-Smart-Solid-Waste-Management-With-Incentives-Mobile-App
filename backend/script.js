let wasteList = [];

function addWaste() {
  const type = document.getElementById("wasteType").value;
  const weight = document.getElementById("weight").value;
  const location = document.getElementById("location").value;

  if (!type || !weight || !location) {
    alert("Please fill all fields!");
    return;
  }

  const waste = {
    type,
    weight,
    location
  };

  wasteList.push(waste);
  displayWaste();

  // clear inputs
  document.getElementById("wasteType").value = "";
  document.getElementById("weight").value = "";
  document.getElementById("location").value = "";
}

function displayWaste() {
  const recordsDiv = document.getElementById("records");

  recordsDiv.innerHTML = "";

  wasteList.forEach((waste, index) => {
    recordsDiv.innerHTML += `
      <div class="record">
        <p><strong>Type:</strong> ${waste.type}</p>
        <p><strong>Weight:</strong> ${waste.weight} kg</p>
        <p><strong>Location:</strong> ${waste.location}</p>
        <hr>
      </div>
    `;
  });
}