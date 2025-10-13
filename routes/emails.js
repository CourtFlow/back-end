const express = require("express");
const { confirmEmailChange } = require("../controllers/emails");
const router = express.Router({ mergeParams: true });
const { protect, authorize } = require("../middleware/auth");

router.route("/").get(protect, authorize("admin", "user"), confirmEmailChange);

module.exports = router;
