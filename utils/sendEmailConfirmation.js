const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const nodemailer = require("nodemailer");

let transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: "feze2013@hotmail.com", // Your Hotmail email
    pass: process.env.EMAIL_PASS, // The app password generated above
  },
});

const sendEmailConfirmation = async (email, token) => {
  const confirmUrl = `${process.env.BASE_URL}/confirm-email-change?token=${token}`;

  const response = await transporter.sendMail({
    from: `<${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Confirm your new email",
    html: `<p>Please click the link below to confirm your new email:</p><a href="${confirmUrl}">Confirm Email Change</a>`,
  });
  console.log(response);
};

module.exports = sendEmailConfirmation;

module.exports = sendEmailConfirmation;
