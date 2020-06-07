import express from "express";
import http from "http";
import path from "path";
import { Kafka, KafkaMessage, ResourceTypes, DescribeConfigResponse } from "kafkajs";
import { SchemaRegistry } from '@ovotech/avro-kafkajs';
import { Type } from "avsc";
import { v4 as uuidv4 } from 'uuid';

type MessageInfo = { topic: string, partition: number, value: string, key: string, message: KafkaMessage, schemaType: Type | undefined }

type TopicQueryInput = { topic: string, partition: number, limit: number, offset: number, search: string}

const schemaRegistry = new SchemaRegistry({ uri: 'http://localhost:8081' });
const kafka = new Kafka({
	clientId: 'kafka-browser',
	brokers: ['localhost:9092']
})

const admin = kafka.admin()

const app = express();

app.set("view engine", "ejs");
app.set("views", "public");

console.log(__dirname)
app.use("/assets", express.static(path.join(__dirname, "../client")));

app.get("/api/topics", async (req, res) => {
	const topics = await admin.fetchTopicMetadata(undefined as any)
	res.status(200).json(topics)
})

app.get("/api/topic/:topic", async (req, res) => {
	const offsets = await admin.fetchTopicOffsets(req.params.topic)
	const config = await getTopicConfig(req.params.topic)
	res.status(200).json({offsets, config})
})

app.get("/api/topic/:topic/config", async (req, res) => {
	const config = await getTopicConfig(req.params.topic)
	res.status(200).json({config})
})

app.get("/api/messages/:topic/:partition", async (req, res) => {
	try {
		const limit = req.query.limit ? parseInt(req.query.limit.toString()) : 100
		const offset = req.query.offset ? parseInt(req.query.offset.toString()) : 0
		const messages = await getMessages({topic: req.params.topic, partition: parseInt(req.params.partition), limit, offset, search: ""})
		res.status(200).json(messages)
	}
	catch (error) {
		res.status(500).json({ error })
	}
})

app.get("/api/messages-cross-topics/:topics", async (req, res) => {
	try {
		req.setTimeout(300000) //5 minutes timeout on the entire request

		const limit = req.query.limit ? parseInt(req.query.limit.toString()) : 100
		const fromBeginning = req.query.search_from === `Beginning`
		const search = req.query.search ? req.query.search.toString() : ""
		let messages: MessageInfo[] = []
		const topics = req.params.topics.split(`,`)
		for (const topic of topics) {
			const partitions = await admin.fetchTopicOffsets(topic)
			for (const partition of partitions) {
				const low = parseInt(partition.low)
				const high = parseInt(partition.high)
				if (high === 0) {
					continue
				}
				const offset = fromBeginning ? low : Math.max(parseInt(partition.high) - limit, low)
				let partitionLimit = offset + limit > high ? high - offset : limit
				console.log(`Getting messages for topic ${topic}, partition ${partition.partition}`)
				const partitionMessages = await getMessages({topic, partition: partition.partition, limit: partitionLimit, offset, search })
				console.log(`Done getting messages for topic ${topic}, partition ${partition.partition} (#${partitionMessages.length})`)
				messages = messages.concat(partitionMessages)
			}
		}
		console.log(`Done getting all messages (#${messages.length})`)
		res.status(200).json(messages)
	}
	catch (error) {
		console.error(`Error getting all messages: ${error}`)
		res.status(500).json({ error })
	}
})

app.get("/*", (req, res) => {
	res.render("index");
});

const getTopicConfig = async (topic: string) :Promise<DescribeConfigResponse> => {
	return await admin.describeConfigs({
		includeSynonyms: false,
		resources: [
			{
			type: ResourceTypes.TOPIC,
			name: topic
			}
		]
	})
}

const getMessages = async (input: TopicQueryInput): Promise<MessageInfo[]> => {
	const consumer = kafka.consumer({ groupId: `kafka-browser-${Date.now()}=${uuidv4()}` })
	await consumer.connect()

	const messages: MessageInfo[] = []
	let numConsumed = 0
	console.log(`Querying topic ${input.topic} (partition ${input.partition}) at offset=${input.offset}, limit=${input.limit}`)
	consumer.subscribe({ topic: input.topic, fromBeginning: true })
	const consumed: Set<string> = new Set<string>();
	const p = new Promise<void>(async (resolve, reject) => {
		setTimeout(() => {
			reject("timeout")
		}, 20000);
		await consumer.run({
			autoCommit: false,
			eachMessage: async ({ topic, partition, message }) => {
				console.log(`---MESSAGE: ${message.offset}---`)
				let schemaType : Type | undefined = undefined;
				try {
					const { type, value } = await schemaRegistry.decodeWithType<any>(message.value);
					message.value = value;
					schemaType = type;
				} catch (error) {
					console.log(`Not an avro message? error: ${error}`);
				}
				const value = message.value ? message.value.toString() : "";
				const key = message.key ? message.key.toString() : "";
				console.log({
					partition,
					offset: message.offset,
					value: value,
					schemaType: schemaType,
					key: key,
				})

				if (topic !== input.topic) {
					console.log(`Ignoring message from a different topic: ${topic} (expecting ${input.topic})`)
					return
				}

				if (consumed.has(message.offset)) {
					console.log(`Ignoring duplicate message from offset ${message.offset}`)
					return
				}
				consumed.add(message.offset)

				if (parseInt(message.offset) < input.offset) {
					console.log(`Ignoring message from an old offset: ${message.offset} (expecting at least ${input.offset})`)
					return
				}
				numConsumed++
				let filteredOut = false
				if (input.search) {
					if (!value.includes(input.search) && !key.includes(input.search)) {
						filteredOut = true
						console.log(`Ignoring message from offset ${message.offset}, filtered out by search`)
					}
				}
				if (!filteredOut) {
					messages.push({ topic, partition, message, key, value, schemaType })
				}
				if (numConsumed >= input.limit) {
					resolve()
				}
			},
		})
	})

	consumer.seek({ topic: input.topic, partition: input.partition, offset: input.offset.toString() })
	try {
		await p;
		return messages
	}
	finally {
		consumer.stop()
	}
}

export const start = async (port: number): Promise<void> => {
	const server = http.createServer(app);

	await admin.connect()

	return new Promise<void>((resolve, reject) => {
		server.listen(port, resolve);
	});
};
