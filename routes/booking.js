const express = require('express')
const router = express.Router()
const Booking = require('../models/booking')

// Getting all
router.get('/', async (req, res) => {
  try {
    const bookings = await Booking.find()
    res.json(bookings)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Getting One
router.get('/:id', getBooking, (req, res) => {
  res.json(res.booking)
})

// Creating one
router.post('/', async (req, res) => {
  const booking = new Booking({
    name: req.body.name,
    bookingChannel: req.body.bookingChannel,
    bookingDate: req.body.bookingDate
  })
  try {
    const newBooking = await booking.save()
    res.status(201).json(newBooking)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// Updating One
router.patch('/:id', getBooking, async (req, res) => {
  if (req.body.name != null) {
    res.booking.name = req.body.name
  }
  if (req.body.bookingChannel != null) {
    res.booking.bookingChannel = req.body.bookingChannel
  }
  if (req.body.bookingDate != null) {
    res.booking.bookingDate = req.body.bookingDate
  }
  try {
    const updatedBooking = await res.booking.save()
    res.json(updatedBooking)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// Deleting One
router.delete('/:id', getBooking, async (req, res) => {
  try {
    await res.booking.remove()
    res.json({ message: 'Deleted Booking' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

async function getBooking(req, res, next) {
  let booking
  try {
    booking = await Booking.findById(req.params.id)
    if (booking == null) {
      return res.status(404).json({ message: 'Cannot find booking' })
    }
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }

  res.booking = booking
  next()
}

module.exports = router