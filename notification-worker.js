// notification-worker.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "config.env") });

const amqp = require("amqplib");

const RMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const QUEUE = process.env.RABBITMQ_QUEUE || "notifications";

(async () => {
  const conn = await amqp.connect(RMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: false });

  console.log(`👂 Notification worker waiting on "${QUEUE}" ...`);
  ch.consume(QUEUE, (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      console.log("🔔 [Notification]", data);
    } catch (e) {
      console.log("🔔 [Notification Raw]", msg.content.toString());
    }
    ch.ack(msg);
  });
})();

