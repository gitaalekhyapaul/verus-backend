/* eslint-env node */
import { config } from "dotenv";
import express, { Request, Response } from "express";
import { verify, settle } from "x402/facilitator";
import { ERC8004Service } from "./8004";
import { HashgraphService } from "./hashgraph";
import { SupabaseService } from "./supabase";
import axios, { AxiosError } from "axios";
import { decodeXPaymentResponse, Hex, withPaymentInterceptor } from "x402-axios";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createSigner,
  Signer,
  ConnectedClient,
  SupportedPaymentKind,
  type X402Config,
  SupportedHederaNetworks,
  isHederaSignerWallet,
  HederaAddress,
  Resource,
} from "x402/types";
import { paymentMiddleware } from "x402-express";

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

app.use(
  //@ts-expect-error - paymentMiddleware is not typed
  paymentMiddleware(
    process.env.HEDERA_ACCOUNT_EVM_ADDRESS as HederaAddress,
    {
      "POST /submit-job": {
        price: {
          amount: "1",
          asset: {
            address: "0.0.7171672",
            decimals: 0,
          },
        },
        network: "hedera-testnet",
      },
    },
    {
      url: process.env.FACILITATOR_URL as Resource,
    },
  ),
);

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
    console.log("Verify request: %O", req.body);
    const body: VerifyRequest = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);
    console.log("[verify] Payment requirements: %O", paymentRequirements);
    console.log("[verify] Payment payload: %O", paymentPayload);
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
    console.log("Valid: %O", valid);
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
    console.log("[settle] Request: %O", body);
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);
    console.log("[settle] Payment requirements: %O", paymentRequirements);
    console.log("[settle] Payment payload: %O", paymentPayload);
    // use the correct private key based on the requested network
    let signer: Signer;
    if (SupportedHederaNetworks.includes(paymentRequirements.network)) {
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

app.post("/submit-job", async (req: Request, res: Response) => {
  try {
    const { description, acceptanceCriteria, feedbackAuth } = req.body;
    if (!description || !acceptanceCriteria || !feedbackAuth) {
      throw new Error("Missing required fields");
    }
    const supabaseService = SupabaseService.getInstance().getClient();
    const hashgraphService = HashgraphService.getInstance();
    const jobTopicID = await hashgraphService.createTopic();
    const { data, error } = await supabaseService
      .from("jobs")
      .insert({
        description,
        acceptance_criteria: acceptanceCriteria,
        sponsor_feedback_auth: feedbackAuth,
        topic_id: jobTopicID,
        status: "open",
      })
      .select();
    if (error) {
      throw new Error(error.message);
    }
    const job = data[0];
    console.log("Job created: %O", job);
    await hashgraphService.sendMessageToTopic(jobTopicID, JSON.stringify(job));
    res.json({
      jobID: job.id,
    });
  } catch (error) {
    console.error("error", error);
    res.status(400).json({ error: `Invalid request: ${error}` });
  }
});

app.post("/accept-job", async (req: Request, res: Response) => {
  try {
    const { jobID, walletAddress, feedbackAuth } = req.body;
    if (!jobID || !walletAddress || !feedbackAuth) {
      throw new Error("Missing required fields");
    }
    const supabaseService = SupabaseService.getInstance().getClient();
    const hashgraphService = HashgraphService.getInstance();
    const { data, error } = await supabaseService.from("jobs").select().eq("id", jobID);
    if (error) {
      throw new Error(error.message);
    }
    const job = data[0];
    console.log("Job fetched: %O", job);
    const { error: updateError } = await supabaseService
      .from("jobs")
      .update({
        status: "accepted",
        freelancer_address: walletAddress,
        freelancer_feedback_auth: feedbackAuth,
      })
      .eq("id", jobID);
    if (updateError) {
      throw new Error(updateError.message);
    }
    await hashgraphService.sendMessageToTopic(
      job.topic_id,
      JSON.stringify({
        ...job,
        status: "accepted",
        freelancer_address: walletAddress,
        freelancer_feedback_auth: feedbackAuth,
      }),
    );
    res.json({
      ...job,
      status: "accepted",
      freelancer_address: walletAddress,
      freelancer_feedback_auth: feedbackAuth,
    });
  } catch (error) {
    console.error("error", error);
    res.status(400).json({ error: `Invalid request: ${error}` });
  }
});

app.post("/deliver-job", async (req, res) => {
  try {
    const { artifact, jobID } = req.body;
    console.log("Artifact: %O", artifact);
    console.log("Job ID: %O", jobID);
    const privateKey = process.env.HEDERA_PRIVATE_KEY as Hex | string;
    const hederaAccountId = process.env.HEDERA_ACCOUNT_ID as string;
    const signer = await createSigner("hedera-testnet", privateKey, { accountId: hederaAccountId });
    const api = withPaymentInterceptor(
      axios.create({
        baseURL: process.env.VALIDATOR_SERVER_URL as string,
      }),
      signer,
    );
    const supabaseService = SupabaseService.getInstance().getClient();
    const hashgraphService = HashgraphService.getInstance();
    const { data, error } = await supabaseService.from("jobs").select().eq("id", jobID);
    if (error) {
      throw new Error(error.message);
    }
    const job = data[0];
    console.log("Job: %O", job);

    const response = await api.post("/verify-job", {
      jobID,
      artifact,
      acceptanceCriteria: job.acceptance_criteria,
    });
    const paymentResponse = decodeXPaymentResponse(response.headers["x-payment-response"]);
    console.log("Payment response: %O", paymentResponse);
    console.log(response.data);
    if (response.data.success) {
      const { error: updateError } = await supabaseService
        .from("jobs")
        .update({
          status: "completed",
        })
        .eq("id", jobID);
      if (updateError) {
        throw new Error(updateError.message);
      }
      await hashgraphService.sendMessageToTopic(
        job.topic_id,
        JSON.stringify({
          job: {
            ...job,
            status: "completed",
          },
          paymentResponse,
        }),
      );
    }
    res.json({ ...response.data, paymentResponse });
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Error: %O", error.response?.data);
      return res.status(error.response?.status || 500).json({ error: error.response?.data });
    }
    console.error("Error: %O", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(process.env.PORT || 3000, async () => {
  console.log(`[Protocol] Server listening at http://localhost:${process.env.PORT || 3000}`);
  const hashgraphService = await HashgraphService.getInstance();
  const erc8004Client = await ERC8004Service.getInstance().getClient();
  let agentID: bigint | undefined;
  if (process.env.ERC8004_AGENT_ID == null) {
    // Register agent if not already registered
    const fileID = await hashgraphService.createAgentCard();
    const fileURI = `hcs://${fileID?.toString() || ""}`;
    console.log("File URI: %O", fileURI);
    console.log("Agent card created: %O", fileURI);
    const result = await erc8004Client.identity.registerWithURI(fileURI);
    console.log("Agent registered: %O", result);
    console.log("Agent ID: %O", result.agentId);
    agentID = result.agentId;
  }
  // Verify agent card exists in the ERC-8004 Identity Registry
  agentID = agentID || BigInt(process.env.ERC8004_AGENT_ID!);
  const agentURI = await erc8004Client.identity.getTokenURI(agentID);
  console.log("Agent URI: %O", agentURI);
  const agentCard = await hashgraphService.getAgentCardFromMessageID(agentURI.split("//")[1]);
  console.log("Agent card: %O", JSON.parse(agentCard ?? "{}"));
});
