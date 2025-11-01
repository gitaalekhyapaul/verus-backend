import { ERC8004Client, EthersAdapter } from "erc-8004-js";
import { ethers } from "ethers";
/**
 * ERC8004 service class for interacting with the ERC8004 contracts.
 */
export class ERC8004Service {
  private static instance: ERC8004Service | undefined;
  private client: ERC8004Client;

  /**
   * Private constructor to create a new ERC8004 service.
   * Initializes the client with the operator ID and key from the environment variables.
   */
  private constructor() {
    const rpcUrl = process.env.HEDERA_RPC_URL;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    if (!process.env.HEDERA_PRIVATE_KEY) {
      throw new Error("HEDERA_PRIVATE_KEY must be set");
    }
    const signer = new ethers.Wallet(process.env.HEDERA_PRIVATE_KEY, provider);
    const adapter = new EthersAdapter(provider, signer);
    this.client = new ERC8004Client({
      adapter: adapter,
      addresses: {
        identityRegistry: "0x4c74ebd72921d537159ed2053f46c12a7d8e5923",
        reputationRegistry: "0xc565edcba77e3abeade40bfd6cf6bf583b3293e0",
        validationRegistry: "0x18df085d85c586e9241e0cd121ca422f571c2da6",
        chainId: 296,
      },
    });
  }

  /**
   * Gets the singleton instance of the ERC8004 service.
   * If the instance does not exist, it creates a new one.
   *
   * @returns The singleton instance of the ERC8004 service.
   */
  public static getInstance(): ERC8004Service {
    if (!ERC8004Service.instance) {
      ERC8004Service.instance = new ERC8004Service();
    }
    return ERC8004Service.instance;
  }

  /**
   * Gets the client for the ERC8004 service.
   *
   * @returns The client for the ERC8004 service.
   */
  public getClient(): ERC8004Client {
    return this.client;
  }
}
