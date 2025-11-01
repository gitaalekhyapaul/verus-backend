import axios, { AxiosError } from "axios";
import { config } from "dotenv";
import { withPaymentInterceptor, createSigner, type Hex, decodeXPaymentResponse } from "x402-axios";
import express from "express";
import { ERC8004Service } from "./8004";
import { HashgraphService } from "./hashgraph";
import { SupabaseService } from "./supabase";
const app = express();

config();

app.use(express.json());

app.post("/accept-job", async (req, res) => {
  try {
    const { jobID } = req.body;
    console.log("Job ID: %O", jobID);
    const erc8004Client = ERC8004Service.getInstance().getClient();
    const agentID = BigInt(process.env.ERC8004_AGENT_ID!);
    const clientAddress = process.env.SPONSOR_CLIENT_ADDRESS!;
    const lastIndex = await erc8004Client.reputation.getLastIndex(agentID, clientAddress);
    console.log("Agent ID: %O", agentID);
    console.log("Client address: %O", clientAddress);
    console.log("Last index: %O", lastIndex);
    const feedbackAuth = await erc8004Client.reputation.createFeedbackAuth(
      agentID,
      clientAddress,
      lastIndex + BigInt(1),
      BigInt(Math.floor(Date.now() / 1000) + 3600 * 24 * 365), // Valid for 1 year
      BigInt(await erc8004Client.getChainId()),
      process.env.HEDERA_ACCOUNT_EVM_ADDRESS!,
    );
    console.log("Feedback auth: %O", feedbackAuth);
    const signedFeedbackAuth = await erc8004Client.reputation.signFeedbackAuth(feedbackAuth);
    console.log("Signed feedback auth: %O", signedFeedbackAuth);
    const privateKey = process.env.HEDERA_PRIVATE_KEY as Hex | string;
    const hederaAccountId = process.env.HEDERA_ACCOUNT_ID as string;
    const signer = await createSigner("hedera-testnet", privateKey, { accountId: hederaAccountId });
    const api = withPaymentInterceptor(
      axios.create({
        baseURL: process.env.FACILITATOR_SERVER_URL as string,
      }),
      signer,
    );
    const response = await api.post("/accept-job", {
      jobID,
      walletAddress: process.env.HEDERA_ACCOUNT_EVM_ADDRESS!,
      feedbackAuth: signedFeedbackAuth,
    });
    console.log(response.data);
    res.json(response.data);
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Error: %O", error.response?.data);
      return res.status(error.response?.status || 500).json({ error: error.response?.data });
    }
    console.error("Error: %O", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/deliver-job", async (req, res) => {
  try {
    const { jobID, artifact } = req.body;
    console.log("Job ID: %O", jobID);
    console.log("Artifact: %O", artifact);
    const privateKey = process.env.HEDERA_PRIVATE_KEY as Hex | string;
    const hederaAccountId = process.env.HEDERA_ACCOUNT_ID as string;
    const signer = await createSigner("hedera-testnet", privateKey, { accountId: hederaAccountId });
    const api = withPaymentInterceptor(
      axios.create({
        baseURL: process.env.FACILITATOR_SERVER_URL as string,
      }),
      signer,
    );
    const response = await api.post("/deliver-job", {
      jobID,
      artifact,
    });
    console.log(response.data);
    res.json(response.data);
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Error: %O", error.response?.data);
      return res.status(error.response?.status || 500).json({ error: error.response?.data });
    }
    console.error("Error: %O", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/sponsor-feedback", async (req, res) => {
  try {
    const { feedbackAuth, jobID } = req.body;
    const erc8004Client = ERC8004Service.getInstance().getClient();
    const agentID = BigInt(process.env.SPONSOR_AGENT_ID!);
    const clientAddress = process.env.HEDERA_ACCOUNT_EVM_ADDRESS!;
    const lastIndex = await erc8004Client.reputation.getLastIndex(agentID, clientAddress);
    console.log("Agent ID: %O", agentID);
    console.log("Client address: %O", clientAddress);
    console.log("Last index: %O", lastIndex);
    console.log("Feedback auth: %O", feedbackAuth);
    const { txHash } = await erc8004Client.reputation.giveFeedback({
      agentId: agentID,
      score: Math.floor(Math.random() * 25) + 75,
      tag1: "decent-specification",
      tag2: "no-feature-creeping",
      feedbackAuth,
    });
    console.log("Tx Hash for sponsor feedback: %O", txHash);
    const supabaseService = SupabaseService.getInstance().getClient();
    const hashgraphService = HashgraphService.getInstance();
    const { data, error } = await supabaseService.from("jobs").select().eq("id", jobID);
    if (error) {
      throw new Error(error.message);
    }
    const job = data[0];
    console.log("Job: %O", job);
    await hashgraphService.sendMessageToTopic(
      job.topic_id,
      JSON.stringify({
        job,
        feedback: {
          txHash,
          score: Math.floor(Math.random() * 25) + 75,
          tag1: "decent-specification",
          tag2: "no-feature-creeping",
          agentId: agentID.toString(),
          feedbackAuth,
        },
      }),
    );
    res.json({ txHash });
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
  console.log(`[Freelancer] Server is running on port ${process.env.PORT || 3000}`);
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
