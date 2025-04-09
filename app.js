const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const twilio = require("twilio");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();


const allowedOrigins = [
  'https://www.futureittouch.com',
  'https://himanshu.futuretouch.org'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
const PORT = process.env.PORT || 3000;

const client = twilio(accountSid, authToken);


const otpAttempts = {};


app.post("/send-otp", async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    if (!otpAttempts[phone]) {
        otpAttempts[phone] = { count: 0, lastSent: null };
    }

    const attemptData = otpAttempts[phone];
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (attemptData.lastSent && now - attemptData.lastSent > ONE_DAY) {
        attemptData.count = 0;
    }

    if (attemptData.count >= 3) {
        return res.status(429).json({ success: false, message: "You have exceeded the maximum OTP attempts for today." });
    }

    try {
        const verification = await client.verify.services(verifyServiceSid)
            .verifications.create({ to: phone, channel: "sms" });

        attemptData.count++;
        attemptData.lastSent = now;

        res.status(200).json({ success: true, message: "OTP sent successfully!", sid: verification.sid });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to send OTP.", error: error.message });
    }
});


app.post("/verify-otp", async (req, res) => {
    const { phone, code } = req.body;

    if (!phone || !code) {
        return res.status(400).json({ success: false, message: "Phone number and OTP code are required." });
    }

    try {
        const verificationCheck = await client.verify.services(verifyServiceSid)
            .verificationChecks.create({ to: phone, code });

        if (verificationCheck.status === "approved") {
            res.status(200).json({ success: true, message: "OTP verified successfully!" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP." });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "OTP verification failed.", error: error.message });
    }
});


let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, 
    },
});


app.post("/sendmail", async (req, res) => {
    try {
        const { 
            doctor_name, visaType,S_phone, S_name, S_last, phone, S_email, 
            Location_form, Location_to, moving_from_country, moving_to_country, 
            Location_to_state, Location_form_state, moving_form_state, moving_to_state, 
            message, service_type, userEmailsir, userEmailsir2, user_email, S_services 
        } = req.body;

        let htmlBody = `
            ${doctor_name ? `<p><strong>Doctor:</strong> ${doctor_name}</p>` : ""}
            ${S_name ? `<p><strong>First Name:</strong> ${S_name}</p>` : ""}
            ${S_last ? `<p><strong>Last Name:</strong> ${S_last}</p>` : ""}
            ${S_phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
            ${S_email ? `<p><strong>Email:</strong> ${S_email}</p>` : ""}
            ${visaType ? `<p><strong>Visa Type:</strong> ${visaType}</p>` : ""}
            ${S_services ? `<p><strong>Service:</strong> ${S_services}</p>` : ""}
            ${service_type ? `<p><strong>Service Type:</strong> ${service_type}</p>` : ""}
            ${Location_form ? `<p><strong>Location From:</strong> ${Location_form}</p>` : ""}
            ${Location_to ? `<p><strong>Location To:</strong> ${Location_to}</p>` : ""}
            ${moving_from_country ? `<p><strong>Moving From Country:</strong> ${moving_from_country}</p>` : ""}
            ${moving_to_country ? `<p><strong>Moving To Country:</strong> ${moving_to_country}</p>` : ""}
            ${Location_form_state ? `<p><strong>Location From State:</strong> ${Location_form_state}</p>` : ""}
            ${Location_to_state ? `<p><strong>Location To State:</strong> ${Location_to_state}</p>` : ""}
            ${moving_form_state ? `<p><strong>Moving From State:</strong> ${moving_form_state}</p>` : ""}
            ${moving_to_state ? `<p><strong>Moving To State:</strong> ${moving_to_state}</p>` : ""}
            ${message ? `<p><strong>Message:</strong> ${message}</p>` : ""}
        `;

        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: [userEmailsir || "moveitsolutionpackers@gmail.com", userEmailsir2, user_email].filter(Boolean), 
            subject: "Appointment Booking",
            html: htmlBody,
        };


        console.log(req.body)

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return res.status(500).json({ success: false, message: "Error sending email", error: error.message });
            }

            res.status(200).json({ success: true, message: "Email sent successfully!", info: info.response });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error processing request", error: error.message });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
