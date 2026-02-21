import "dotenv/config";
import {
  checkProviderAvailability,
  resolveAICredentialsFromHeaders,
} from "../src/lib/server/ai-gateway";

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run ai -- status");
  console.log("  npm run ai:status");
}

async function runStatus(): Promise<number> {
  const creds = resolveAICredentialsFromHeaders(() => null);
  const providers = await checkProviderAvailability(creds);
  const availableCount = providers.filter((provider) => provider.available).length;

  console.log("AI provider status:");
  for (const provider of providers) {
    const status = provider.available ? "available" : "unavailable";
    console.log(`- ${provider.id}: ${status} (model: ${provider.defaultModel})`);
  }

  if (availableCount === 0) {
    console.log("");
    console.log(
      "No providers are available. Configure OPENAI_API_KEY or GEMINI_API_KEY, or run Ollama with at least one local model."
    );
    return 1;
  }

  return 0;
}

async function main(): Promise<void> {
  const command = (process.argv[2] || "status").trim().toLowerCase();

  if (command === "status") {
    const code = await runStatus();
    process.exit(code);
    return;
  }

  if (command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to check AI status: ${message}`);
  process.exit(1);
});
