import { ChatGroq } from "@langchain/groq";
import { HumanMessage } from "@langchain/core/messages";
import { config } from "dotenv";

config();

const llm = new ChatGroq({
  model: "llama3-70b-8192",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
});

const msg = new HumanMessage("test");
console.log("HumanMessage created:", msg);

const messages = [msg];
console.log("Messages array:", messages);

try {
  const response = await llm.invoke(messages);
  console.log("Success! Response:", response.content);
} catch (error) {
  console.error("Error:", error.message);
}
