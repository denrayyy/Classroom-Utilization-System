# reCAPTCHA Setup Instructions

## Current Configuration

Your backend `.env` file already has:
```
RECAPTCHA_SECRET_KEY=66Le0iQUsAAAAAOVbf2Ff3IbEJoAw1QeqhSyleZiE
```

## Step 1: Find Your reCAPTCHA Site Key

Your reCAPTCHA site key is the **public key** that pairs with your secret key. You can find it:

1. **Google reCAPTCHA Admin Console**: https://www.google.com/recaptcha/admin
2. Look for the site key that matches your secret key
3. The site key typically starts with `6L...` (similar format to your secret key)

## Step 2: Add Site Key to Client .env

Edit `client/.env` and add your site key:

```env
REACT_APP_RECAPTCHA_SITE_KEY=your-actual-site-key-here
```

Replace `your-actual-site-key-here` with your actual reCAPTCHA site key.

## Step 3: Restart Frontend

After updating the `.env` file, restart your React development server:

```bash
cd client
npm start
```

## Verification

After restarting:
- The reCAPTCHA checkbox should appear on login pages
- It should **NOT** show "This reCAPTCHA is for testing purposes only"
- The reCAPTCHA should work with your actual keys

## Note

The site key and secret key must be from the same reCAPTCHA site configuration. They are paired keys - make sure they match!



