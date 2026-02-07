# Wolfram Alpha API Setup Guide

This guide will help you set up the Wolfram Alpha API for the solve feature in Derive AI.

## Overview

The solve feature now uses a two-step process:
1. **OpenRouter (GPT-4 Vision)**: Recognizes handwritten mathematical expressions from images
2. **Wolfram Alpha**: Solves the recognized mathematical expressions and provides step-by-step solutions

## Getting Your Wolfram Alpha App ID

### Step 1: Create a Wolfram ID

1. Go to [Wolfram Alpha Developer Portal](https://developer.wolframalpha.com/)
2. Click **"Sign Up"** or **"Get an AppID"**
3. Create a free Wolfram ID account if you don't have one

### Step 2: Get an App ID

1. Once logged in, go to the [Get an AppID page](https://developer.wolframalpha.com/access)
2. Click **"Get an AppID"**
3. Fill in the application details:
   - **Application Name**: Derive AI Notebook (or any name you prefer)
   - **Application Description**: Handwriting recognition and mathematical problem solver
   - **Purpose**: Education/Research
4. Click **"Get AppID"**
5. Copy your new App ID (it will look something like: `XXXXXX-XXXXXXXXXX`)

### Step 3: Configure Environment Variables

Add your Wolfram Alpha App ID to the server's `.env` file:

```bash
cd server
```

Edit `server/.env` and add:

```env
WOLFRAM_APP_ID=your-wolfram-app-id-here
OPENROUTER_API_KEY=your-openrouter-key-here
```

**Note**: Both API keys are required:
- `WOLFRAM_APP_ID`: For solving mathematical problems
- `OPENROUTER_API_KEY`: For handwriting recognition (see [OPENROUTER_GUIDE.md](./OPENROUTER_GUIDE.md))

### Step 4: Restart the Server

After adding the environment variables, restart your backend server:

```bash
cd server
npm run dev
```

## Free Tier Limits

The free Wolfram Alpha API tier includes:
- **2,000 queries per month**
- **No credit card required**
- Full access to Wolfram Alpha's computational knowledge

If you need more queries, you can upgrade to a paid plan on the [Wolfram Alpha Developer Portal](https://products.wolframalpha.com/api/pricing/).

## How It Works

When you select handwritten math and click "Solve":

1. **Recognition**: The image is sent to OpenRouter's GPT-4 Vision model which transcribes the handwritten math into plain text (e.g., "2x + 4 = 10", "integrate x dx", "derivative of x^2")

2. **Solving**: The recognized equation is sent to Wolfram Alpha, which:
   - Interprets the mathematical expression
   - Computes the solution
   - Returns step-by-step results

3. **Display**: The solution is rendered as text in your note

## Supported Math Operations

Wolfram Alpha can solve a wide variety of mathematical problems:

- **Basic Algebra**: `2x + 4 = 10`, `x^2 - 5x + 6 = 0`
- **Calculus**: `integrate x^2 dx`, `derivative of sin(x)`
- **Trigonometry**: `sin(pi/4)`, `cos(x) + sin(x)`
- **Linear Algebra**: Matrix operations, determinants
- **Differential Equations**: `y'' + 2y' + y = 0`
- **And much more**: Limits, series, complex numbers, etc.

## Troubleshooting

### Error: "WOLFRAM_APP_ID is not configured"

- Make sure you've added `WOLFRAM_APP_ID=your-app-id-here` to `server/.env`
- Restart the server after adding the environment variable

### Error: "Failed to recognize handwriting"

- Check that your `OPENROUTER_API_KEY` is configured correctly
- See [OPENROUTER_GUIDE.md](./OPENROUTER_GUIDE.md) for setup instructions

### Error: "Wolfram Alpha could not solve this expression"

- The handwriting recognition may have transcribed the equation incorrectly
- Try writing more clearly or using typed text
- Check the server logs to see what equation was recognized

### Rate Limit Exceeded

- You've exceeded the 2,000 queries per month limit
- Wait until next month or upgrade to a paid plan
- Consider caching common queries if building for production

## API Documentation

For more information about the Wolfram Alpha API:
- [Wolfram Alpha API Documentation](https://products.wolframalpha.com/api/documentation/)
- [Query Parameters Reference](https://products.wolframalpha.com/api/documentation/#parameter-reference)
- [Examples](https://products.wolframalpha.com/api/documentation/#examples)

## Development Tips

### Testing the API

You can test your App ID directly in your browser:

```
http://api.wolframalpha.com/v2/query?input=2x+4=10&appid=YOUR_APP_ID&format=plaintext&output=json
```

Replace `YOUR_APP_ID` with your actual App ID.

### Viewing Server Logs

The server logs will show:
1. The recognized equation from the handwriting
2. Any errors from Wolfram Alpha

Start the server with:
```bash
cd server
npm run dev
```

Watch the console for debugging information.

## Support

If you encounter issues:
1. Check the [Wolfram Alpha API Status](https://products.wolframalpha.com/api/status/)
2. Review the [API Documentation](https://products.wolframalpha.com/api/documentation/)
3. Check your quota usage in the [Developer Portal](https://developer.wolframalpha.com/)
