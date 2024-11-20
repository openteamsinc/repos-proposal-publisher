const core = require('@actions/core');
const exec = require('@actions/exec');

async function run() {
  try {
    // Debug: Log available environment variables
    console.log("Available environment variables:", process.env);

    // Access the API_URL secret
    const apiUrl = process.env.API_URL; // Secret from origin repository
    const token = core.getInput('token'); // GitHub token from the calling workflow

    if (!apiUrl) {
      throw new Error(
        "API_URL is not set in the origin repository's secrets."
      );
    }

    console.log(`Using API_URL: ${apiUrl}`);

    // Set environment variables for the Python script
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
