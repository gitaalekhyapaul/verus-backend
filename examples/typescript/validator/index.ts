import { config } from "dotenv";
import express, { Request, Response } from "express";
import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";

config();

const app = express();
app.use(express.json());

// ---- Setup LLM ----
const llm = new ChatGroq({
  model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
});

// ---- Prompt Template ----
const prompt = new PromptTemplate({
  template: "Count the number of words in the following essay:\n\n{essay}",
  inputVariables: ["essay"],
});

// ---- Endpoint ----
app.post("/word-count", async (req: Request, res: Response) => {
  const { essay } = req.body as { essay?: string };

  if (!essay || typeof essay !== "string" || !essay.trim()) {
    return res.status(400).json({ error: "Essay is required" });
  }

  try {
    // 1️⃣ Get the prompt as a string
    const promptValue = await prompt.formatPromptValue({ essay });
    const promptString = promptValue.toString(); // Extract string from StringPromptValue
    console.log("🧩 Prompt sent to Groq:\n", promptString);

    // 2️⃣ Send as a HumanMessage array (what ChatGroq expects)
    const response = await llm.invoke([new HumanMessage(promptString)]);
    console.log("📨 Full raw Groq response:", JSON.stringify(response, null, 2));

    // 3️⃣ Return raw model output
    res.json({ output: response.content });
  } catch (err: any) {
    console.error("🔥 Error invoking Groq LLM:", err);
    res.status(500).json({
      error: "Failed to process word count",
      details: err.message,
    });
  }
});


// ---- Health Check ----
app.get("/", (_req, res) => {
  res.json({ message: "Essay Word Count API running", status: "healthy" });
});

// ---- Start server ----
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Essay Word Count API running on port ${PORT}`);
  if (!process.env.GROQ_API_KEY) console.warn("⚠️ Missing GROQ_API_KEY in .env!");
});
