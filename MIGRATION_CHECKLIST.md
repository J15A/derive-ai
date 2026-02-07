# Quick Migration Checklist

Follow these steps to migrate to the new Wolfram Alpha-powered solve feature:

## ☑️ Step 1: Install Dependencies

```bash
cd server
npm install
```

This will install the new `axios` dependency needed for Wolfram Alpha API calls.

## ☑️ Step 2: Get Wolfram Alpha App ID

1. Go to https://developer.wolframalpha.com/
2. Sign up or log in
3. Click "Get an AppID"
4. Fill in application details
5. Copy your App ID

📖 **Detailed instructions**: [WOLFRAM_ALPHA_GUIDE.md](./WOLFRAM_ALPHA_GUIDE.md)

## ☑️ Step 3: Update Environment Variables

Edit `server/.env` and add:

```env
WOLFRAM_APP_ID=your-wolfram-app-id-here
```

Make sure you also have:
```env
OPENROUTER_API_KEY=your-openrouter-key-here
```

## ☑️ Step 4: Restart Backend Server

```bash
cd server
npm run dev
```

## ☑️ Step 5: Test the Feature

1. Start the frontend (if not already running):
   ```bash
   npm run dev
   ```

2. Open your browser to the app

3. Draw a simple equation (try: "2 + 2" or "2x = 10")

4. Select the handwritten equation

5. Click the "Solve" button

6. Verify that the solution appears

## ✅ You're Done!

The solve feature is now powered by Wolfram Alpha for more accurate mathematical computations.

## Troubleshooting

### Server won't start
- Check that `WOLFRAM_APP_ID` is in `server/.env`
- Check that `OPENROUTER_API_KEY` is in `server/.env`
- Run `cd server && npm install` again

### "Could not recognize equation"
- Make sure handwriting is clear
- Check that `OPENROUTER_API_KEY` is valid
- Check server console logs for detailed errors

### "Wolfram Alpha could not solve"
- The equation might not be recognized correctly
- Check server logs to see what was sent to Wolfram Alpha
- Try simpler notation or clearer handwriting

### Rate limit errors
- Free tier: 2,000 Wolfram Alpha queries/month
- Monitor your usage at https://developer.wolframalpha.com/
- Consider caching common queries or upgrading

## Need Help?

- 📚 [WOLFRAM_ALPHA_GUIDE.md](./WOLFRAM_ALPHA_GUIDE.md) - Detailed Wolfram Alpha setup
- 📚 [OPENROUTER_GUIDE.md](./OPENROUTER_GUIDE.md) - OpenRouter setup  
- 📚 [SOLVE_FEATURE_OVERHAUL.md](./SOLVE_FEATURE_OVERHAUL.md) - Technical details
- 📚 [GETTING_STARTED.md](./GETTING_STARTED.md) - General setup guide
