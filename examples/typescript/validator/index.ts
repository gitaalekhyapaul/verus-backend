import { config } from "dotenv";
import express, { Request, Response } from "express";
import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";


config();

const app = express();
app.use(express.json());

// ---- Define Structured Output Schema ----
const WordCountSchema = z.object({
  wordCount: z.number().describe("The total number of words in the essay"),
});

type WordCount = z.infer<typeof WordCountSchema>;

// ---- Setup LLM with Structured Output ----
const llm = new ChatGroq({
  model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
}).withStructuredOutput(WordCountSchema, {
  method: "json_schema",
  name: "WordCount",
});

// ---- Prompt Template ----
const prompt = new PromptTemplate({
  template: "Analyze the following essay and return the word count, character count, sentence count, and average words per sentence.\n\nEssay:\n{essay}\n\nReturn the results as a JSON object with the following structure: wordCount (number), characterCount (number), sentenceCount (number), averageWordsPerSentence (number).",
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
    const promptString = promptValue.toString();
    console.log("🧩 Prompt sent to Groq:\n", promptString);

    // 2️⃣ Invoke LLM with structured output
    const response = await llm.invoke([new HumanMessage(promptString)]);
    console.log("📨 Structured output response:", JSON.stringify(response, null, 2));

    // 3️⃣ Return structured output (already validated by Zod)
    res.json({ result: response });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("🔥 Error invoking Groq LLM:", error);
    res.status(500).json({
      error: "Failed to process word count",
      details: error.message,
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
