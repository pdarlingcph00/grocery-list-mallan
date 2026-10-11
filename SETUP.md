# Setup guide

The app code is done. What's left is creating your own free Firebase backend
(needs your Google login, so this part is on you) and putting the files
online somewhere both phones can reach.

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
2. Name it anything (e.g. "grocery-list"). Disable Google Analytics (not needed).
3. Wait for it to finish creating.

## 2. Register a web app and get your config

1. In the project overview, click the **`</>`** (web) icon to add a web app.
2. Give it a nickname, skip Firebase Hosting setup here (we'll host elsewhere).
3. It will show a `firebaseConfig` object. Copy those values into
   [firebase-config.js](firebase-config.js) in this folder, replacing the
   `PASTE_..._HERE` placeholders.

## 3. Turn on Firestore (the sync database)

1. In the left sidebar: **Build > Firestore Database > Create database**.
2. Choose a location close to you (e.g. `eur3 (europe-west)`).
3. Start in **production mode** (we'll set proper rules next).

## 4. Turn on email/password sign-in and create your two accounts

1. **Build > Authentication > Get started**.
2. Under **Sign-in method**, enable **Email/Password**.
3. Go to the **Users** tab > **Add user**. Add one entry for you and one for
   your wife, each with an email and a password you choose (they don't need
   to be real inboxes — just credentials you'll both remember, e.g.
   `you@yourlist.app`).
4. Copy each user's **User UID** shown in that table — you'll need both in
   the next step.

## 5. Lock down the security rules

1. Open [firestore.rules](firestore.rules) in this folder and paste in the
   two UIDs from step 4.
2. In the Firebase console: **Firestore Database > Rules**, paste the
   contents of that file in, and click **Publish**.

This restricts read/write access to only your two accounts — nobody else
can see or edit the list, even though the project itself is technically
public infrastructure.

## 6. Put the files online

No Node/npm is installed on this machine, so the simplest option is
**GitHub Pages** (just needs a GitHub account and git, which you already
have):


Then create a new empty repo on github.com (don't initialize it with a
README), and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/grocery-list-2.git
git branch -M main
git push -u origin main
```

Then in the repo on GitHub: **Settings > Pages > Source > Deploy from a
branch**, pick `main` / `root`, save. After a minute your app is live at
`https://YOUR_USERNAME.github.io/grocery-list-2/`.

(Alternative: Cloudflare Pages or Netlify can connect to the same GitHub
repo with a couple of clicks if you'd rather use those.)

## 7. Install it on both iPhones

1. Open the URL from step 6 in **Safari** on each phone.
2. Log in with each person's account (from step 4).
3. Tap the **Share** icon > **Add to Home Screen**.
4. Open it from the home screen icon from now on — it behaves like a normal app.

## 8. Test it

Add an item on one phone, confirm it shows up on the other within a couple
of seconds. Check an item off, delete one, and try "Clear checked items".
