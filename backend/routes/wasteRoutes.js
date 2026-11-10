const express = require("express");
const router = express.Router();
const Waste = require("../models/Waste");

// GET ALL
router.get("/", async (req, res) => {
  const data = await Waste.find();
  res.json(data);
});

// ADD
router.post("/", async (req, res) => {
  const newWaste = new Waste(req.body);
  await newWaste.save();
  res.json(newWaste);
});

// DELETE
router.delete("/:id", async (req, res) => {
  await Waste.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;