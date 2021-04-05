import express from "express";
import http from "http";
import path from "path";
import { Kafka, ResourceTypes, DescribeConfigResponse, Consumer, Admin, GroupDescriptions } from "kafkajs";
import { SchemaRegistry } from '@ovotech/avro-kafkajs';
import { Type } from "avsc";
import { v4 as uuidv4 } from 'uuid';
import { KAFKA_URLS, SCHEMA_REGISTRY_URL, KAFKA_CONNECT_URL } from "./config";
import { GetTopicsResult, GetTopicResult, TopicsOffsets, ConsumerOffsets, TopicConsumerGroups, TopicOffsets, GetClusterResult, GetTopicOffsetsByTimestapResult, TopicMessage, TopicMessages, GetTopicMessagesResult, GetSubjectsResult, GetSubjectVersionsResult, GetSchemaResult, GetTopicConsumerGroupsResult, GetTopicOffsetsResult, GetConnectorsResult, GetConnectorStatusResult, GetConnectorConfigResult, GetConnectorTasksResult, GetConnectorTaskStatusResult, GetConnectorTopicsResult } from "../shared/api";
const fetch = require("node-fetch");

type TopicQueryInput = { topic: string, partition: number, limit: number, offset: number, search: string, timeout?: number}

const schemaRegistry = new SchemaRegistry({ uri: SCHEMA_REGISTRY_URL });

class KafkaClient {
	public Kafka!: Kafka;
	public Admin!: Admin;

	public async Connect() {
		this.Kafka = new Kafka({
			clientId: 'krowser',
			brokers: KAFKA_URLS
		})
		this.Admin = this.Kafka.admin()

		console.log(`connecting to admin`)
		let connected = false
		while (!connected) {
			try {
				await kafka.Admin.connect()
				connected = true
			} catch (error) {
				console.error("Error connecting admin, retrying in a second", error)
				await new Promise( resolve => setTimeout(resolve, 1000) );
			}
		}
		console.log(`connected to admin`)
	}
}

const kafka = new KafkaClient();

const app = express();

app.set("view engine", "ejs");
app.set("views", "public");

console.log(__dirname)
app.use("/assets", express.static(path.join(__dirname, "../client")));
app.use("/public", express.static('public'));

async function withRetry<TRes>(name: string, fun: () => Promise<TRes>): Promise<TRes> {
	try {
		return await fun();
	}
	catch (error) {
		console.error(`Error when trying ${name}, reconnecting kafka. Error: `, error)
		await kafka.Connect();
		return await fun();
	}
}

app.get("/api/topics", async (req, res) => {
	try {
		const topics: GetTopicsResult = await withRetry("fetchTopicMetadata", () => kafka.Admin.fetchTopicMetadata(undefined as any))
		res.status(200).json(topics)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/topic/:topic", async (req, res) => {
	try {
		const offsets: TopicsOffsets = await withRetry("fetchTopicOffsets", () => kafka.Admin.fetchTopicOffsets(req.params.topic))
		offsets.sort((o1, o2) => o1.partition - o2.partition)
		try {
			const groups = await getTopicConsumerGroups(req.params.topic)
			try {
				const config: DescribeConfigResponse = await getTopicConfig(req.params.topic)
				res.status(200).json({offsets, groups, config} as GetTopicResult)
			}
			catch (error) {
				console.error(`Error while fetching config for topic ${req.params.topic}:`, error)
				res.status(200).json({offsets, groups} as GetTopicResult)
			}
		}
		catch (error) {
			console.error(`Error while fetching consumer groups for topic ${req.params.topic}:`, error)
			res.status(200).json({offsets} as GetTopicResult)
		}
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/topic/:topic/offsets", async (req, res) => {
	try {
		const offsets = await withRetry("fetchTopicOffsets", () => kafka.Admin.fetchTopicOffsets(req.params.topic))
		offsets.sort((o1, o2) => o1.partition - o2.partition)
		const out: GetTopicOffsetsResult = {offsets}
		res.status(200).json(out)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/topic/:topic/config", async (req, res) => {
	try {
		const config = await getTopicConfig(req.params.topic)
		res.status(200).json(config)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/topic/:topic/consumer_groups", async (req, res) => {
	try {
		const groups: GetTopicConsumerGroupsResult = await getTopicConsumerGroups(req.params.topic)
		const offsets = await withRetry("fetchTopicOffsets", () => kafka.Admin.fetchTopicOffsets(req.params.topic))
		const partitonToOffset: Record<number, TopicOffsets> = {}
		for (const offset of offsets) {
			partitonToOffset[offset.partition] = offset
		}
		for (const group of groups) {
			for (const offsets of group.offsets) {
				offsets.partitionOffsets = partitonToOffset[offsets.partition]
			}
		}
		res.status(200).json(groups)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/groups", async (req, res) => {
	try {
		const consumers = await withRetry("listGroups", () => kafka.Admin.listGroups())
		const ids = consumers.groups.map(g => g.groupId)
		const groups = await withRetry("describeGroups", () => kafka.Admin.describeGroups(ids))
		modifyGroups(groups)
		res.status(200).json(groups)
	}
	catch (error) {
		console.error(error)
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/members/:group", async (req, res) => {
	try {
		const groups = await withRetry("describeGroups", () => kafka.Admin.describeGroups([req.params.group]))
		modifyGroups(groups)
		res.status(200).json(groups.groups[0].members)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

//todo: remove this when https://github.com/tulios/kafkajs/issues/755 is resolved (and add types)
function modifyGroups(groups: GroupDescriptions) {
	for (const group of (groups as any).groups) {
		for (const member of group.members) {
			member.memberAssignment = stringFromArray(member.memberAssignment)
			member.memberMetadata = stringFromArray(member.memberMetadata)
		}
	}
}

function stringFromArray(data: Buffer): string
{
	var count = data.length;
	var str = "";

	for(var index = 0; index < count; index += 1)
		str += String.fromCharCode(data[index]);

	return str;
}

app.get("/api/cluster", async (req, res) => {
	try {
		const cluster: GetClusterResult = await withRetry("describeCluster", () => kafka.Admin.describeCluster())
		res.status(200).json(cluster)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/offsets/:topic/:timestamp", async (req, res) => {
	try {
		const topic = req.params.topic
		const timestamp = req.params.timestamp ? parseInt(req.params.timestamp.toString()) : 0
		const entries: GetTopicOffsetsByTimestapResult = await withRetry("fetchTopicOffsetsByTimestamp", () => kafka.Admin.fetchTopicOffsetsByTimestamp(topic, timestamp))
		res.status(200).json(entries)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/messages/:topic/:partition", async (req, res) => {
	try {
		let limit = req.query.limit ? parseInt(req.query.limit.toString()) : 100
		const offset = req.query.offset ? parseInt(req.query.offset.toString()) : 0
		const topic = req.params.topic
		const search = req.query.search ? req.query.search as string : ""
		const timeout = req.query.timeout ? parseInt(req.query.timeout.toString()) : 20000
		const partition = parseInt(req.params.partition)
		const partitions = await withRetry("fetchTopicOffsets", () => kafka.Admin.fetchTopicOffsets(topic))
		for (const partitionOffsets of partitions) {
			if (partitionOffsets.partition !== partition) {
				continue
			}
			const maxOffset = parseInt(partitionOffsets.high)
			if (maxOffset === 0 || offset > maxOffset) {
				res.status(200).json({messages: []})
				return
			}
			if (offset + limit > maxOffset) {
				limit = maxOffset - offset
			}
			if (limit <= 0) {
				res.status(200).json({messages: []})
				return
			}
			const messages: GetTopicMessagesResult = await getMessages({topic, partition, limit, offset, search, timeout})
			res.status(200).json(messages)
			return
		}
		res.status(404).json({ error: `partition ${partition} not found for topic ${topic}`})
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/schema-registry/subjects", async (req, res) => {
	try {
		const subjects: GetSubjectsResult = await schemaRegistry.getSubjects()
		res.status(200).json(subjects)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
});

app.get("/api/schema-registry/versions/:subject", async (req, res) => {
	try {
		const versions: GetSubjectVersionsResult = await schemaRegistry.getSubjectVersions(req.params.subject)
		res.status(200).json(versions)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/schema-registry/schema/:subject/:version", async (req, res) => {
	try {
		const schema: GetSchemaResult = await schemaRegistry.getSubjectVersionSchema(req.params.subject, parseInt(req.params.version))
		res.status(200).json(schema)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/kafka-connect/connectors", async (req, res) => {
	try {
		const response = await fetch(`${KAFKA_CONNECT_URL}/connectors`)
		if (response.status >= 400) {
			const txt = await response.text()
			const error = `failed to get connectors, status code ${response.status}, error: ${txt}`
			res.status(500).json({ error })
			return
		}
		const data: string[] = await response.json()
		const out: GetConnectorsResult = data;
		res.status(200).json(out)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/kafka-connect/connector/:connector/status", async (req, res) => {
	try {
		const response = await fetch(`${KAFKA_CONNECT_URL}/connectors/${req.params.connector}/status`)
		if (response.status >= 400) {
			const txt = await response.text()
			const error = `failed to get status for connector ${req.params.connector}, status code ${response.status}, error: ${txt}`
			res.status(500).json({ error })
			return
		}
		const data: GetConnectorStatusResult = await response.json()
		res.status(200).json(data)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/kafka-connect/connector/:connector/config", async (req, res) => {
	try {
		const response = await fetch(`${KAFKA_CONNECT_URL}/connectors/${req.params.connector}/config`)
		if (response.status >= 400) {
			const txt = await response.text()
			const error = `failed to get config for connector ${req.params.connector}, status code ${response.status}, error: ${txt}`
			res.status(500).json({ error })
			return
		}
		const data: GetConnectorConfigResult = await response.json()
		res.status(200).json(data)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/kafka-connect/connector/:connector/tasks", async (req, res) => {
	try {
		const response = await fetch(`${KAFKA_CONNECT_URL}/connectors/${req.params.connector}/tasks`)
		if (response.status >= 400) {
			const txt = await response.text()
			const error = `failed to get tasks for connector ${req.params.connector}, status code ${response.status}, error: ${txt}`
			res.status(500).json({ error })
			return
		}
		const data: GetConnectorTasksResult = await response.json()
		res.status(200).json(data)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/api/kafka-connect/connector/:connector/tasks/:task/status", async (req, res) => {
	try {
		const response = await fetch(`${KAFKA_CONNECT_URL}/connectors/${req.params.connector}/tasks/${req.params.task}/status`)
		if (response.status >= 400) {
			const txt = await response.text()
			const error = `failed to get task status for connector ${req.params.connector}, task ${req.params.task}, status code ${response.status}, error: ${txt}`
			res.status(500).json({ error })
			return
		}
		const data: GetConnectorTaskStatusResult = await response.json()
		res.status(200).json(data)
	}
	catch (error) {
		res.status(500).json({ error: error.toString() })
	}
})

app.get("/*", (req, res) => {
	res.render("index");
});

const getTopicConfig = async (topic: string): Promise<DescribeConfigResponse> => {
	return await withRetry("describeConfigs", () => kafka.Admin.describeConfigs({
		includeSynonyms: false,
		resources: [
			{
			type: ResourceTypes.TOPIC,
			name: topic
			}
		]
	}))
}

const getTopicConsumerGroups = async (topic: string): Promise<TopicConsumerGroups> => {
	const consumers = await withRetry("listGroups", () => kafka.Admin.listGroups())
	const ids = consumers.groups.filter(c => c.protocolType === `consumer`).map(g => g.groupId)
	const groups = await withRetry("describeGroups", () => kafka.Admin.describeGroups(ids))
	modifyGroups(groups)
	let found: TopicConsumerGroups = []
	for (const group of groups.groups) {
		for (const member of group.members) {
			if (member.memberAssignment.includes(`${topic}\u0000`)) { //todo: we use suffix delimiter \u0000 but the prefix delimiter looks different each time?
				const offsets: ConsumerOffsets = await withRetry("fetchOffsets", () => kafka.Admin.fetchOffsets({groupId: group.groupId, topic: topic}))
				found.push({groupId: group.groupId, offsets})
			}
		}
	}
	return found
}

const getMessages = async (input: TopicQueryInput): Promise<TopicMessages> => {
	const groupId = `krowser-${Date.now()}=${uuidv4()}`
	const consumer = kafka.Kafka.consumer({ groupId })
	await consumer.connect()

	const messages: TopicMessage[] = []
	let numConsumed = 0
	console.log(`Querying topic ${input.topic} (partition ${input.partition}) at offset=${input.offset}, limit=${input.limit}`)
	consumer.subscribe({ topic: input.topic, fromBeginning: true })
	const consumed: Set<string> = new Set<string>()
	let hasTimeout = false
	const p = new Promise<void>(async (resolve, reject) => {
		setTimeout(() => {
			hasTimeout = true
			resolve()
		}, input.timeout || 20000);
		await consumer.run({
			autoCommit: false,
			eachMessage: async ({ topic, partition, message }) => {
				if (partition !== input.partition) {
					console.log(`ignoreing message from partition ${partition} (offset ${message.offset}), expecting partition ${input.partition}`)
					return
				}
				console.log(`---MESSAGE: ${message.offset}---`)
				let schemaType : Type | undefined = undefined;
				if (message.value === null) {
					console.log(`Message value is null`)
				} else {
					try {
						const { type, value } = await schemaRegistry.decodeWithType<any>(message.value);
						message.value = value;
						schemaType = type;
					} catch (error) {
						console.log(`Not an avro message? error: ${error}`);
					}
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

				const offset = parseInt(message.offset)
				if (offset < input.offset) {
					console.log(`Ignoring message from an old offset: ${offset} (expecting at least ${input.offset})`)
					return
				}
				numConsumed++
				let filteredOut = false
				if (input.search) {
					if (!value.includes(input.search) && !key.includes(input.search) && !(schemaType?.name?.includes(input.search) ?? true)) {
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
		return { messages, hasTimeout }
	}
	finally {
		cleanupConsumer(consumer, groupId) //not awaiting this as we don't want to block the response
	}
}

const cleanupConsumer = async (consumer: Consumer, groupId: string) => {
	try {
		await consumer.stop()
	}
	catch (error) {
		console.error(`error stopping consumer`, error)
	}
	for (var i = 3; i >= 0; i--) {
		try {
			const res = await withRetry("deleteGroups", () => kafka.Admin.deleteGroups([groupId]))
			console.log(`Delete consumer group ${res[0].groupId} result: ${res[0].errorCode || "success"}`)
			return
		}
		catch (error) {
			console.error(`Error deleting consumer group ${groupId} (retries left = ${i}):`, error)
			await new Promise( resolve => setTimeout(resolve, 300) );
		}
	}
}

export const start = async (port: number): Promise<void> => {
	const server = http.createServer(app);

	await kafka.Connect();

	return new Promise<void>((resolve, reject) => {
		server.listen(port, resolve);
	});
};
