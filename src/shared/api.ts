import { DescribeConfigResponse, ITopicMetadata, SeekEntry, KafkaMessage } from "kafkajs";
import { Schema, Type } from "avsc";

export type MaybeError = { error?: string }

export type TopicOffsets = { partition: number, high: number, low: number}
export type TopicsOffsets = Array<TopicOffsets>
export type ConsumerOffsets = Array<SeekEntry & { metadata: string | null, partitionOffsets?: TopicOffsets }>
export type TopicConsumerGroups = Array<{groupId: string, offsets: ConsumerOffsets}>
export type TopicMessage = { topic: string, partition: number, value: string, key: string, message: KafkaMessage, schemaType: Type | undefined }
export type TopicMessages = { messages: TopicMessage[], hasTimeout: boolean }
export type Broker = { nodeId: number; host: string; port: number }

export type GetTopicsResult = MaybeError & { topics: ITopicMetadata[] }
export type GetTopicOffsetsResult = MaybeError & { offsets: TopicsOffsets }
export type GetTopicConfigsResult = MaybeError & DescribeConfigResponse
export type GetBrokerConfigsResult = MaybeError & DescribeConfigResponse
export type GetTopicConsumerGroupsResult = MaybeError & TopicConsumerGroups
export type GetTopicResult = MaybeError & { offsets: TopicsOffsets, config?: DescribeConfigResponse, groups?: TopicConsumerGroups}
export type GetClusterResult = MaybeError & { brokers: Array<Broker>, controller: number | null, clusterId: string }
export type GetTopicOffsetsByTimestapResult = MaybeError & SeekEntry[]
export type GetTopicMessagesResult = MaybeError & TopicMessages

export type GetSubjectsResult = MaybeError & string[]
export type GetSubjectVersionsResult = MaybeError & number[]
export type GetSchemaResult = MaybeError & { schema: Schema, id: number }

export type ConnectorState = `RUNNING` | `FAILED` | `PAUSED`
export type ConnectorConfig = { [key: string]: string }
export type GetConnectorsResult = MaybeError & string[]
export type GetConnectorStatusResult = MaybeError & { name: string, connector: { state: ConnectorState, worker_id: string }, tasks: { state: ConnectorState, id: number, worker_id: string}[], type: string }
export type GetConnectorConfigResult = MaybeError & ConnectorConfig
export type GetConnectorTasksResult = MaybeError & { id: {connector: string, task: number}, config: {[key: string]: string} }[]
export type GetConnectorTaskStatusResult = MaybeError & { state: ConnectorState, id: number, worker_id: string }