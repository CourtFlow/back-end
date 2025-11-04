const mongoose = require('mongoose')

const bookingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  bookingChannel: {
    type: String,
    required: true
  },
  bookingDate: {
    type: Date,
    required: true,
    default: Date.now
  }
})

module.exports = mongoose.model('BOOKING', bookingSchema)