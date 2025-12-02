# How to Deploy FileSender to Render.com

This guide explains how to deploy your application to the cloud for free using Render.

## Prerequisites
1.  A [GitHub](https://github.com/) account.
2.  A [Render](https://render.com/) account.

## Step 1: Push Code to GitHub
1.  Create a new repository on GitHub.
2.  Push your code to the repository:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin <your-repo-url>
    git push -u origin main
    ```

## Step 2: Deploy on Render
1.  Log in to your Render dashboard.
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub account and select your `filesender` repository.
4.  Render will automatically detect the `render.yaml` file and configure everything.
5.  Click **Create Web Service**.

## Step 3: Done!
Render will build your app and give you a URL (e.g., `https://filesender.onrender.com`).
- **Note**: The free tier puts the server to "sleep" after 15 minutes of inactivity. The first request after sleep might take 30-60 seconds.
- **Warning**: Files uploaded to the server **will be deleted** if the server restarts or sleeps. This is expected behavior for the free tier.
