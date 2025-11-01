import { ChatGroq } from "@langchain/groq";
import { HumanMessage } from "@langchain/core/messages";
import { config } from "dotenv";
config();

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
});

const run = async () => {
  const res = await llm.invoke([new HumanMessage("Say 'Groq is alive'")]);
  console.log(res);
};

run();
