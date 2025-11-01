import { AxiosError } from "axios";
import { config } from "dotenv";
import express from "express";
import { ERC8004Service } from "./8004";
import { HashgraphService } from "./hashgraph";
import { paymentMiddleware, Resource, HederaAddress } from "x402-express";
import { ChatGroq } from "@langchain/groq";
import { tool, createAgent } from "langchain";
import { z } from "zod";

const app = express();

config();

app.use(express.json());

app.use(
  //@ts-expect-error - paymentMiddleware is not typed
  paymentMiddleware(
    process.env.HEDERA_ACCOUNT_EVM_ADDRESS as HederaAddress,
    {
      "POST /verify-job": {
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
      url: process.env.FACILITATOR_SERVER_URL as Resource,
    },
  ),
);

app.post("/verify-job", async (req, res) => {
  try {
    const { jobID, artifact, acceptanceCriteria } = req.body;
    console.log("Job ID: %O", jobID);
    console.log("Artifact: %O", artifact);
    console.log("Acceptance Criteria: %O", acceptanceCriteria);
    const llm = new ChatGroq({
      model: "openai/gpt-oss-20b",
      temperature: 0,
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: process.env.GROQ_BASE_URL,
    });
    const countWords = tool(
      ({ query }) => {
        console.log("[tool] Query: %O", query);
        console.log("[tool] Query length: %O", query.split(" ").length);
        return {
          output: query.split(" ").length,
        };
      },
      {
        name: "countWords",
        description: "Count the number of words in a given string",
        schema: z.object({
          query: z.string().describe("The string to count the words of"),
        }),
      },
    );
    const agent = createAgent({
      //@ts-expect-error - model is not typed
      model: llm,
      tools: [countWords],
      prompt:
        "Help in counting the number of words in the given string. ONLY output a number NO OTHER TEXT.",
    });
    const result = await agent.invoke({
      messages: [
        {
          role: "user",
          content: `Count the number of words in the following string: "${artifact}"`,
        },
      ],
    });
    console.log("Result: %O", result.messages[result.messages.length - 1].content);
    // extract the number from the result
    const countWordsResult = result.messages[result.messages.length - 1].content.match(/\d+/)[0];
    console.log("Count words result: %O", countWordsResult);
    if (Number(countWordsResult) === Number(acceptanceCriteria)) {
      res.json({ success: true, words: countWordsResult });
    } else {
      res.json({ success: false, words: countWordsResult });
    }
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
