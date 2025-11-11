// utils/rabbitmq.js
const amqp = require("amqplib");

const RMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const QUEUE = process.env.RABBITMQ_QUEUE || "notifications";
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "notifications"; // fanout exchange

let _channel = null;

async function getChannel() {
  if (_channel) return _channel;
  const conn = await amqp.connect(RMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, "fanout", { durable: false });
  await ch.assertQueue(QUEUE, { durable: false });
  await ch.bindQueue(QUEUE, EXCHANGE, "");
  _channel = ch;
  console.log(`✅ RabbitMQ channel ready (exchange "${EXCHANGE}", queue "${QUEUE}")`);
  return _channel;
}

async function publishNotification(payload) {
  const ch = await getChannel();
  ch.publish(EXCHANGE, "", Buffer.from(JSON.stringify(payload)));
  if (process.env.NODE_ENV !== "test") {
    console.log("📨 Published to RabbitMQ:", payload);
  }
}

module.exports = { publishNotification, getChannel };
