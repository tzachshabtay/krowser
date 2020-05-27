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

const produceTestMessage = async (i) => {
    const producer = await kafkaAvro.getProducer()
    const data = new test()
    data.long_field = 10
    data.int_field = i
    data.enum_field = 'option1'
    producer.produce('test', -1, data, 'key');
}

const produceNestedTestMessage = async (i) => {
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
    producer.produce('test', -1, data, 'key');
}

const start = async () => {
    await registerSchema(testRaw, `test-value`)
    await registerSchema(nestedTestRaw, `test_nested-value`)
    await kafkaAvro.init()
    for (let i = 0; i < 5; i++) {
        await produceTestMessage(i)
        await produceNestedTestMessage(i)
    }
}

start()
