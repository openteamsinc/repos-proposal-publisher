const core = require('@actions/core');
const exec = require('@actions/exec');

async function run() {
  try {
    const apiUrl = process.env.API_URL; // Access API_URL from secrets
    const token = core.getInput('token'); // GitHub token from inputs

    if (!apiUrl) {
      throw new Error("API_URL is not set in the origin repository's secrets.");
    }

    console.log(`Using API_URL: ${apiUrl}`);

    // Install Python dependencies
    console.log("Installing Python dependencies...");
    await exec.exec('pip install -r requirements.txt');

    // Run Python script
    console.log("Running Python script...");
    await exec.exec('python', ['main.py'], {
      env: { ...process.env, API_URL: apiUrl, GH_TOKEN: token },
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
