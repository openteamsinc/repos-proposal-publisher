const core = require('@actions/core');
const exec = require('@actions/exec');

async function run() {
  try {
    // Fetch secrets and inputs
    const apiUrl = process.env.API_URL;  // API_URL is set in the origin repository secrets
    const token = core.getInput('token'); // GitHub token passed by the user

    if (!apiUrl) {
      throw new Error("API_URL is not set in the origin repository's secrets.");
    }

    console.log(`Using API_URL: ${apiUrl}`);

    // Set environment variables for the Python script
    process.env.GITHUB_TOKEN = token;

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
