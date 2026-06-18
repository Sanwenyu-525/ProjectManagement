-- Model providers (Claude, OpenAI, Gemini, custom OpenAI-compatible)
CREATE TABLE IF NOT EXISTS "model_providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- Agent configurations
CREATE TABLE IF NOT EXISTS "agent_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'smart_toy',
    "providerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "agent_configs_providerId_fkey"
        FOREIGN KEY ("providerId") REFERENCES "model_providers" ("id") ON DELETE CASCADE
);
