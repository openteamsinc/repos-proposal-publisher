const core = require('@actions/core');
const exec = require('@actions/exec');

async function run() {
  try {
    // Access API_URL from the origin repository's secrets
    const apiUrl = process.env.API_URL;  // Secret set in the origin repository
    const token = core.getInput('token');  // Token provided by the user

    if (!apiUrl) {
      throw new Error("API_URL is not set in the origin repository's secrets.");
    }

    console.log(`Using API_URL: ${apiUrl}`);

    // Set environment variables for Python script
    process.env.GITHUB_TOKEN = token;
    process.env.API_URL = apiUrl;

    // Install Python dependencies
    console.log("Installing Python dependencies...");
    await exec.exec('pip install -r requirements.txt');

    // Run the Python script
    console.log("Running the Python script...");
    await exec.exec('python', ['main.py']);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
