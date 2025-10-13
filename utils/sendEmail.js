const nodemailer = require('nodemailer');

let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // The app password generated above
    },
});
  
const sendEmailConfirmation = async (email, subject, message) => {

    const mailOptions = {
      from: `Your App <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      text: message,
    };
      
    const result = await transporter.sendMail(mailOptions);
    return result;
};

module.exports = sendEmailConfirmation;