const express = require("express");
const { register, login, getMe, logout, updateUser} = require("../controllers/auth");
const { protect, authorize } = require("../middleware/auth");
const { verifyEmail } = require("../controllers/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.get("/logout", logout);
router.get("/verify-email", verifyEmail);

router.route('/:id').put(protect, authorize("user", "admin"), updateUser);

module.exports = router;   
