import {
  Client,
  FileContentsQuery,
  PrivateKey,
  FileId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import { AgentCard } from "@a2a-js/sdk";
/**
 * Hashgraph service class for interacting with the Hashgraph network.
 */
export class HashgraphService {
  private static instance: HashgraphService | undefined;
  private client: Client;
  private operatorKey: PrivateKey;

  /**
   * Private constructor to create a new Hashgraph service.
   * Initializes the client with the operator ID and key from the environment variables.
   */
  private constructor() {
    const operatorId = process.env.HEDERA_ACCOUNT_ID;
    this.operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY!);
    if (!operatorId || !this.operatorKey) {
      throw new Error("HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set");
    }
    this.client = new Client({
      network: process.env.HEDERA_NETWORK,
      operator: {
        accountId: operatorId,
        privateKey: this.operatorKey,
      },
    });
  }

  /**
   * Gets the singleton instance of the Hashgraph service.
   * If the instance does not exist, it creates a new one.
   *
   * @returns The singleton instance of the Hashgraph service.
   */
  public static getInstance(): HashgraphService {
    if (!HashgraphService.instance) {
      HashgraphService.instance = new HashgraphService();
    }
    return HashgraphService.instance;
  }

  /**
   * Gets the client for the Hashgraph service.
   *
   * @returns The client for the Hashgraph service.
   */
  public getClient(): Client {
    return this.client;
  }

  /**
   * Creates an agent card for the Verus Protocol Agent.
   *
   * @returns The agent card for the Verus Protocol Agent.
   */
  public async createAgentCard() {
    const agentCard: AgentCard = {
      name: "Verus Protocol Freelancer",
      description: "A freelancer that freelances on the Verus Network.",
      protocolVersion: "verus-1.0.0",
      version: "0.1.0",
      url: `http://localhost:${process.env.PORT}/`, // The public URL of your agent server
      skills: [
        {
          id: "job-acceptance",
          name: "Job Acceptance",
          description: "Accept a job on the Verus Network",
          tags: ["job-acceptance"],
        },
      ],
      defaultInputModes: ["application/json"],
      defaultOutputModes: ["application/json"],
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
    };
    let topicID: string;
    if (process.env.AGENTS_TOPIC_ID == null) {
      topicID = await this.createTopic();
    } else {
      topicID = process.env.AGENTS_TOPIC_ID;
    }
    const messageId = await this.sendMessageToTopic(topicID, JSON.stringify(agentCard));
    console.log("Message sent to topic: %s", messageId);
    return messageId;
    // const tx = new FileCreateTransaction()
    //   .setKeys([client.operatorPublicKey!])
    //   .setContents(JSON.stringify(agentCard))
    //   .setMaxTransactionFee(new Hbar(2))
    //   .freezeWith(client);
    // const signTx = await tx.sign(this.operatorKey);
    // const submitTx = await signTx.execute(client);
    // const receipt = await submitTx.getReceipt(client);
    // console.log("File created: %O", receipt);
    // console.log("File ID: %O", receipt.fileId?.toString() || "");
    // const fileID = receipt.fileId;
    // return fileID;
  }

  /**
   * Gets the agent card for the Verus Protocol Agent.
   *
   * @param fileID - The file ID of the agent card.
   * @returns The agent card for the Verus Protocol Agent.
   */
  public async getAgentCardFromFileID(fileID: FileId | string) {
    const client = this.getClient();
    const query = new FileContentsQuery().setFileId(fileID);
    const file = await query.execute(client);
    return file.toString();
  }

  /**
   * Gets the agent card for the Verus Protocol Agent.
   *
   * @param messageID - The message ID of the agent card.
   * @returns The agent card for the Verus Protocol Agent.
   */
  public async getAgentCardFromMessageID(messageID: string) {
    const [topicId, sequenceNumber] = messageID.split("/");
    try {
      const res = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages/${sequenceNumber}`,
      );
      const response = await res.json();
      const message = Buffer.from(response.message, "base64").toString("utf8").trim();
      return message;
    } catch (error) {
      console.error("Error getting agent card from message ID: %s", error);
      return undefined;
    }
  }

  /**
   * Creates a topic for the Verus Protocol Agent.
   *
   * @returns The topic ID for the Verus Protocol Agent.
   */
  public async createTopic() {
    const client = this.getClient();
    const tx = new TopicCreateTransaction().freezeWith(client);
    const signedTx = await tx.sign(this.operatorKey);
    const submitTx = await signedTx.execute(client);
    const receipt = await submitTx.getReceipt(client);
    console.log("Topic created: %O", receipt);
    return receipt.topicId?.toString() || "";
  }

  /**
   * Sends a message to a topic for the Verus Protocol Agent.
   *
   * @param topicID - The topic ID to send the message to.
   * @param message - The message to send to the topic.
   * @returns The status of the message sent to the topic.
   */
  public async sendMessageToTopic(topicID: string, message: string) {
    const client = this.getClient();
    const tx = new TopicMessageSubmitTransaction({
      topicId: topicID,
      message: message,
    }).freezeWith(client);
    console.log("Transaction frozen: %O", tx.isFrozen());
    const signedTx = await tx.sign(this.operatorKey);
    console.log("Transaction signed: %O", signedTx);
    const submitTx = await signedTx.execute(client);
    console.log("Transaction submitted: %O", submitTx);
    const receipt = await submitTx.getReceipt(client);
    console.log("Message sent to topic: %O", receipt);
    return `${topicID}/${receipt.topicSequenceNumber?.toString() || "1"}`;
  }
}
