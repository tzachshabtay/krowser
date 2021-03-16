const axios = require('axios')
const fs = require('fs')
const { Kafka } = require('kafkajs')
const KafkaAvro = require('kafka-avro');

const kafkaAvro = new KafkaAvro({
    kafkaBroker: 'localhost:9092',
    schemaRegistry: 'http://localhost:8081',
    valueSubjectStrategy: 'RecordNameStrategy',
});

const testRaw = fs.readFileSync('test.avsc', 'utf8')

const nestedTestRaw = fs.readFileSync('test_nested.avsc', 'utf8')

const registerSchema = async (raw, name) => {
    const data = {}
    data["schema"] = raw
    try {
        const res = await axios.post(`http://localhost:8081/subjects/${name}/versions`, data)
        console.log(`Status: ${res.status}`)
        console.log('Body: ', res.data)
    }
    catch (e) {
        console.error(e)
    }
};

class test { }
class test_nested { }

const produceTestMessage = async (i, partition) => {
    const producer = await kafkaAvro.getProducer()
    const data = new test()
    data.long_field = 10
    data.int_field = i
    data.enum_field = 'option1'
    producer.produce('test', partition, data, 'key');
}

const produceNestedTestMessage = async (i, partition) => {
    const producer = await kafkaAvro.getProducer()
    const data = new test_nested()
    data.nullable_long = { "long": 5 }
    data.nested = {
        nullable_long: { "long": 5 },
        int_field: i,
        boolean_field: true,
        string_field: "test",
        nested2: {
            nullable_long: { "long": 5 },
            int_field: 20,
            boolean_field: true,
            string_field: "test",
        }
    }
    producer.produce('test', partition, data, 'key');
}

const start = async () => {
    await registerSchema(testRaw, `test-value`)
    await registerSchema(nestedTestRaw, `test_nested-value`)
    const admin = new Kafka({
        clientId: 'krowser-inserter',
        brokers: ['localhost:9092'],
    }).admin()
    await admin.connect()
    try {
        await admin.createPartitions({ topicPartitions: [{ topic: `test`, count: 5 }] })
    } catch (error) {
        console.error(`error while creating partitions (they might already exist): ${error}`)
    }
    await kafkaAvro.init()
    const partitions = [0, 1, 2]
    for (const partition of partitions) {
        console.log(`Partition: ${partition}`)
        for (let i = 0; i < 5; i++) {
            await produceTestMessage(i, partition)
            await produceNestedTestMessage(i, partition)
        }
    }
}

start()
