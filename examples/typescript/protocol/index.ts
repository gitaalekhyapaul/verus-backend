/* eslint-env node */
import { config } from "dotenv";
import express, { Request, Response } from "express";
import { verify, settle } from "x402/facilitator";
import { ERC8004Service } from "./8004";
import { HashgraphService } from "./hashgraph";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createSigner,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
  Signer,
  ConnectedClient,
  SupportedPaymentKind,
  type X402Config,
  SupportedHederaNetworks,
  isHederaSignerWallet,
} from "x402/types";

config();

const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || "";
const SVM_PRIVATE_KEY = process.env.SVM_PRIVATE_KEY || "";
const SVM_RPC_URL = process.env.SVM_RPC_URL || "";
const HEDERA_PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY || "";
const HEDERA_ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID || "";

if (!EVM_PRIVATE_KEY && !SVM_PRIVATE_KEY && (!HEDERA_PRIVATE_KEY || !HEDERA_ACCOUNT_ID)) {
  console.error("Missing required environment variables");
  console.error(
    "Provide at least one of: EVM_PRIVATE_KEY, SVM_PRIVATE_KEY, or HEDERA_PRIVATE_KEY (with HEDERA_ACCOUNT_ID)",
  );
  process.exit(1);
}

// Validate Hedera configuration
if (HEDERA_PRIVATE_KEY && !HEDERA_ACCOUNT_ID) {
  console.error("HEDERA_ACCOUNT_ID is required when HEDERA_PRIVATE_KEY is provided");
  process.exit(1);
}

// Create X402 config with custom RPC URL if provided
const x402Config: X402Config | undefined = SVM_RPC_URL
  ? { svmConfig: { rpcUrl: SVM_RPC_URL } }
  : undefined;

const app = express();

// Configure express to parse JSON bodies
app.use(express.json());

type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

app.get("/verify", (req: Request, res: Response) => {
  res.json({
    endpoint: "/verify",
    description: "POST to verify x402 payments",
    body: {
      paymentPayload: "PaymentPayload",
      paymentRequirements: "PaymentRequirements",
    },
  });
});

app.post("/verify", async (req: Request, res: Response) => {
  try {
    const body: VerifyRequest = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);
    // use the correct client/signer based on the requested network
    // svm verify requires a Signer because it signs & simulates the txn
    // hedera verify requires a Signer because it verifies the txn
    let client: Signer | ConnectedClient;
    if (SupportedHederaNetworks.includes(paymentRequirements.network)) {
      client = await createSigner(paymentRequirements.network, HEDERA_PRIVATE_KEY, {
        accountId: HEDERA_ACCOUNT_ID,
      });
    } else {
      throw new Error("Invalid network");
    }

    // verify
    const valid = await verify(client, paymentPayload, paymentRequirements, x402Config);
    res.json(valid);
  } catch (error) {
    console.error("error", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

app.get("/settle", (req: Request, res: Response) => {
  res.json({
    endpoint: "/settle",
    description: "POST to settle x402 payments",
    body: {
      paymentPayload: "PaymentPayload",
      paymentRequirements: "PaymentRequirements",
    },
  });
});

app.get("/supported", async (req: Request, res: Response) => {
  let kinds: SupportedPaymentKind[] = [];

  // hedera
  if (HEDERA_PRIVATE_KEY && HEDERA_ACCOUNT_ID) {
    const signer = await createSigner("hedera-testnet", HEDERA_PRIVATE_KEY, {
      accountId: HEDERA_ACCOUNT_ID,
    });
    const feePayer = isHederaSignerWallet(signer) ? signer.accountId.toString() : undefined;

    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "hedera-testnet",
      extra: {
        feePayer,
      },
    });
  }
  res.json({
    kinds,
  });
});

app.post("/settle", async (req: Request, res: Response) => {
  try {
    const body: SettleRequest = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

    // use the correct private key based on the requested network
    let signer: Signer;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      signer = await createSigner(paymentRequirements.network, EVM_PRIVATE_KEY);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      signer = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    } else if (SupportedHederaNetworks.includes(paymentRequirements.network)) {
      signer = await createSigner(paymentRequirements.network, HEDERA_PRIVATE_KEY, {
        accountId: HEDERA_ACCOUNT_ID,
      });
    } else {
      throw new Error("Invalid network");
    }

    // settle
    const response = await settle(signer, paymentPayload, paymentRequirements, x402Config);
    res.json(response);
  } catch (error) {
    console.error("error", error);
    res.status(400).json({ error: `Invalid request: ${error}` });
  }
});

app.listen(process.env.PORT || 3000, async () => {
  console.log(`Server listening at http://localhost:${process.env.PORT || 3000}`);
  const hashgraphService = await HashgraphService.getInstance();
  const fileID = await hashgraphService.createAgentCard();
  const fileURI = `hfs://${fileID?.toString() || ""}`;
  console.log("File URI: %O", fileURI);
  console.log("Agent card created: %O", fileURI);
  const erc8004Client = await ERC8004Service.getInstance().getClient();
  const result = await erc8004Client.identity.registerWithURI(fileURI);
  console.log("Agent registered: %O", result);
  const agentCard = await hashgraphService.getAgentCard(fileID!);
  console.log("Agent card: %O", JSON.parse(agentCard));
});
