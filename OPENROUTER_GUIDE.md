# OpenRouter Usage & Access Guide

This guide explains how OpenRouter is used in DeriveAI and how to manage API access for contributors.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai/) is a unified API that provides access to multiple AI models (GPT-4, Claude, Gemini, etc.) through a single interface. It's like Stripe for AI models.

## Current Usage in DeriveAI

Your app uses OpenRouter for two main features:

### 1. **Equation Solver** (`/api/solve`)
- **Model**: `openai/gpt-4o-mini` (fast, cheap, multimodal)
- **Purpose**: Recognizes handwritten math from images and solves equations
- **Input**: Image data URL (PNG/JPEG)
- **Output**: Step-by-step solution

**Example Flow:**
```
User draws: "2x + 4 = 10"
↓
Captures as image
↓
OpenRouter (GPT-4o-mini) recognizes & solves
↓
Returns: "2x = 6\nx = 3"
```

### 2. **Graph Recognition** (`/api/graph`)
- **Model**: `openai/gpt-4o-mini`
- **Purpose**: Converts handwritten equations to Desmos-compatible LaTeX
- **Input**: Image data URL
- **Output**: LaTeX expression for graphing

**Example Flow:**
```
User draws: "y = x²"
↓
OpenRouter converts to LaTeX
↓
Returns: "y=x^{2}"
↓
Desmos graphs it
```

## OpenRouter Features Available

### 1. **Model Selection**
You can switch between different AI models:

```typescript
// Current (fast & cheap):
model: "openai/gpt-4o-mini"

// More powerful alternatives:
model: "openai/gpt-4o"              // Better accuracy, more expensive
model: "anthropic/claude-3.5-sonnet" // Excellent at math reasoning
model: "google/gemini-pro-1.5"      // Good balance
model: "meta-llama/llama-3.2-90b-vision-instruct" // Open source, cheaper
```

**Cost Comparison (per 1M tokens):**
- gpt-4o-mini: ~$0.15 input / $0.60 output
- gpt-4o: ~$2.50 input / $10.00 output
- claude-3.5-sonnet: ~$3.00 input / $15.00 output
- gemini-pro-1.5: ~$1.25 input / $5.00 output

### 2. **Provider Preferences**
Order which providers to try first:

```typescript
body: JSON.stringify({
  model: "openai/gpt-4o-mini",
  provider: {
    order: ["OpenAI", "Together"],  // Try OpenAI first, fallback to Together
    allow_fallbacks: true,
  },
  // ...
})
```

### 3. **Rate Limiting & Caching**
```typescript
body: JSON.stringify({
  model: "openai/gpt-4o-mini",
  route: "fallback",  // Use cheaper models if available
  // ...
})
```

### 4. **Response Streaming**
For real-time responses:

```typescript
body: JSON.stringify({
  stream: true,  // Get tokens as they're generated
  // ...
})
```

### 5. **Advanced Parameters**
```typescript
body: JSON.stringify({
  model: "openai/gpt-4o-mini",
  temperature: 0.1,      // Lower = more deterministic (good for math)
  max_tokens: 500,       // Limit response length
  top_p: 0.9,           // Nucleus sampling
  frequency_penalty: 0,  // Reduce repetition
  // ...
})
```

## Managing OpenRouter Access for Contributors

### Option 1: Each Contributor Gets Their Own Key (Recommended)

**Pros:**
- ✅ Track individual usage and costs
- ✅ No shared billing concerns
- ✅ Easy to revoke access
- ✅ Each person controls their own limits

**Setup:**
1. Send contributors to https://openrouter.ai/
2. They sign up (free account)
3. They add credits ($5-10 minimum, lasts a long time for development)
4. They create an API key at https://openrouter.ai/keys
5. They add it to their local `.env` file

**OpenRouter Free Credits:**
- New users get some free credits
- Models like gpt-4o-mini are very cheap (~$0.01 for 100 equations)
- $5 credit lasts weeks of active development

### Option 2: Shared API Key (For Small Teams)

If you want to share your API key:

**⚠️ Risks:**
- You pay for everyone's usage
- Harder to track who uses what
- If key is leaked, anyone can use it

**Setup:**
1. Go to https://openrouter.ai/keys
2. Create a new key with a descriptive name: `"DeriveAI-Team"`
3. Set usage limits:
   - Monthly limit: $50 (or whatever you're comfortable with)
   - Rate limits: 100 requests/minute
4. Share the key securely (not in Git, use password manager or 1Password)
5. Contributors add it to their local `.env` file

**To set limits:**
```
OpenRouter Dashboard → Keys → Edit Key → Set Limits
- Credit limit: $50/month
- Rate limit: 100 req/min
- Allowed models: openai/gpt-4o-mini (cheaper option only)
```

### Option 3: Use OpenRouter Credits System

OpenRouter allows you to create "sub-keys" with limited credits:

1. Go to https://openrouter.ai/keys
2. Create a key for each contributor
3. Allocate specific credit amounts: e.g., $5 per contributor
4. When they run out, they can get more or use their own key

## Monitoring Usage

### View Usage in OpenRouter Dashboard:
1. Go to https://openrouter.ai/activity
2. See requests, costs, and model usage
3. Filter by date, model, or key

### Add Usage Tracking to Your App:
```typescript
// In solve.ts or graph.ts
const data = await response.json();

// Log usage (optional)
console.log('Usage:', {
  model: data.model,
  tokens: data.usage?.total_tokens,
  cost: data.usage?.total_cost,
});
```

## Security Best Practices

### ✅ DO:
- Keep API keys in `.env` files (already in `.gitignore`)
- Set usage/rate limits on keys
- Rotate keys periodically
- Use separate keys for dev/staging/production
- Monitor usage regularly
- Use the cheapest model that works (gpt-4o-mini is great)

### ❌ DON'T:
- Commit API keys to Git
- Share keys in public channels
- Use production keys in development
- Give unlimited access to shared keys
- Expose keys in client-side code

## Optimizing Costs

### 1. **Use the Right Model**
```typescript
// For development/testing:
model: "openai/gpt-4o-mini"  // ~$0.15 per 1M input tokens

// For production (if you need better accuracy):
model: "openai/gpt-4o"       // ~$2.50 per 1M input tokens
```

### 2. **Reduce Token Usage**
- Keep prompts concise
- Limit max_tokens in responses
- Use lower temperature for deterministic tasks

### 3. **Cache Results** (Future Enhancement)
```typescript
// Consider caching common equations
const cache = new Map();
const cacheKey = imageHash;
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

### 4. **Implement Request Queuing**
Prevent abuse by rate limiting on your backend:
```typescript
// Example: Max 10 requests per user per minute
```

## Switching Models

To try different models, update the route files:

### In `server/src/routes/solve.ts`:
```typescript
body: JSON.stringify({
  model: "anthropic/claude-3.5-sonnet",  // Try Claude for better math
  // ... rest of config
})
```

### In `server/src/routes/graph.ts`:
```typescript
body: JSON.stringify({
  model: "openai/gpt-4o",  // Try full GPT-4o for complex equations
  // ... rest of config
})
```

## Environment Variables

Required for all contributors:

```env
# Get from https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-...

# Your site URL (for OpenRouter analytics)
YOUR_SITE_URL=http://localhost:3001
```

## Troubleshooting

### "OPENROUTER_API_KEY is not configured"
- **Cause**: Missing or invalid API key in `.env`
- **Fix**: Add valid key to `server/.env`

### "Insufficient credits"
- **Cause**: OpenRouter account has no credits
- **Fix**: Add credits at https://openrouter.ai/credits

### "Rate limit exceeded"
- **Cause**: Too many requests
- **Fix**: Wait a minute or increase rate limits

### "Model not available"
- **Cause**: Model doesn't exist or requires different tier
- **Fix**: Check https://openrouter.ai/models for available models

## Useful Links

- **OpenRouter Dashboard**: https://openrouter.ai/
- **API Documentation**: https://openrouter.ai/docs
- **Available Models**: https://openrouter.ai/models
- **Pricing**: https://openrouter.ai/models (shows live prices)
- **Activity Log**: https://openrouter.ai/activity

## Example: Upgrading to Better Model

Want better equation recognition? Update `server/src/routes/solve.ts`:

```typescript
model: "openai/gpt-4o",  // More accurate but costs ~15x more

// Or try Claude 3.5:
model: "anthropic/claude-3.5-sonnet",  // Excellent at math, similar cost to GPT-4o
```

Test both and see which gives better results for your use case!

## Questions?

- OpenRouter Support: support@openrouter.ai
- OpenRouter Discord: https://discord.gg/openrouter
