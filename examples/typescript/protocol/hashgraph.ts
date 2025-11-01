import { Client } from "@hashgraph/sdk";
/**
 * Hashgraph service class for interacting with the Hashgraph network.
 */
export class HashgraphService {
  private static instance: HashgraphService | undefined;
  private client: Client;

  /**
   * Private constructor to create a new Hashgraph service.
   * Initializes the client with the operator ID and key from the environment variables.
   */
  private constructor() {
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;
    if (!operatorId || !operatorKey) {
      throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set");
    }
    this.client = new Client({
      network: process.env.HEDERA_NETWORK,
      operator: {
        accountId: operatorId,
        privateKey: operatorKey,
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
}
