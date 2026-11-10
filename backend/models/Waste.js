const mongoose = require("mongoose");

const wasteSchema = new mongoose.Schema({
  type: String,
  weight: Number,
  location: String
});

module.exports = mongoose.model("Waste", wasteSchema);