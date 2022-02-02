import { SeekEntry } from "kafkajs";
import { Schema } from "avsc";

export type MaybeError = { error?: string }

export type PartitionMetadata = { error_description?: string, partition_id: number, leader: number, replicas: number[], isr: number[] }
export type TopicMetadata = { name: string, partitions: PartitionMetadata[] }
export type TopicOffsets = { partition: number, high: number, low: number}
export type TopicsOffsets = Array<TopicOffsets>
export type ConsumerOffsets = Array<{ metadata: string | null, offset: number, partition_offsets?: TopicOffsets }>
export type TopicConsumerGroups = Array<{group_id: string, offsets: ConsumerOffsets}>
export type TopicMessage = { topic: string, partition: number, value: string, key: string, timestamp: number, offset: number, schema_type: string | undefined }
export type TopicMessages = { messages: TopicMessage[], hasTimeout: boolean }
export type Broker = { id: number; host: string; port: number }
export type ConfigEntry = { name: string, value?: string, source: string, is_read_only: boolean, is_default: boolean, is_sensitive: boolean}
export type GroupMemberMetadata = { member_id: string, client_id: string, client_host: string, metadata: string, assignment: string}
export type GroupMetadata = { name: string, protocol: string, protocol_type: string, state: string, members: GroupMemberMetadata[]}

export type GetTopicsResult = MaybeError & { topics: TopicMetadata[] }
export type GetTopicOffsetsResult = MaybeError & { offsets: TopicsOffsets }
export type GetTopicConfigsResult = MaybeError & { entries: ConfigEntry[] }
export type GetBrokerConfigsResult = MaybeError & { entries: ConfigEntry[] }
export type GetTopicConsumerGroupsResult = MaybeError & { consumer_groups: TopicConsumerGroups }
export type GetTopicResult = MaybeError & { offsets: TopicsOffsets, consumer_groups?: TopicConsumerGroups}
export type GetClusterResult = MaybeError & { brokers: Array<Broker> }
export type GetTopicOffsetsByTimestapResult = MaybeError & SeekEntry[]
export type GetTopicMessagesResult = MaybeError & TopicMessages
export type GetGroupsResult = MaybeError & { groups: GroupMetadata[] }

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