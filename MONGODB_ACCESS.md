# MongoDB Access Management Guide

This guide explains how to manage MongoDB Atlas access for the DeriveAI project.

## Current Setup

- **Cluster**: deriveai.lzzrxqn.mongodb.net
- **Database**: derive-ai
- **Region**: AWS (your region)

## For Project Owner: Adding New Contributors

### Method 1: Individual Developer Databases (Recommended for Open Source)

Have each contributor set up their own MongoDB Atlas account:

1. Send them to the [CONTRIBUTING.md](./CONTRIBUTING.md) guide
2. They create their own free MongoDB Atlas cluster
3. They use their own connection string in their local `.env` file
4. **Benefits:**
   - No shared credentials to manage
   - Each developer has full control
   - No risk of accidentally modifying production data
   - Free for everyone

### Method 2: Shared Development Database (Recommended for Teams)

If you want contributors to share the same database:

#### Step 1: Create Database User for Contributor

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Select your project
3. Navigate to **Database Access** (under Security)
4. Click **"Add New Database User"**
5. Configure:
   ```
   Authentication Method: Password
   Username: contributor_name (e.g., john_dev)
   Password: [Generate strong password]
   Database User Privileges: readWriteAnyDatabase
   ```
6. Click **"Add User"**

#### Step 2: Whitelist Their IP Address

1. Navigate to **Network Access** (under Security)
2. Click **"Add IP Address"**
3. Options:
   - **Specific IP**: More secure, but requires updates if they change locations
   - **0.0.0.0/0**: Less secure, but works from anywhere (good for remote teams)
4. Add a comment with their name
5. Click **"Confirm"**

#### Step 3: Share Connection String

Send them this connection string (via secure channel like password manager):

```
mongodb+srv://contributor_name:THEIR_PASSWORD@deriveai.lzzrxqn.mongodb.net/derive-ai?retryWrites=true&w=majority&appName=DeriveAI
```

Replace:
- `contributor_name` with their username
- `THEIR_PASSWORD` with their password

#### Step 4: Contributor Setup

They should:
1. Create `server/.env` file (never commit this!)
2. Add the connection string:
   ```env
   MONGODB_URI=mongodb+srv://contributor_name:THEIR_PASSWORD@deriveai.lzzrxqn.mongodb.net/derive-ai?retryWrites=true&w=majority&appName=DeriveAI
   ```
3. Add other required environment variables
4. Run `npm run dev:all` to test the connection

## Security Best Practices

### ✅ DO:
- Use `.env` files for local development (already in `.gitignore`)
- Create separate users for each contributor with minimum required privileges
- Use strong, unique passwords for each database user
- Regularly audit and remove inactive users
- Use IP whitelisting when possible
- Rotate passwords periodically
- Use MongoDB's built-in user roles appropriately

### ❌ DON'T:
- Commit `.env` files to Git
- Share database credentials in public channels (Slack, Discord, etc.)
- Give production database access to contributors
- Use the same password for multiple users
- Share your personal admin credentials

## User Roles Reference

| Role | Permissions | Use Case |
|------|------------|----------|
| `read` | Read-only access | Viewing data only |
| `readWrite` | Read and write to database | Development work |
| `dbAdmin` | Database administration | Database management |
| `userAdmin` | User administration | Managing other users |
| `atlasAdmin` | Full cluster access | Project owner only |

## For Production

**Important:** Never use development database credentials in production!

For production deployment:
1. Create a separate production cluster
2. Use environment-specific credentials
3. Restrict IP access to your production server's IP
4. Use MongoDB's built-in monitoring and alerts
5. Set up proper backup schedules

## Revoking Access

When a contributor leaves:

1. Go to **Database Access**
2. Find their user
3. Click **"Edit"** → **"Delete User"**
4. Remove their IP from **Network Access** if applicable
5. Consider rotating shared credentials if they had access to sensitive data

## Troubleshooting Common Issues

### "MongoServerSelectionError"
- **Cause**: IP not whitelisted or incorrect credentials
- **Fix**: Check Network Access and Database Access settings

### "Authentication failed"
- **Cause**: Wrong username/password
- **Fix**: Verify credentials match Database Access settings

### Connection timeout
- **Cause**: Network/firewall issues
- **Fix**: Check IP whitelist, try `0.0.0.0/0` temporarily

## Questions?

Contact the repository owner or refer to [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/).
