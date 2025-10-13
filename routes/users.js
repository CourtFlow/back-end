const express = require("express");
const { updateUser } = require("../controllers/auth");
const router = express.Router({ mergeParams: true });
const { protect, authorize } = require("../middleware/auth");

router.route("/").put(protect, authorize("admin", "user"), updateUser);

module.exports = router;
