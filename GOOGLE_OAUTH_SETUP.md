# Google OAuth Setup Guide

This guide will help you configure Google OAuth authentication for the Classroom Utilization System.

## Prerequisites

1. A Google Cloud Platform account
2. Access to Google Cloud Console
3. The Google Client ID: `83745494475-om5dg3d440dhnh500ncrbpbkar7ev4s5.apps.googleusercontent.com`

## Step 1: Get Your Google Client Secret

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Find your OAuth 2.0 Client ID (the one ending in `...ev4s5.apps.googleusercontent.com`)
4. Click on it to view details
5. Copy the **Client Secret** (you'll need this for the `.env` file)

## Step 2: Configure Authorized Redirect URIs

1. In the same OAuth 2.0 Client ID settings page, scroll down to **Authorized redirect URIs**
2. Add the following redirect URIs:

   **For Development:**
   - `http://localhost:3000`
   - `http://localhost:3000/` (with trailing slash)

   **For Production (when deployed):**
   - `https://your-domain.com`
   - `https://your-domain.com/` (with trailing slash)

3. Click **Save**

## Step 3: Configure Environment Variables

Create or update the `.env` file in the **root directory** of your project:

```env
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/classroom_utilization
PORT=5000
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=development

# Google OAuth Configuration
GOOGLE_CLIENT_ID=83745494475-om5dg3d440dhnh500ncrbpbkar7ev4s5.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:3000
```

**Important Notes:**
- Replace `your-google-client-secret-here` with the actual Client Secret from Step 1
- The `GOOGLE_CLIENT_ID` is already configured in the code, but you can override it in `.env` if needed
- The `GOOGLE_CALLBACK_URL` should match your frontend URL (default: `http://localhost:3000` for development)

## Step 4: Restart Your Servers

After updating the `.env` file:

1. Stop your backend server (Ctrl+C)
2. Stop your frontend server (Ctrl+C)
3. Restart both servers:
   ```bash
   npm run dev
   ```

   Or restart them separately:
   ```bash
   # Terminal 1 - Backend
   npm run server
   
   # Terminal 2 - Frontend
   cd client
   npm start
   ```

## Step 5: Test Google Login

1. Go to `http://localhost:3000/admin-login` or `http://localhost:3000/login`
2. Click the **"Continue with Google"** button
3. You should be redirected to Google's login page
4. After logging in with your Google account, you should be redirected back to the app

## Troubleshooting

### Error: "GOOGLE_CLIENT_SECRET not configured"
- Make sure you've added `GOOGLE_CLIENT_SECRET` to your `.env` file
- Restart the backend server after updating the `.env` file

### Error: "redirect_uri_mismatch"
- Make sure the redirect URI in your `.env` file matches what's configured in Google Cloud Console
- The redirect URI should be exactly `http://localhost:3000` (or your production URL)
- Check that you've added the redirect URI in Google Cloud Console under **Authorized redirect URIs**

### Error: "This email is not registered"
- Google login only works for users who are already registered in the system
- The user must have an account created in the database first
- Admin accounts can be created using `npm run init-admin`
- Regular users need to be registered through the registration form or by an admin

### Google Login Button Not Working
- Check the browser console for errors
- Make sure the Google Client ID is correct
- Verify that the OAuth consent screen is configured in Google Cloud Console
- Ensure the OAuth 2.0 API is enabled in your Google Cloud project

## Additional Configuration

### OAuth Consent Screen

If you haven't set up the OAuth consent screen:

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** (for testing) or **Internal** (for Google Workspace)
3. Fill in the required information:
   - App name: "Classroom Utilization System"
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes (if needed):
   - `email`
   - `profile`
   - `openid`
5. Add test users (for External apps in testing mode)
6. Save and continue

### API Enablement

Make sure the following APIs are enabled in your Google Cloud project:

1. Go to **APIs & Services** > **Library**
2. Search for and enable:
   - **Google+ API** (if still available)
   - **Identity Toolkit API**
   - **OAuth2 API**

## Production Deployment

When deploying to production:

1. Update the `GOOGLE_CALLBACK_URL` in your production `.env` file to match your production domain
2. Add your production URL to **Authorized redirect URIs** in Google Cloud Console
3. Update the OAuth consent screen to use your production domain
4. Publish your OAuth app (if using External app type)

## Security Notes

- **Never commit your `.env` file** to version control
- Keep your Client Secret secure and never expose it in client-side code
- The Client ID is safe to expose (it's already in the frontend code)
- Regularly rotate your Client Secret for security
- Use environment-specific configurations for development and production

## Support

If you continue to experience issues:

1. Check the server console logs for detailed error messages
2. Check the browser console for client-side errors
3. Verify all environment variables are set correctly
4. Ensure the redirect URI matches exactly (including protocol and port)
5. Make sure your Google account has access to the OAuth app (for testing mode)

