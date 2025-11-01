import {
  Client,
  FileContentsQuery,
  FileCreateTransaction,
  Hbar,
  PrivateKey,
  FileId,
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
      name: "Verus Protocol Agent",
      description: "A agent that controls the Verus Network.",
      protocolVersion: "verus-1.0.0",
      version: "0.1.0",
      url: `http://localhost:${process.env.PORT}/`, // The public URL of your agent server
      skills: [
        {
          id: "job-submission",
          name: "Job Submission",
          description: "Submit a job to the Verus Network",
          tags: ["job-submission"],
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
    const client = this.getClient();
    const tx = new FileCreateTransaction()
      .setKeys([client.operatorPublicKey!])
      .setContents(JSON.stringify(agentCard))
      .setMaxTransactionFee(new Hbar(2))
      .freezeWith(client);
    const signTx = await tx.sign(this.operatorKey);
    const submitTx = await signTx.execute(client);
    const receipt = await submitTx.getReceipt(client);
    console.log("File created: %O", receipt);
    console.log("File ID: %O", receipt.fileId?.toString() || "");
    const fileID = receipt.fileId;
    return fileID;
  }

  /**
   * Gets the agent card for the Verus Protocol Agent.
   *
   * @param fileID - The file ID of the agent card.
   * @returns The agent card for the Verus Protocol Agent.
   */
  public async getAgentCard(fileID: FileId) {
    const client = this.getClient();
    const query = new FileContentsQuery().setFileId(fileID);
    const file = await query.execute(client);
    return file.toString();
  }
}
