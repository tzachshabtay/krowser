import express from "express";
import http from "http";
import path from "path";
import { Kafka, KafkaMessage } from "kafkajs";

type MessageInfo = { topic: string, partition: number, value: string, message: KafkaMessage }

const kafka = new Kafka({
	clientId: 'kafka-browser',
	brokers: ['localhost:9092']
})
const admin = kafka.admin()
const consumer = kafka.consumer({ groupId: `kafka-browser-${Date.now()}` })

const app = express();

app.set("view engine", "ejs");
app.set("views", "public");

console.log(__dirname)
app.use("/assets", express.static(path.join(__dirname, "../client")));

app.get("/", (req, res) => {
	res.render("index");
});

app.get("/topics", async (req, res) => {
	const topics = await admin.fetchTopicMetadata(undefined as any)
	res.status(200).json(topics)
})

app.get("/topic/:topic", async (req, res) => {
	const offsets = await admin.fetchTopicOffsets(req.params.topic)
	res.status(200).json(offsets)
})

app.get("/messages/:topic/:partition/", async (req, res) => {
	const limit = req.query.limit || 100
	const offset = req.query.offset || 0

	const messages: MessageInfo[] = []
	let numConsumed = 0
	console.log(`Querying topic ${req.params.topic} (partition ${req.params.partition}) at offset=${offset}, limit=${limit}`)
	consumer.subscribe({ topic: req.params.topic, fromBeginning: true })
	const p = new Promise<void>((resolve, reject) => {
		setTimeout(() => {
			reject("timeout")
		}, 5000);
		consumer.run({
			autoCommit: false,
			eachMessage: async ({ topic, partition, message }) => {
				console.log(`---MESSAGE: ${message.offset}---`)
				console.log({
					partition,
					offset: message.offset,
					value: message.value.toString(),
				})

				if (topic !== req.params.topic) {
					console.log(`Ignoring message from a different topic: ${topic} (expecting ${req.params.topic})`)
					return
				}

				if (parseInt(message.offset) < offset) {
					console.log(`Ignoring message from an old offset: ${message.offset} (expecting at least ${offset})`)
					return
				}
				numConsumed++
				messages.push({ topic, partition, message, value: message.value.toString() })
				if (numConsumed >= limit) {
					consumer.stop()
					resolve()
				}
			},
		})
	})

	consumer.seek({ topic: req.params.topic, partition: req.params.partition, offset: offset })
	try {
		await p;
		res.status(200).json(messages)
	}
	catch (error) {
		consumer.stop()
		res.status(500).json({ error, messages })
	}
})

export const start = async (port: number): Promise<void> => {
	const server = http.createServer(app);

	await admin.connect()
	await consumer.connect()

	return new Promise<void>((resolve, reject) => {
		server.listen(port, resolve);
	});
};
