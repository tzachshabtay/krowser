const axios = require('axios')
const fs = require('fs')
const { Kafka } = require('kafkajs')
const { SchemaRegistry, AvroKafka } = require('@ovotech/avro-kafkajs');

const raw = fs.readFileSync('test.avsc', 'utf8')
const testSchema = JSON.parse(raw)

const schemaRegistry = new SchemaRegistry({ uri: 'http://localhost:8081' })
const kafka = new Kafka({
    clientId: 'test-producer',
    brokers: ['localhost:9092']
})
const avroKafka = new AvroKafka(schemaRegistry, kafka)

const producer = avroKafka.producer()

const registerSchema = async () => {
    const data = {}
    data["schema"] = raw
    try {
        const res = await axios.post('http://localhost:8081/subjects/test/versions', data)
        console.log(`Status: ${res.status}`)
        console.log('Body: ', res.data)
    }
    catch (e) {
        console.error(e)
    }
};

const produceMessage = async () => {
    await producer.connect()
    await producer.send({
        topic: 'test',
        schema: testSchema,
        messages: [
            { value: { long_field: 10, int_field: 20, enum_field: 'option1' } }
        ],
    });
}

const start = async () => {
    await registerSchema()
    await produceMessage()
}

start()
