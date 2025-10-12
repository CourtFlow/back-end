const express = require('express')
const passport = require('passport')
const router = express.Router()

// @desc Auth with google
// @route GET /auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile'] }))

// @desc Google auth callback
// @route GET /auth/google/callback
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }), 
  (req, res) => {
    res.json({
        message: 'Google authentication successful!',
        user: req.user, // Passport attaches the authenticated user here
      })
  }
)

module.exports = router
