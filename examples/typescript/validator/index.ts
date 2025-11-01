import { config } from "dotenv";
import express, { Request, Response } from "express";
import { ChatGroq } from "@langchain/groq";

config();

const app = express();
app.use(express.json());

// ---- Groq chat model ----
const llm = new ChatGroq({
  model: process.env.GROQ_MODEL || "llama3-70b-8192", // Updated to a common model
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
});

// ---- Routes ----
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Essay Word Count API is running",
    status: "healthy",
    model: process.env.GROQ_MODEL || "llama3-70b-8192",
    endpoints: {
      "POST /word-count": "Count words in an essay",
    },
  });
});

// Word count endpoint
// A simpler, faster, and more reliable alternative
app.post("/word-count-simple", (req: Request, res: Response) => {
  const { essay } = req.body as { essay?: string };

  if (!essay || typeof essay !== "string" || !essay.trim()) {
    return res.status(400).json({ error: "Essay is required" });
  }

  // The "right" way to count words in JS
  const wordCount = essay
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length;

  res.json({ wordCount });
});

// ---- General Purpose LLM Query Endpoint ----
app.post("/query-structured", async (req: Request, res: Response) => {
  try {
    const { prompt, schema } = req.body as {
      prompt?: string;
      schema?: any; // We'll accept a raw JSON schema object
    };

    // 1. Validate inputs
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "A 'prompt' is required and must be a non-empty string",
      });
    }
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      return res.status(400).json({
        error: "A 'schema' is required and must be a valid JSON object",
        example: {
          prompt: "Extract the user from this text: John Doe is 30.",
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
            required: ["name", "age"],
          },
        },
      });
    }

    // 2. Create the structured LLM instance
    // We pass the JSON schema directly, as shown in the Groq docs
    const structuredLLM = llm.withStructuredOutput(schema);

    // 3. Invoke the model
    // We can pass the prompt as a string or a HumanMessage
    const messages = [new HumanMessage(prompt)];
    const response = await structuredLLM.invoke(messages);

    // 4. Send the structured JSON response
    // 'response' is already a JavaScript object, not a string
    res.json({
      structuredResponse: response,
      model: process.env.GROQ_MODEL || "llama3-70b-8192",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Structured query error:", error);
    res.status(500).json({
      error: "Failed to process structured request",
      message: errorMessage,
    });
  }
});

// ---- Start server ----
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Essay Word Count API server is running on port ${PORT}`);
  console.log("  GET  / - Health check");
  console.log("  POST /word-count - Count words in an essay");
  if (!process.env.GROQ_API_KEY) {
    console.warn("⚠️  Warning: GROQ_API_KEY environment variable is not set");
  }
});
