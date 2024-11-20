const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const configPath = path.resolve(__dirname, 'config.json');
    console.log(`Reading config file from ${configPath}...`);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const base64Api = config.encoded.split('').reverse().join('');
    const apiUrl = Buffer.from(base64Api, 'base64').toString('utf-8');

    // Access the API_URL secret
    const token = core.getInput('token'); // GitHub token from the calling workflow

    if (!apiUrl) {
      throw new Error(
        "API_URL is not set."
      );
    }
    else {
      console.log("Received API URL");
    }

    // Set environment variables for the Python script
    process.env.API_URL = apiUrl;
    process.env.GH_TOKEN = token;

    // Install Python dependencies
    console.log("Installing Python dependencies...");
    await exec.exec('pip install -r requirements.txt');

    // Run the Python script
    console.log("Running the Python script...");
    await exec.exec('python', ['main.py'], {
      env: { ...process.env, API_URL: apiUrl, GH_TOKEN: token },
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
