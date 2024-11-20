const core = require('@actions/core');
const { exec } = require('@actions/exec');

async function run() {
  try {
    // Get inputs
    const token = core.getInput('token');
    const apiUrl = process.env.API_URL;  // Access API_URL from environment

    if (!apiUrl) {
      throw new Error("API_URL environment variable is not set");
    }

    // Set GITHUB_TOKEN for access
    process.env.GH_TOKEN = token;

    // Install dependencies and run the Python script with environment variables
    await exec('pip install -r requirements.txt');
    await exec('python main.py', [], {
      env: { ...process.env, API_URL: apiUrl }
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();